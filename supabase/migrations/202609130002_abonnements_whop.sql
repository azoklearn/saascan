-- Abonnements Whop : une formule renouvelée (1, 3 ou 12 mois) ouvre un dossier
-- unique, consultable tant que l’abonnement reste valide. Les formules 3 et 12
-- mois ajoutent des idées de vidéos marketing, et la formule 12 mois un plan de
-- A à Z. Paiements et journal d’événements deviennent indépendants du prestataire.

begin;

drop function public.apply_stripe_event(text, text, text, timestamptz, uuid, text, text, boolean, integer, boolean, timestamptz, text);
drop function public.start_checkout(jsonb, text);

alter table public.stripe_events rename to payment_events;
alter table public.payment_events rename column stripe_created_at to provider_created_at;
alter table public.payment_events add column dossier_id uuid references public.dossiers(id) on delete restrict;
alter index public.stripe_events_payment_idx rename to payment_events_payment_idx;
alter index public.stripe_events_email_retry_idx rename to payment_events_email_retry_idx;

alter table public.payments rename column stripe_session_id to checkout_id;
alter table public.payments rename column stripe_payment_intent_id to provider_payment_id;
alter table public.payments rename constraint payments_stripe_session_id_key to payments_checkout_id_key;
alter table public.payments rename constraint payments_stripe_payment_intent_id_key to payments_provider_payment_id_key;
alter table public.payments drop constraint payments_montant_check;
alter table public.payments drop constraint payments_paid_reference;
alter table public.payments alter column montant drop default;
alter table public.payments
  add column formule text check (formule in ('mensuel', 'trimestriel', 'annuel')),
  add column renouvellement boolean not null default false,
  add constraint payments_montant_check check (montant > 0),
  -- Un renouvellement n’a pas de passage en caisse : seule la référence Whop est exigée.
  add constraint payments_paid_reference check (paid_at is null or provider_payment_id is not null);

alter table public.dossiers
  add column formule text check (formule in ('mensuel', 'trimestriel', 'annuel')),
  add column membership_id text unique,
  add column membership_status text,
  add column cancel_at_period_end boolean not null default false,
  add column current_period_end timestamptz,
  add column membership_synced_at timestamptz,
  add column extras_attempts integer not null default 0 check (extras_attempts >= 0),
  add column extras_started_at timestamptz,
  add column videos_started_at timestamptz;

create table public.marketing_videos (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  lot smallint not null check (lot >= 1),
  position smallint not null check (position between 1 and 30),
  plateforme text not null check (length(btrim(plateforme)) > 0),
  format text not null check (length(btrim(format)) > 0),
  accroche text not null check (length(btrim(accroche)) > 0),
  deroule text not null check (length(btrim(deroule)) > 0),
  appel_action text not null check (length(btrim(appel_action)) > 0),
  created_at timestamptz not null default now(),
  unique (dossier_id, lot, position)
);

create table public.launch_roadmaps (
  dossier_id uuid primary key references public.dossiers(id) on delete cascade,
  phases jsonb not null check (jsonb_typeof(phases) = 'array' and jsonb_array_length(phases) between 6 and 8),
  created_at timestamptz not null default now()
);

-- Rappel avant la reconduction d’une formule de 3 ou 12 mois (article L215-1 du Code de la consommation).
create table public.renewal_reminders (
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  period_end timestamptz not null,
  created_at timestamptz not null default now(),
  email_claimed_at timestamptz,
  email_sent_at timestamptz,
  email_attempts integer not null default 0 check (email_attempts >= 0),
  primary key (dossier_id, period_end)
);

alter table public.marketing_videos enable row level security;
alter table public.launch_roadmaps enable row level security;
alter table public.renewal_reminders enable row level security;
revoke all on table public.marketing_videos, public.launch_roadmaps, public.renewal_reminders from public, anon, authenticated;
grant all on table public.marketing_videos, public.launch_roadmaps, public.renewal_reminders to service_role;

