begin;

-- Identifie le paiement qui a ouvert le droit. Le remboursement d’un paiement
-- en double ne doit pas fermer le dossier payé par la première transaction.
alter table public.dossiers add column access_payment_id uuid references public.payments(id) on delete restrict;
alter table public.stripe_events add column email_claimed_at timestamptz;

-- Fonctions réservées au serveur : elles partagent le verrou utilisé par
-- save_response et publient toujours l’intégralité d’un résultat.
create function public.reserve_generation(p_dossier_id uuid, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.dossiers; payload jsonb; recent_attempts integer;
begin
  perform 1 from public.profiles where id = p_user_id for update;
  select * into d from public.dossiers where id = p_dossier_id and user_id = p_user_id for update;
  if not found then raise exception 'Dossier introuvable' using errcode = '42501'; end if;
  if d.statut = 'pret' then raise exception 'Ce dossier est déjà prêt.' using errcode = '55000'; end if;
  if d.statut = 'generation' and d.generation_started_at > now() - interval '4 minutes' then
    raise exception 'Une génération est déjà en cours.' using errcode = '55000';
  end if;
  if d.generation_attempts >= 3 then raise exception 'Les trois tentatives de ce dossier ont été utilisées. Crée un nouveau dossier.' using errcode = 'P0001'; end if;
  select coalesce(sum(generation_attempts), 0) into recent_attempts from public.dossiers
    where user_id = p_user_id and generation_started_at > now() - interval '24 hours';
  if recent_attempts >= 10 then raise exception 'La limite de génération quotidienne est atteinte. Reviens demain.' using errcode = 'P0001'; end if;
  select jsonb_object_agg(question_id, value) into payload from public.responses where dossier_id = d.id;
  if payload is null or (select count(*) from public.responses where dossier_id = d.id) <> 20 then
    raise exception 'Réponds aux vingt questions avant de lancer l’analyse.' using errcode = '55000';
  end if;
  update public.dossiers set statut = 'generation', generation_started_at = now(),
    generation_attempts = generation_attempts + 1, generated_at = null where id = d.id;
  return jsonb_build_object('attempt', d.generation_attempts + 1, 'answers', payload);
end;
$$;

create function public.publish_generation(p_dossier_id uuid, p_attempt integer, p_content jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare d public.dossiers; item jsonb; week integer;
begin
  select * into d from public.dossiers where id = p_dossier_id for update;
  if not found or d.statut <> 'generation' or d.generation_attempts <> p_attempt then return false; end if;
  if jsonb_typeof(p_content -> 'selections') is distinct from 'array'
    or jsonb_array_length(p_content -> 'selections') <> 3 then raise exception 'Trois sélections sont requises.'; end if;
  if jsonb_typeof(p_content -> 'tasks') is distinct from 'array' then raise exception 'Plan invalide.'; end if;
  for week in 1..4 loop
    if (select count(*) from jsonb_array_elements(p_content -> 'tasks') t where (t ->> 'semaine')::integer = week) not between 5 and 7
    then raise exception 'Chaque semaine doit contenir cinq à sept tâches.'; end if;
  end loop;
  delete from public.selections where dossier_id = d.id;
  delete from public.build_prompts where dossier_id = d.id;
  delete from public.plan_tasks where dossier_id = d.id;
  for item in select * from jsonb_array_elements(p_content -> 'selections') loop
    insert into public.selections(dossier_id, idea_id, idea_snapshot, rang, justification, adaptation, canal_acquisition, risque, reponses_citees)
    values (d.id, item ->> 'idea_id', item -> 'idea_snapshot', (item ->> 'rang')::smallint,
      item ->> 'justification', item ->> 'adaptation', item ->> 'canal_acquisition', item ->> 'risque', item -> 'reponses_citees');
  end loop;
  insert into public.build_prompts(dossier_id, contenu_md) values (d.id, p_content ->> 'build_prompt');
  for item in select * from jsonb_array_elements(p_content -> 'tasks') loop
    insert into public.plan_tasks(dossier_id, semaine, position, libelle)
      values (d.id, (item ->> 'semaine')::smallint, (item ->> 'position')::smallint, item ->> 'libelle');
  end loop;
  update public.dossiers set statut = 'pret', generated_at = now() where id = d.id;
  return true;
end;
$$;

create function public.fail_generation(p_dossier_id uuid, p_attempt integer, p_editable boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.dossiers set statut = case when p_editable then 'brouillon' else 'echec' end
    where id = p_dossier_id and statut = 'generation' and generation_attempts = p_attempt;
end;
$$;

create function public.reserve_checkout(p_dossier_id uuid, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.dossiers; p public.payments;
begin
  select * into d from public.dossiers where id = p_dossier_id and user_id = p_user_id for update;
  if not found then raise exception 'Dossier introuvable' using errcode = '42501'; end if;
  if d.statut <> 'pret' then raise exception 'Ton dossier doit être prêt avant le paiement.' using errcode = '55000'; end if;
  if d.paid_at is not null then raise exception 'Ce dossier a déjà été acheté.' using errcode = '55000'; end if;
  select * into p from public.payments where dossier_id = d.id and statut = 'en_attente' for update;
  if not found then
    insert into public.payments(user_id, dossier_id) values (p_user_id, d.id) returning * into p;
  end if;
  return to_jsonb(p);
end;
$$;

-- p_refunded_cents représente l’état courant Stripe de la charge, jamais une
-- addition d’événements. greatest() empêche les anciennes livraisons d’annuler
-- un remboursement confirmé. Un succès tardif ne retire jamais refunded_at.
create function public.apply_stripe_event(
  p_event_id text, p_event_type text, p_object_id text, p_created_at timestamptz,
  p_payment_id uuid, p_session_id text, p_intent_id text,
  p_paid boolean, p_refunded_cents integer default 0, p_expired boolean default false,
  p_paid_at timestamptz default null
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
  -- Toujours le même ordre de verrouillage que Checkout : dossier puis paiement.
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
    if d.statut <> 'pret' then raise exception 'Dossier non prêt'; end if;
    refund_time := case when refunded = p.montant then coalesce(p.refunded_at, greatest(now(), payment_time)) else null end;
    update public.payments set stripe_session_id = p_session_id, stripe_payment_intent_id = p_intent_id,
      paid_at = payment_time, montant_rembourse = refunded, refunded_at = refund_time,
      statut = case when refunded = montant then 'rembourse' when refunded > 0 then 'rembourse_partiel' else 'paye' end
      where id = p.id;
    if d.paid_at is null or d.access_payment_id = p.id then
      if d.paid_at is null and refunded < p.montant then email_type := 'dossier_disponible'; end if;
      if refunded = p.montant and d.refunded_at is null then email_type := 'remboursement_recu'; end if;
      update public.dossiers set paid_at = coalesce(paid_at, payment_time), access_payment_id = p.id,
        refunded_at = case when refunded = p.montant then coalesce(refunded_at, greatest(now(), payment_time)) else refunded_at end
        where id = d.id;
    end if;
  elsif p_expired and p.paid_at is null then
    update public.payments set statut = 'expire', stripe_session_id = coalesce(stripe_session_id, p_session_id) where id = p.id;
  end if;
  update public.stripe_events set processed_at = now(), email_kind = email_type where event_id = p_event_id;
  return jsonb_build_object('duplicate', false, 'email_kind', email_type);
end;
$$;

create function public.claim_event_email(p_event_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e public.stripe_events; p public.payments; recipient text;
begin
  select * into e from public.stripe_events where event_id = p_event_id for update;
  if not found or e.email_kind is null or e.email_sent_at is not null or e.processed_at is null
    or e.email_attempts >= 8 or e.email_claimed_at > now() - interval '2 minutes' then return null; end if;
  select * into p from public.payments where id = e.payment_id;
  select email into recipient from public.profiles where id = p.user_id;
  if recipient is null then return null; end if;
  update public.stripe_events set email_claimed_at = now(), email_attempts = email_attempts + 1 where event_id = e.event_id;
  return jsonb_build_object('email', recipient, 'kind', e.email_kind, 'dossier_id', p.dossier_id,
    'payment_id', p.id, 'attempt', e.email_attempts + 1);
end;
$$;

revoke all on function public.reserve_generation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.publish_generation(uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.fail_generation(uuid, integer, boolean) from public, anon, authenticated;
revoke all on function public.reserve_checkout(uuid, uuid) from public, anon, authenticated;
revoke all on function public.apply_stripe_event(text, text, text, timestamptz, uuid, text, text, boolean, integer, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_event_email(text) from public, anon, authenticated;
grant execute on function public.reserve_generation(uuid, uuid) to service_role;
grant execute on function public.publish_generation(uuid, integer, jsonb) to service_role;
grant execute on function public.fail_generation(uuid, integer, boolean) to service_role;
grant execute on function public.reserve_checkout(uuid, uuid) to service_role;
grant execute on function public.apply_stripe_event(text, text, text, timestamptz, uuid, text, text, boolean, integer, boolean, timestamptz) to service_role;
grant execute on function public.claim_event_email(text) to service_role;

commit;
