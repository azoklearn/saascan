-- SaaScan — proposition de schéma initial, à valider avant application.
-- Cible : projet Supabase neuf ; exécution future par le rôle de migration.
-- Ce fichier n’a pas été appliqué à une base.
-- Les transactions métier de génération et de paiement sont prévues dans
-- une seconde migration, après validation. Aucune clé API n’est stockée ici.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.dossiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  statut text not null default 'brouillon'
    check (statut in ('brouillon', 'generation', 'pret', 'echec')),
  questionnaire_version smallint not null default 1
    check (questionnaire_version = 1),
  ideas_version text not null default 'v1',
  generation_attempts integer not null default 0
    check (generation_attempts >= 0),
  generation_started_at timestamptz,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz,
  constraint dossiers_owner_key unique (id, user_id),
  constraint dossiers_ready_timestamp check (
    (statut = 'pret') = (generated_at is not null)
  ),
  constraint dossiers_generation_started check (
    statut <> 'generation' or generation_started_at is not null
  ),
  constraint dossiers_paid_ready check (paid_at is null or statut = 'pret'),
  constraint dossiers_refund_after_payment check (
    refunded_at is null or (paid_at is not null and refunded_at >= paid_at)
  )
);

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  question_id text not null check (question_id in (
    'temps_semaine', 'budget_depart', 'revenus_en_ligne', 'delai_premier_euro',
    'niveau_code', 'aisance_ia', 'niveau_design', 'niveau_vente', 'niveau_video',
    'secteur', 'communautes', 'audience', 'reseau_pro', 'langues',
    'montrer_visage', 'demarchage_froid', 'risque',
    'types_produits', 'taches_detestees', 'ambition'
  )),
  value jsonb not null check (
    value <> 'null'::jsonb and octet_length(value::text) <= 8192
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dossier_id, question_id)
);

create table public.selections (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  -- Référence au JSON versionné, contrôlée côté serveur.
  idea_id text not null check (idea_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  idea_snapshot jsonb not null check (jsonb_typeof(idea_snapshot) = 'object'),
  rang smallint not null check (rang between 1 and 3),
  justification text not null check (length(btrim(justification)) > 0),
  adaptation text not null check (length(btrim(adaptation)) > 0),
  canal_acquisition text not null check (length(btrim(canal_acquisition)) > 0),
  risque text not null check (length(btrim(risque)) > 0),
  -- Liste structurée { question_id, reponse, effet }, validée avec Zod.
  reponses_citees jsonb not null check (
    jsonb_typeof(reponses_citees) = 'array'
  ),
  created_at timestamptz not null default now(),
  unique (dossier_id, rang),
  unique (dossier_id, idea_id)
);

create table public.build_prompts (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null unique
    references public.dossiers(id) on delete cascade,
  contenu_md text not null,
  -- Même convention que le validateur TS : segments séparés par espace.
  word_count integer generated always as (
    cardinality(regexp_split_to_array(btrim(contenu_md), '[[:space:]]+'))
  ) stored,
  created_at timestamptz not null default now(),
  check (word_count between 700 and 900)
);

create table public.plan_tasks (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  semaine smallint not null check (semaine between 1 and 4),
  position smallint not null check (position between 1 and 7),
  libelle text not null check (length(btrim(libelle)) > 0),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dossier_id, semaine, position)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  dossier_id uuid not null,
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  -- Unité explicite : centimes. Un paiement SaaScan est de 39 €.
  montant integer not null default 3900 check (montant = 3900),
  devise text not null default 'eur' check (devise = 'eur'),
  statut text not null default 'en_attente' check (
    statut in ('en_attente', 'paye', 'expire', 'echoue', 'rembourse_partiel', 'rembourse')
  ),
  montant_rembourse integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz,
  constraint payments_dossier_owner_fk foreign key (dossier_id, user_id)
    references public.dossiers(id, user_id) on delete restrict,
  constraint payments_refund_amount check (
    montant_rembourse between 0 and montant
  ),
  constraint payments_paid_timestamp check (
    (statut in ('paye', 'rembourse_partiel', 'rembourse')) = (paid_at is not null)
  ),
  constraint payments_paid_reference check (
    paid_at is null or
    (stripe_session_id is not null and stripe_payment_intent_id is not null)
  ),
  constraint payments_refund_state check (
    (statut = 'rembourse' and montant_rembourse = montant and refunded_at is not null)
    or (statut = 'rembourse_partiel' and montant_rembourse > 0
      and montant_rembourse < montant and refunded_at is null)
    or (statut not in ('rembourse', 'rembourse_partiel')
      and montant_rembourse = 0 and refunded_at is null)
  ),
  constraint payments_refund_after_payment check (
    refunded_at is null or (paid_at is not null and refunded_at >= paid_at)
  )
);

