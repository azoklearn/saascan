-- Parcours sans compte : le questionnaire reste dans le navigateur jusqu’au
-- paiement. Le dossier est créé au passage en caisse et s’ouvre avec un lien
-- secret. L’IA ne le rédige qu’après la confirmation du paiement par Stripe.

begin;

-- Plus aucun accès direct depuis le navigateur : le serveur lit et écrit avec
-- service_role, après avoir vérifié le lien d’accès du dossier.
drop policy profiles_select_own on public.profiles;
drop policy dossiers_select_own on public.dossiers;
drop policy dossiers_insert_own_draft on public.dossiers;
drop policy responses_select_own on public.responses;
drop policy selections_select_paid on public.selections;
drop policy build_prompts_select_paid on public.build_prompts;
drop policy plan_tasks_select_paid on public.plan_tasks;
drop policy plan_tasks_update_paid on public.plan_tasks;
drop policy payments_select_own on public.payments;
revoke all on table public.profiles, public.dossiers, public.responses,
  public.selections, public.build_prompts, public.plan_tasks, public.payments
  from anon, authenticated;

drop function public.save_response(uuid, text, jsonb);
drop function public.reserve_checkout(uuid, uuid);
drop function public.reserve_generation(uuid, uuid);
drop function public.apply_stripe_event(text, text, text, timestamptz, uuid, text, text, boolean, integer, boolean, timestamptz);

alter table public.dossiers drop constraint dossiers_paid_ready;
alter table public.dossiers drop constraint dossiers_questionnaire_version_check;
alter table public.dossiers
  alter column user_id drop not null,
  alter column user_id drop default,
  alter column questionnaire_version set default 2,
  add column access_token text unique,
  add column email text;
alter table public.dossiers
  add constraint dossiers_questionnaire_version_check check (questionnaire_version in (1, 2)),
  add constraint dossiers_access_token_format check (access_token ~ '^[A-Za-z0-9_-]{43}$'),
  add constraint dossiers_email_length check (length(email) <= 320),
  add constraint dossiers_owner_or_link check (user_id is not null or access_token is not null),
  -- Première version : le dossier était généré avant d’être payé.
  add constraint dossiers_v1_paid_ready check (questionnaire_version = 2 or paid_at is null or statut = 'pret'),
  -- Version actuelle : aucune génération avant la confirmation du paiement.
  add constraint dossiers_generation_after_payment check (questionnaire_version = 1 or statut = 'brouillon' or paid_at is not null);

alter table public.responses drop constraint responses_question_id_check;
alter table public.responses add constraint responses_question_id_check check (question_id in (
  'tranche_age', 'cible_client', 'domaines', 'competences', 'temps_jour',
  'zone', 'facturation', 'concurrence', 'objectif_revenu',
  -- Questions de la première version, conservées pour l’historique.
  'temps_semaine', 'budget_depart', 'revenus_en_ligne', 'delai_premier_euro',
  'niveau_code', 'aisance_ia', 'niveau_design', 'niveau_vente', 'niveau_video',
  'secteur', 'communautes', 'audience', 'reseau_pro', 'langues',
  'montrer_visage', 'demarchage_froid', 'risque',
  'types_produits', 'taches_detestees', 'ambition'
));

alter table public.payments alter column user_id drop not null;
alter table public.payments add constraint payments_dossier_fk
  foreign key (dossier_id) references public.dossiers(id) on delete restrict;