create function public.start_checkout(p_answers jsonb, p_access_token text, p_formule text, p_montant integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_dossier uuid; v_payment uuid;
begin
  if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'Réponses invalides.'; end if;
  insert into public.dossiers (access_token, formule) values (p_access_token, p_formule) returning id into v_dossier;
  insert into public.responses (dossier_id, question_id, value)
    select v_dossier, key, value from jsonb_each(p_answers);
  insert into public.payments (dossier_id, montant, formule) values (v_dossier, p_montant, p_formule) returning id into v_payment;
  return jsonb_build_object('dossier_id', v_dossier, 'payment_id', v_payment);
end;
$$;

-- Nouveau passage en caisse pour un dossier dont l’abonnement est terminé.
create function public.reopen_checkout(p_dossier_id uuid, p_formule text, p_montant integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.dossiers; p public.payments;
begin
  select * into d from public.dossiers where id = p_dossier_id for update;
  if not found then raise exception 'Dossier introuvable' using errcode = '42501'; end if;
  if d.paid_at is null or d.refunded_at is not null then raise exception 'Ce dossier ne peut pas être réactivé.' using errcode = '55000'; end if;
  if d.membership_status = any(array['active', 'trialing', 'past_due', 'canceling']) then
    raise exception 'Votre abonnement est toujours actif.' using errcode = '55000';
  end if;
  select * into p from public.payments where dossier_id = d.id and statut = 'en_attente' for update;
  if found then
    update public.payments set montant = p_montant, formule = p_formule, checkout_id = null where id = p.id;
  else
    insert into public.payments (dossier_id, montant, formule) values (d.id, p_montant, p_formule) returning * into p;
  end if;
  return jsonb_build_object('dossier_id', d.id, 'payment_id', p.id);
end;
$$;

-- p_membership reprend l’état relu chez Whop. Un état plus ancien ne remplace
-- pas un état plus récent, et un abonnement terminé ne remplace pas celui qui
-- l’a réactivé.
create function private.apply_membership(p_dossier_id uuid, p_membership jsonb)
returns void language plpgsql set search_path = '' as $$
declare synced timestamptz := (p_membership ->> 'synced_at')::timestamptz;
begin
  update public.dossiers set membership_id = p_membership ->> 'id', membership_status = p_membership ->> 'status',
    cancel_at_period_end = coalesce((p_membership ->> 'cancel_at_period_end')::boolean, false),
    current_period_end = (p_membership ->> 'current_period_end')::timestamptz,
    formule = coalesce(p_membership ->> 'formule', formule), membership_synced_at = synced
  where id = p_dossier_id and synced is not null
    and (membership_synced_at is null or membership_synced_at <= synced)
    and (membership_id is null or membership_id = p_membership ->> 'id'
      or not coalesce(membership_status = any(array['active', 'trialing', 'past_due', 'canceling']), false));
end;
$$;

create function public.sync_membership(p_dossier_id uuid, p_membership jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.dossiers where id = p_dossier_id for update;
  perform private.apply_membership(p_dossier_id, p_membership);
end;
$$;

-- p_payment représente l’état actuel du paiement chez Whop, jamais une addition
-- d’événements. Un remboursement confirmé n’est jamais annulé par une livraison
-- tardive, et seul le premier paiement ouvre le dossier et sa génération.
create function public.apply_whop_event(
  p_event_id text, p_event_type text, p_object_id text, p_created_at timestamptz,
  p_dossier_id uuid, p_payment jsonb default null, p_membership jsonb default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.dossiers; p public.payments; processed timestamptz; email_type text;
  total integer; refunded integer; payment_time timestamptz; first_payment boolean := false;
begin
  insert into public.payment_events(event_id, type, object_id, dossier_id, provider_created_at)
    values (p_event_id, p_event_type, p_object_id, p_dossier_id, p_created_at)
    on conflict (event_id) do nothing;
  select processed_at into processed from public.payment_events where event_id = p_event_id for update;
  if processed is not null then return jsonb_build_object('duplicate', true); end if;
  -- Toujours le même ordre de verrouillage : dossier puis paiement.
  select * into d from public.dossiers where id = p_dossier_id for update;
  if not found then raise exception 'Dossier introuvable'; end if;

  if p_membership is not null then perform private.apply_membership(d.id, p_membership); end if;

  if p_payment is not null then
    total := (p_payment ->> 'total_cents')::integer;
    if total is null or total <= 0 or p_payment ->> 'id' is null then raise exception 'Paiement Whop invalide'; end if;
    select * into p from public.payments where provider_payment_id = p_payment ->> 'id' for update;
    if not found and p_payment ->> 'local_id' is not null then
      select * into p from public.payments where id = (p_payment ->> 'local_id')::uuid and provider_payment_id is null for update;
    end if;
    if not found then
      insert into public.payments (dossier_id, montant, formule, renouvellement)
        values (d.id, total, p_payment ->> 'formule', true) returning * into p;
    end if;
    if p.dossier_id <> d.id then raise exception 'Paiement rattaché à un autre dossier'; end if;
    refunded := least(total, greatest(p.montant_rembourse, coalesce((p_payment ->> 'refunded_cents')::integer, 0)));
    payment_time := coalesce(p.paid_at, (p_payment ->> 'paid_at')::timestamptz, p_created_at);
    update public.payments set provider_payment_id = p_payment ->> 'id', montant = total,
      formule = coalesce(p_payment ->> 'formule', formule), paid_at = payment_time, montant_rembourse = refunded,
      refunded_at = case when refunded = total then coalesce(refunded_at, greatest(now(), payment_time)) end,
      statut = case when refunded = total then 'rembourse' when refunded > 0 then 'rembourse_partiel' else 'paye' end
      where id = p.id;
    if d.paid_at is null then
      first_payment := refunded < total;
      if first_payment then email_type := 'dossier_disponible'; end if;
      update public.dossiers set paid_at = payment_time, access_payment_id = p.id,
        email = coalesce(email, left(p_payment ->> 'email', 320)), formule = coalesce(p_payment ->> 'formule', formule),
        refunded_at = case when refunded = total then greatest(now(), payment_time) end
        where id = d.id;
    elsif d.access_payment_id = p.id and refunded = total and d.refunded_at is null then
      email_type := 'remboursement_recu';
      update public.dossiers set refunded_at = greatest(now(), payment_time) where id = d.id;
    end if;
  end if;

  update public.payment_events set processed_at = now(), email_kind = email_type, payment_id = p.id where event_id = p_event_id;
  select * into d from public.dossiers where id = d.id;
  return jsonb_build_object('duplicate', false, 'email_kind', email_type, 'first_payment', first_payment,
    'refunded', d.refunded_at is not null, 'membership_id', d.membership_id);
end;
$$;

create or replace function public.claim_event_email(p_event_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e public.payment_events; p public.payments; d public.dossiers;
begin
  select * into e from public.payment_events where event_id = p_event_id for update;
  if not found or e.email_kind is null or e.email_sent_at is not null or e.processed_at is null
    or e.email_attempts >= 8 or e.email_claimed_at > now() - interval '2 minutes' then return null; end if;
  select * into p from public.payments where id = e.payment_id;
  select * into d from public.dossiers where id = coalesce(e.dossier_id, p.dossier_id);
  if d.email is null then return null; end if;
  update public.payment_events set email_claimed_at = now(), email_attempts = email_attempts + 1 where event_id = e.event_id;
  return jsonb_build_object('email', d.email, 'kind', e.email_kind, 'dossier_id', d.id, 'access_token', d.access_token,
    'payment_id', p.id, 'amount_cents', p.montant, 'formule', d.formule, 'attempt', e.email_attempts + 1);
end;
$$;

-- Les bonus (vidéos et plan de A à Z) suivent la publication du dossier.
create function public.reserve_extras(p_dossier_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.dossiers; needs_videos boolean; needs_roadmap boolean;
begin
  select * into d from public.dossiers where id = p_dossier_id for update;
  if not found then raise exception 'Dossier introuvable' using errcode = '42501'; end if;
  if d.paid_at is null or d.refunded_at is not null or d.statut <> 'pret' then
    raise exception 'Les bonus sont préparés après votre dossier.' using errcode = '55000';
  end if;
  needs_videos := d.formule in ('trimestriel', 'annuel') and not exists (select 1 from public.marketing_videos where dossier_id = d.id and lot = 1);
  needs_roadmap := d.formule = 'annuel' and not exists (select 1 from public.launch_roadmaps where dossier_id = d.id);
  if not (needs_videos or needs_roadmap) then raise exception 'Les bonus de votre formule sont déjà prêts.' using errcode = '55000'; end if;
  if d.extras_started_at > now() - interval '4 minutes' then raise exception 'La préparation des bonus est déjà en cours.' using errcode = '55000'; end if;
  if d.extras_attempts >= 3 then raise exception 'La préparation des bonus a échoué trois fois. Contactez-nous.' using errcode = 'P0001'; end if;
  update public.dossiers set extras_started_at = now(), extras_attempts = extras_attempts + 1 where id = d.id;
  return jsonb_build_object('attempt', d.extras_attempts + 1, 'videos', needs_videos, 'roadmap', needs_roadmap,
    'answers', coalesce((select jsonb_object_agg(question_id, value) from public.responses where dossier_id = d.id), '{}'::jsonb),
    'idea_id', (select idea_id from public.selections where dossier_id = d.id and rang = 1));
end;
$$;

create function public.publish_extras(p_dossier_id uuid, p_attempt integer, p_content jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare d public.dossiers; item jsonb; i integer := 0;
begin
  select * into d from public.dossiers where id = p_dossier_id for update;
  if not found or d.extras_started_at is null or d.extras_attempts <> p_attempt then return false; end if;
  if jsonb_typeof(p_content -> 'videos') = 'array' then
    if jsonb_array_length(p_content -> 'videos') <> 30 then raise exception 'Trente idées de vidéos sont requises.'; end if;
    delete from public.marketing_videos where dossier_id = d.id and lot = 1;
    for item in select * from jsonb_array_elements(p_content -> 'videos') loop
      i := i + 1;
      insert into public.marketing_videos (dossier_id, lot, position, plateforme, format, accroche, deroule, appel_action)
        values (d.id, 1, i, item ->> 'plateforme', item ->> 'format', item ->> 'accroche', item ->> 'deroule', item ->> 'appel_action');
    end loop;
  end if;
  if jsonb_typeof(p_content -> 'roadmap') = 'array' then
    insert into public.launch_roadmaps (dossier_id, phases) values (d.id, p_content -> 'roadmap')
      on conflict (dossier_id) do update set phases = excluded.phases, created_at = now();
  end if;
  update public.dossiers set extras_started_at = null where id = d.id;
  return true;
end;
$$;

create function public.fail_extras(p_dossier_id uuid, p_attempt integer)
returns void language sql security definer set search_path = '' as $$
  update public.dossiers set extras_started_at = null where id = p_dossier_id and extras_attempts = p_attempt;
$$;

-- Formule 12 mois : dix nouvelles idées de vidéos par période de 24 heures.
create function public.reserve_video_batch(p_dossier_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.dossiers;
begin
  select * into d from public.dossiers where id = p_dossier_id for update;
  if not found then raise exception 'Dossier introuvable' using errcode = '42501'; end if;
  if d.formule is distinct from 'annuel' or d.paid_at is null or d.refunded_at is not null or d.statut <> 'pret'
    or not coalesce(d.membership_status = any(array['active', 'trialing', 'past_due', 'canceling']), true) then
    raise exception 'Les nouvelles idées de vidéos sont réservées à la formule 12 mois active.' using errcode = '55000';
  end if;
  if not exists (select 1 from public.marketing_videos where dossier_id = d.id and lot = 1) then
    raise exception 'Vos 30 premières idées de vidéos sont en préparation.' using errcode = '55000';
  end if;
  if d.videos_started_at > now() - interval '4 minutes' then raise exception 'De nouvelles idées sont déjà en préparation.' using errcode = '55000'; end if;
  if (select max(created_at) from public.marketing_videos where dossier_id = d.id and lot > 1) > now() - interval '24 hours' then
    raise exception 'Vous avez déjà reçu vos nouvelles idées du jour. Revenez demain.' using errcode = 'P0001';
  end if;
  update public.dossiers set videos_started_at = now() where id = d.id;
  return jsonb_build_object('lot', (select max(lot) + 1 from public.marketing_videos where dossier_id = d.id),
    'hooks', (select jsonb_agg(accroche order by lot, position) from public.marketing_videos where dossier_id = d.id),
    'answers', coalesce((select jsonb_object_agg(question_id, value) from public.responses where dossier_id = d.id), '{}'::jsonb),
    'idea_id', (select idea_id from public.selections where dossier_id = d.id and rang = 1));
end;
$$;

create function public.publish_video_batch(p_dossier_id uuid, p_lot integer, p_videos jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare d public.dossiers; item jsonb; i integer := 0;
begin
  select * into d from public.dossiers where id = p_dossier_id for update;
  if not found or d.videos_started_at is null or p_lot < 2
    or exists (select 1 from public.marketing_videos where dossier_id = d.id and lot = p_lot) then return false; end if;
  if jsonb_typeof(p_videos) is distinct from 'array' or jsonb_array_length(p_videos) <> 10 then raise exception 'Dix idées de vidéos sont requises.'; end if;
  for item in select * from jsonb_array_elements(p_videos) loop
    i := i + 1;
    insert into public.marketing_videos (dossier_id, lot, position, plateforme, format, accroche, deroule, appel_action)
      values (d.id, p_lot, i, item ->> 'plateforme', item ->> 'format', item ->> 'accroche', item ->> 'deroule', item ->> 'appel_action');
  end loop;
  update public.dossiers set videos_started_at = null where id = d.id;
  return true;
end;
$$;

create function public.fail_video_batch(p_dossier_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.dossiers set videos_started_at = null where id = p_dossier_id;
$$;

create function public.queue_renewal_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare queued integer;
begin
  insert into public.renewal_reminders (dossier_id, period_end)
    select id, current_period_end from public.dossiers
    where formule in ('trimestriel', 'annuel') and paid_at is not null and refunded_at is null and email is not null
      and membership_status in ('active', 'trialing', 'past_due') and not cancel_at_period_end
      -- Entre un et trois mois avant l’échéance, avec une marge pour une tâche quotidienne manquée.
      and current_period_end between now() + interval '35 days' and now() + interval '50 days'
    on conflict do nothing;
  get diagnostics queued = row_count;
  return queued;
end;
$$;

create function public.claim_renewal_reminder(p_dossier_id uuid, p_period_end timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.renewal_reminders; d public.dossiers;
begin
  select * into r from public.renewal_reminders where dossier_id = p_dossier_id and period_end = p_period_end for update;
  if not found or r.email_sent_at is not null or r.email_attempts >= 8 or r.email_claimed_at > now() - interval '2 minutes' then return null; end if;
  select * into d from public.dossiers where id = r.dossier_id;
  -- Abonnement résilié, remboursé ou déjà renouvelé : le rappel n’a plus d’objet.
  if d.email is null or d.cancel_at_period_end or d.refunded_at is not null or d.current_period_end is distinct from r.period_end then
    update public.renewal_reminders set email_attempts = 8 where dossier_id = r.dossier_id and period_end = r.period_end;
    return null;
  end if;
  update public.renewal_reminders set email_claimed_at = now(), email_attempts = email_attempts + 1
    where dossier_id = r.dossier_id and period_end = r.period_end;
  return jsonb_build_object('email', d.email, 'access_token', d.access_token, 'formule', d.formule,
    'period_end', r.period_end, 'attempt', r.email_attempts + 1);
end;
$$;

revoke all on function private.apply_membership(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.start_checkout(jsonb, text, text, integer), public.reopen_checkout(uuid, text, integer),
  public.sync_membership(uuid, jsonb), public.apply_whop_event(text, text, text, timestamptz, uuid, jsonb, jsonb),
  public.reserve_extras(uuid), public.publish_extras(uuid, integer, jsonb), public.fail_extras(uuid, integer),
  public.reserve_video_batch(uuid), public.publish_video_batch(uuid, integer, jsonb), public.fail_video_batch(uuid),
  public.queue_renewal_reminders(), public.claim_renewal_reminder(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.start_checkout(jsonb, text, text, integer), public.reopen_checkout(uuid, text, integer),
  public.sync_membership(uuid, jsonb), public.apply_whop_event(text, text, text, timestamptz, uuid, jsonb, jsonb),
  public.reserve_extras(uuid), public.publish_extras(uuid, integer, jsonb), public.fail_extras(uuid, integer),
  public.reserve_video_batch(uuid), public.publish_video_batch(uuid, integer, jsonb), public.fail_video_batch(uuid),
  public.queue_renewal_reminders(), public.claim_renewal_reminder(uuid, timestamptz)
  to service_role;

commit;