-- Une tentative ouverte par dossier. Les succès multiples éventuels restent
-- enregistrables pour traiter un double paiement réel sans perdre sa trace.
create unique index payments_one_pending_per_dossier
  on public.payments(dossier_id) where statut = 'en_attente';

create table public.stripe_events (
  event_id text primary key,
  type text not null,
  object_id text not null,
  payment_id uuid references public.payments(id) on delete restrict,
  stripe_created_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  email_kind text check (email_kind in ('dossier_disponible', 'remboursement_recu')),
  email_sent_at timestamptz,
  email_attempts integer not null default 0 check (email_attempts >= 0),
  check (email_sent_at is null or (email_kind is not null and processed_at is not null))
);

-- Index : liste des dossiers, lectures RLS, reprise et suivi serveur.
-- Les contraintes UNIQUE précédentes indexent déjà les FK dossier des contenus.
create index dossiers_user_created_idx on public.dossiers(user_id, created_at desc);
create index dossiers_generation_idx on public.dossiers(generation_started_at)
  where statut = 'generation';
create index payments_user_created_idx on public.payments(user_id, created_at desc);
create index payments_dossier_idx on public.payments(dossier_id, user_id);
create index stripe_events_payment_idx on public.stripe_events(payment_id);
create index stripe_events_email_retry_idx on public.stripe_events(received_at)
  where email_kind is not null and email_sent_at is null and processed_at is not null;

-- Timestamps produits par Postgres, jamais acceptés depuis le navigateur.
create function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger dossiers_touch before update on public.dossiers
  for each row execute function private.touch_updated_at();
create trigger responses_touch before update on public.responses
  for each row execute function private.touch_updated_at();
create trigger plan_tasks_touch before update on public.plan_tasks
  for each row execute function private.touch_updated_at();
create trigger payments_touch before update on public.payments
  for each row execute function private.touch_updated_at();

-- Le profil suit l’email vérifié dans Supabase Auth.
create function private.sync_auth_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger auth_user_profile_insert after insert on auth.users
  for each row execute function private.sync_auth_profile();
create trigger auth_user_profile_email after update of email on auth.users
  for each row execute function private.sync_auth_profile();

-- Projet email-only. Reprise des comptes éventuels déjà présents.
insert into public.profiles (id, email)
  select id, email from auth.users where email is not null
  on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.dossiers enable row level security;
alter table public.responses enable row level security;
alter table public.selections enable row level security;
alter table public.build_prompts enable row level security;
alter table public.plan_tasks enable row level security;
alter table public.payments enable row level security;
alter table public.stripe_events enable row level security;

-- Retirer les privilèges par défaut AVANT d’accorder les droits nécessaires.
revoke all on table public.profiles, public.dossiers, public.responses,
  public.selections, public.build_prompts, public.plan_tasks,
  public.payments, public.stripe_events from public, anon, authenticated;

grant select on table public.profiles, public.dossiers, public.responses,
  public.selections, public.build_prompts, public.plan_tasks,
  public.payments to authenticated;

grant insert (user_id) on public.dossiers to authenticated;
grant update (done) on public.plan_tasks to authenticated;

grant all on table public.profiles, public.dossiers, public.responses,
  public.selections, public.build_prompts, public.plan_tasks,
  public.payments, public.stripe_events to service_role;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy dossiers_select_own on public.dossiers
  for select to authenticated using (user_id = (select auth.uid()));

create policy dossiers_insert_own_draft on public.dossiers
  for insert to authenticated with check (
    user_id = (select auth.uid()) and statut = 'brouillon'
    and paid_at is null and refunded_at is null
    and generated_at is null and generation_attempts = 0
  );