-- Les réponses sont validées par le serveur ; la contrainte de questions
-- refuse encore tout identifiant inconnu.
create function public.start_checkout(p_answers jsonb, p_access_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_dossier uuid; v_payment uuid;
begin
  if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'Réponses invalides.'; end if;
  insert into public.dossiers (access_token) values (p_access_token) returning id into v_dossier;
  insert into public.responses (dossier_id, question_id, value)
    select v_dossier, key, value from jsonb_each(p_answers);
  insert into public.payments (dossier_id) values (v_dossier) returning id into v_payment;
  return jsonb_build_object('dossier_id', v_dossier, 'payment_id', v_payment);
end;
$$;

create function public.reserve_generation(p_dossier_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.dossiers; payload jsonb;
begin
  select * into d from public.dossiers where id = p_dossier_id for update;
  if not found then raise exception 'Dossier introuvable' using errcode = '42501'; end if;
  if d.paid_at is null or d.refunded_at is not null then
    raise exception 'Le paiement de ce dossier n’est pas confirmé.' using errcode = '55000';
  end if;
  if d.statut = 'pret' then raise exception 'Ce dossier est déjà prêt.' using errcode = '55000'; end if;
  if d.statut = 'generation' and d.generation_started_at > now() - interval '4 minutes' then
    raise exception 'La préparation de ce dossier est déjà en cours.' using errcode = '55000';
  end if;
  if d.generation_attempts >= 3 then
    raise exception 'La préparation de ce dossier a échoué trois fois. Contactez-nous.' using errcode = 'P0001';
  end if;
  select jsonb_object_agg(question_id, value) into payload from public.responses where dossier_id = d.id;
  update public.dossiers set statut = 'generation', generation_started_at = now(),
    generation_attempts = generation_attempts + 1, generated_at = null where id = d.id;
  return jsonb_build_object('attempt', d.generation_attempts + 1, 'answers', coalesce(payload, '{}'::jsonb));
end;
$$;

-- p_refunded_cents représente l’état courant Stripe de la charge, jamais une
-- addition d’événements. greatest() empêche les anciennes livraisons d’annuler
-- un remboursement confirmé. Un succès tardif ne retire jamais refunded_at.
create function public.apply_stripe_event(
  p_event_id text, p_event_type text, p_object_id text, p_created_at timestamptz,
  p_payment_id uuid, p_session_id text, p_intent_id text,
  p_paid boolean, p_refunded_cents integer default 0, p_expired boolean default false,
  p_paid_at timestamptz default null, p_email text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.payments; d public.dossiers; already_processed timestamptz;
  refunded integer; email_type text; payment_time timestamptz; refund_time timestamptz;
begin
  insert into public.stripe_events(event_id, type, object_id, payment_id, stripe_created_at)
    values (p_event_id, p_event_type, p_object_id, p_payment_id, p_created_at)
    on conflict (event_id) do nothing;
  select processed_at into already_processed from public.stripe_events where event_id = p_event_id for update;
  if already_processed is not null then return jsonb_build_object('duplicate', true); end if;
  -- Toujours le même ordre de verrouillage : dossier puis paiement.
  select * into p from public.payments where id = p_payment_id;
  if not found then raise exception 'Paiement introuvable'; end if;
  select * into d from public.dossiers where id = p.dossier_id for update;
  select * into p from public.payments where id = p_payment_id for update;
  if p.stripe_session_id is not null and p.stripe_session_id <> p_session_id then raise exception 'Session incohérente'; end if;
  if p.stripe_payment_intent_id is not null and p.stripe_payment_intent_id is distinct from p_intent_id then raise exception 'PaymentIntent incohérent'; end if;
  if p_refunded_cents < 0 or p_refunded_cents > p.montant then raise exception 'Montant remboursé invalide'; end if;
  refunded := greatest(p.montant_rembourse, p_refunded_cents);
  payment_time := coalesce(p.paid_at, p_paid_at, p_created_at);
  if p_paid then
    if p_session_id is null or p_intent_id is null then raise exception 'Références Stripe manquantes'; end if;
    if d.questionnaire_version = 1 and d.statut <> 'pret' then raise exception 'Dossier non prêt'; end if;
    refund_time := case when refunded = p.montant then coalesce(p.refunded_at, greatest(now(), payment_time)) else null end;
    update public.payments set stripe_session_id = p_session_id, stripe_payment_intent_id = p_intent_id,
      paid_at = payment_time, montant_rembourse = refunded, refunded_at = refund_time,
      statut = case when refunded = montant then 'rembourse' when refunded > 0 then 'rembourse_partiel' else 'paye' end
      where id = p.id;
    if d.paid_at is null or d.access_payment_id = p.id then
      if d.paid_at is null and refunded < p.montant then email_type := 'dossier_disponible'; end if;
      if refunded = p.montant and d.refunded_at is null then email_type := 'remboursement_recu'; end if;
      update public.dossiers set paid_at = coalesce(paid_at, payment_time), access_payment_id = p.id,
        email = coalesce(email, left(p_email, 320)),
        refunded_at = case when refunded = p.montant then coalesce(refunded_at, greatest(now(), payment_time)) else refunded_at end
        where id = d.id;
    end if;
  elsif p_expired and p.paid_at is null then
    update public.payments set statut = 'expire', stripe_session_id = coalesce(stripe_session_id, p_session_id) where id = p.id;
  end if;
  update public.stripe_events set processed_at = now(), email_kind = email_type where event_id = p_event_id;
  return jsonb_build_object('duplicate', false, 'email_kind', email_type, 'dossier_id', d.id);
end;
$$;

create or replace function public.claim_event_email(p_event_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e public.stripe_events; p public.payments; d public.dossiers; recipient text;
begin
  select * into e from public.stripe_events where event_id = p_event_id for update;
  if not found or e.email_kind is null or e.email_sent_at is not null or e.processed_at is null
    or e.email_attempts >= 8 or e.email_claimed_at > now() - interval '2 minutes' then return null; end if;
  select * into p from public.payments where id = e.payment_id;
  select * into d from public.dossiers where id = p.dossier_id;
  recipient := coalesce(d.email, (select email from public.profiles where id = p.user_id));
  if recipient is null then return null; end if;
  update public.stripe_events set email_claimed_at = now(), email_attempts = email_attempts + 1 where event_id = e.event_id;
  return jsonb_build_object('email', recipient, 'kind', e.email_kind, 'dossier_id', p.dossier_id,
    'access_token', d.access_token, 'payment_id', p.id, 'attempt', e.email_attempts + 1);
end;
$$;

revoke all on function public.start_checkout(jsonb, text) from public, anon, authenticated;
revoke all on function public.reserve_generation(uuid) from public, anon, authenticated;
revoke all on function public.apply_stripe_event(text, text, text, timestamptz, uuid, text, text, boolean, integer, boolean, timestamptz, text) from public, anon, authenticated;
grant execute on function public.start_checkout(jsonb, text) to service_role;
grant execute on function public.reserve_generation(uuid) to service_role;
grant execute on function public.apply_stripe_event(text, text, text, timestamptz, uuid, text, text, boolean, integer, boolean, timestamptz, text) to service_role;

commit;