create policy responses_select_own on public.responses
  for select to authenticated using (
    exists (
      select 1 from public.dossiers d
      where d.id = responses.dossier_id and d.user_id = (select auth.uid())
    )
  );

create policy selections_select_paid on public.selections
  for select to authenticated using (
    exists (
      select 1 from public.dossiers d
      where d.id = selections.dossier_id and d.user_id = (select auth.uid())
        and d.statut = 'pret' and d.paid_at is not null and d.refunded_at is null
    )
  );

create policy build_prompts_select_paid on public.build_prompts
  for select to authenticated using (
    exists (
      select 1 from public.dossiers d
      where d.id = build_prompts.dossier_id and d.user_id = (select auth.uid())
        and d.statut = 'pret' and d.paid_at is not null and d.refunded_at is null
    )
  );

create policy plan_tasks_select_paid on public.plan_tasks
  for select to authenticated using (
    exists (
      select 1 from public.dossiers d
      where d.id = plan_tasks.dossier_id and d.user_id = (select auth.uid())
        and d.statut = 'pret' and d.paid_at is not null and d.refunded_at is null
    )
  );

create policy plan_tasks_update_paid on public.plan_tasks
  for update to authenticated using (
    exists (
      select 1 from public.dossiers d
      where d.id = plan_tasks.dossier_id and d.user_id = (select auth.uid())
        and d.statut = 'pret' and d.paid_at is not null and d.refunded_at is null
    )
  ) with check (
    exists (
      select 1 from public.dossiers d
      where d.id = plan_tasks.dossier_id and d.user_id = (select auth.uid())
        and d.statut = 'pret' and d.paid_at is not null and d.refunded_at is null
    )
  );

create policy payments_select_own on public.payments
  for select to authenticated using (user_id = (select auth.uid()));

-- Pas de policy client sur stripe_events ; aucun privilège client non plus.
-- Pas d’INSERT/UPDATE client sur les contenus générés ni les paiements.
-- Les suppressions et l’effacement de compte seront gérés côté serveur.
-- Les FK RESTRICT des paiements empêchent de supprimer leur historique par cascade.

-- Seule écriture de réponse exposée aux utilisateurs. SECURITY DEFINER est
-- volontaire : aucun INSERT/UPDATE direct n’est accordé sur responses.
-- Vérification d’identité explicite et verrou identique à celui que prendra
-- la transaction serveur de réservation de génération.
create function public.save_response(
  p_dossier_id uuid,
  p_question_id text,
  p_value jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_statut text;
begin
  if v_user_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  select d.statut into v_statut
  from public.dossiers d
  where d.id = p_dossier_id and d.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Dossier introuvable' using errcode = '42501';
  end if;
  if v_statut <> 'brouillon' then
    raise exception 'Ce questionnaire est verrouillé' using errcode = '55000';
  end if;

  insert into public.responses (dossier_id, question_id, value)
  values (p_dossier_id, p_question_id, p_value)
  on conflict (dossier_id, question_id) do update
    set value = excluded.value;

  update public.dossiers set updated_at = now() where id = p_dossier_id;
end;
$$;

-- Ne pas laisser les privilèges EXECUTE implicites des fonctions definer.
revoke all on function private.touch_updated_at() from public, anon, authenticated;
revoke all on function private.sync_auth_profile() from public, anon, authenticated;
revoke all on function public.save_response(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_response(uuid, text, jsonb) to authenticated;

-- Invariants multi-lignes à vérifier dans les transactions serveur futures :
-- 1. Vingt réponses valides avant réservation, quota et verrou FOR UPDATE.
-- 2. Au moment de publier : trois sélections, un prompt, quatre semaines de
--    cinq à sept tâches, version de tentative toujours courante.
-- 3. Session Stripe rapprochée du paiement créé par le serveur ; événement,
--    paiement et droit paid_at/refunded_at modifiés dans une seule transaction.
-- 4. Aucun événement ancien ne réactive un droit totalement remboursé.
-- Les fonctions de ces opérations n’auront EXECUTE que pour service_role.

commit;
