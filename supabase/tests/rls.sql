-- Exécuter avec psql contre une base Supabase locale migrée :
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
-- Toutes les données de test sont annulées à la fin.
begin;

create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin if condition is distinct from true then raise exception 'ÉCHEC : %', message; end if; end;
$$;
create function pg_temp.dossier_id(token text) returns uuid language sql stable as $$
  select id from public.dossiers where access_token = token;
$$;
create function pg_temp.pending_payment(token text) returns uuid language sql stable as $$
  select p.id from public.payments p join public.dossiers d on d.id = p.dossier_id where d.access_token = token and p.statut = 'en_attente';
$$;
create function pg_temp.user_id(n integer) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000000' || n)::uuid;
$$;
create function pg_temp.videos(amount integer) returns jsonb language sql stable as $$
  select jsonb_agg(jsonb_build_object('plateforme', 'TikTok', 'format', 'Face caméra', 'accroche', 'Accroche ' || i,
    'deroule', 'Déroulé de la vidéo', 'appel_action', 'Essayez gratuitement')) from generate_series(1, amount) i;
$$;
create function pg_temp.answers() returns jsonb language sql immutable as $$
  select '{"tranche_age":"25_34","cible_client":"b2b","domaines":["vente","productivite"],"competences":"sans_code","temps_jour":"1h","zone":"francophone","facturation":"abonnement","concurrence":"differencier","objectif_revenu":"2000"}'::jsonb;
$$;

-- Comptes Supabase Auth : le déclencheur de la première migration crée leur profil.
insert into auth.users (id, email) values
  (pg_temp.user_id(1), 'acheteur@example.invalid'),
  (pg_temp.user_id(2), 'deux@example.invalid'),
  (pg_temp.user_id(3), 'autre@example.invalid');
select pg_temp.assert_true((select count(*) = 3 from public.profiles where email like '%@example.invalid'), 'profils créés avec les comptes');

-- SaaScan n’envoie plus d’email : ni journal d’envoi ni rappel en base.
select pg_temp.assert_true(to_regclass('public.renewal_reminders') is null
  and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payment_events' and column_name like 'email%'), 'aucune trace des emails');

-- Les navigateurs n’ont aucun accès direct aux données ni aux transactions, même connectés.
set local role anon;
do $$ begin
  begin perform 1 from public.dossiers; raise exception 'ÉCHEC : lecture anonyme des dossiers';
  exception when insufficient_privilege then null; end;
  begin perform public.start_checkout('{}'::jsonb, 'test_lien_acces_dossier_saascan_0123456789a', 'mensuel', 1899, gen_random_uuid());
    raise exception 'ÉCHEC : dossier créé depuis le navigateur';
  exception when insufficient_privilege then null; end;
end $$;

set local role authenticated;
do $$ begin
  begin perform 1 from public.marketing_videos; raise exception 'ÉCHEC : bonus lisibles avec une session';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.profiles; raise exception 'ÉCHEC : profils lisibles avec une session';
  exception when insufficient_privilege then null; end;
  begin perform public.apply_whop_event('msg_navigateur', 'payment.succeeded', 'pay_navigateur', now(), gen_random_uuid());
    raise exception 'ÉCHEC : paiement confirmé depuis le navigateur';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
set local role service_role;
select public.start_checkout(pg_temp.answers(), 'test_lien_acces_dossier_saascan_0123456789a', 'annuel', 6999, pg_temp.user_id(1));
select pg_temp.assert_true((select count(*) = 9 from public.responses where dossier_id = pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a')), 'réponses enregistrées au passage en caisse');
select pg_temp.assert_true((select user_id = pg_temp.user_id(1) and formule = 'annuel' and statut = 'brouillon' from public.dossiers where access_token = 'test_lien_acces_dossier_saascan_0123456789a'), 'dossier rattaché au compte avec sa formule');
select pg_temp.assert_true((select user_id = pg_temp.user_id(1) from public.payments where id = pg_temp.pending_payment('test_lien_acces_dossier_saascan_0123456789a')), 'paiement rattaché au compte');
do $$ begin
  begin perform public.start_checkout(pg_temp.answers(), 'inco_lien_acces_dossier_saascan_0123456789c', 'mensuel', 1899, gen_random_uuid());
    raise exception 'ÉCHEC : dossier créé pour un compte inconnu';
  exception when insufficient_privilege then null; end;
  begin perform public.start_checkout('{"question_inventee":"x"}'::jsonb, 'autre_lien_acces_dossier_saascan_0123456789', 'mensuel', 1899, pg_temp.user_id(1));
    raise exception 'ÉCHEC : question inconnue acceptée';
  exception when check_violation then null; end;
  begin perform public.start_checkout(pg_temp.answers(), 'autre_lien_acces_dossier_saascan_0123456789', 'hebdomadaire', 500, pg_temp.user_id(1));
    raise exception 'ÉCHEC : formule inconnue acceptée';
  exception when check_violation then null; end;
  begin perform public.reserve_generation(pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'));
    raise exception 'ÉCHEC : publication réservée avant paiement';
  exception when object_not_in_prerequisite_state then null; end;
end $$;

-- Premier paiement : le dossier s’ouvre, l’abonnement et l’email Whop sont enregistrés.
select pg_temp.assert_true((public.apply_whop_event('msg_test_paid', 'payment.succeeded', 'pay_test_1', now(), pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'),
  jsonb_build_object('id', 'pay_test_1', 'local_id', pg_temp.pending_payment('test_lien_acces_dossier_saascan_0123456789a'), 'formule', 'annuel',
    'total_cents', 6999, 'refunded_cents', 0, 'paid_at', now(), 'email', 'acheteur@example.invalid'),
  jsonb_build_object('id', 'mem_test_1', 'status', 'active', 'cancel_at_period_end', false, 'current_period_end', now() + interval '365 days', 'formule', 'annuel', 'synced_at', now())) ->> 'first_payment')::boolean,
  'premier paiement signalé pour la publication');
select pg_temp.assert_true((select paid_at is not null and email = 'acheteur@example.invalid' and membership_status = 'active' and statut = 'brouillon'
  from public.dossiers where access_token = 'test_lien_acces_dossier_saascan_0123456789a'), 'paiement et abonnement confirmés avant la publication');
select pg_temp.assert_true((public.apply_whop_event('msg_test_paid', 'payment.succeeded', 'pay_test_1', now(), pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'),
  jsonb_build_object('id', 'pay_test_1', 'formule', 'annuel', 'total_cents', 6999, 'refunded_cents', 0)) ->> 'duplicate')::boolean, 'événement répété sans second effet');
select pg_temp.assert_true((public.reserve_generation(pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a')) -> 'answers' ->> 'objectif_revenu') = '2000', 'publication réservée après paiement');
do $$ begin
  begin perform public.reserve_extras(pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'));
    raise exception 'ÉCHEC : bonus préparés avant le dossier';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
select pg_temp.assert_true(public.publish_generation(pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'), 1, jsonb_build_object(
  'selections', (select jsonb_agg(jsonb_build_object('idea_id', 'idee-' || i, 'idea_snapshot', '{}'::jsonb, 'rang', i,
    'justification', 'Justification', 'adaptation', 'Adaptation', 'canal_acquisition', 'Canal', 'risque', 'Risque', 'reponses_citees', '[]'::jsonb)) from generate_series(1, 3) i),
  'build_prompt', btrim(repeat('mot ', 800)),
  'tasks', (select jsonb_agg(jsonb_build_object('semaine', w, 'position', t, 'libelle', 'Une tâche')) from generate_series(1, 4) w, generate_series(1, 6) t)
)), 'dossier publié');

-- Bonus de la formule 12 mois : 60 idées de vidéos et plan de A à Z, en une seule publication.
select pg_temp.assert_true((select (r ->> 'videos')::integer = 60 and (r ->> 'roadmap')::boolean and r ->> 'idea_id' = 'idee-1'
  from public.reserve_extras(pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a')) r), 'bonus réservés après le dossier');
do $$ begin
  begin perform public.publish_extras(pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'), 1, jsonb_build_object('videos', pg_temp.videos(30)));
    raise exception 'ÉCHEC : 30 idées de vidéos acceptées pour la formule 12 mois';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
end $$;
select pg_temp.assert_true(public.publish_extras(pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'), 1, jsonb_build_object(
  'videos', pg_temp.videos(60), 'roadmap', (select jsonb_agg(jsonb_build_object('titre', 'Phase ' || i)) from generate_series(1, 7) i))), 'bonus publiés');
select pg_temp.assert_true((select count(*) = 60 from public.marketing_videos where dossier_id = pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'))
  and exists (select 1 from public.launch_roadmaps where dossier_id = pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a')), '60 vidéos et plan de A à Z');
select pg_temp.assert_true((select extras_attempts = 0 and extras_started_at is null from public.dossiers where access_token = 'test_lien_acces_dossier_saascan_0123456789a'), 'tentatives remises à zéro après publication');
do $$ begin
  begin perform public.reserve_extras(pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'));
    raise exception 'ÉCHEC : bonus republiés alors qu’ils sont prêts';
  exception when object_not_in_prerequisite_state then null; end;
end $$;

-- Renouvellement : nouveau paiement, même dossier, même droit d’accès.
select public.apply_whop_event('msg_test_renewal', 'payment.succeeded', 'pay_test_2', now(), pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'),
  jsonb_build_object('id', 'pay_test_2', 'formule', 'annuel', 'total_cents', 6999, 'refunded_cents', 0, 'paid_at', now() + interval '1 second'));
select pg_temp.assert_true((select count(*) = 2 and bool_or(renouvellement) from public.payments where dossier_id = pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a') and statut = 'paye'), 'renouvellement enregistré');

-- Résiliation : un état Whop plus ancien est ignoré.
select public.sync_membership(pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'), jsonb_build_object('id', 'mem_test_1', 'status', 'canceling', 'cancel_at_period_end', true, 'current_period_end', now() + interval '40 days', 'synced_at', now() + interval '1 minute'));
select public.sync_membership(pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'), jsonb_build_object('id', 'mem_test_1', 'status', 'active', 'cancel_at_period_end', false, 'current_period_end', now() + interval '40 days', 'synced_at', now()));
select pg_temp.assert_true((select cancel_at_period_end and membership_status = 'canceling' from public.dossiers where access_token = 'test_lien_acces_dossier_saascan_0123456789a'), 'résiliation conservée malgré un état plus ancien');

-- Remboursement du premier paiement : accès fermé, jamais rouvert par un succès tardif.
select pg_temp.assert_true((public.apply_whop_event('msg_test_refund', 'refund.updated', 'rf_test', now(), pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'),
  jsonb_build_object('id', 'pay_test_1', 'formule', 'annuel', 'total_cents', 6999, 'refunded_cents', 6999)) ->> 'refund_confirmed')::boolean, 'remboursement signalé pour arrêter l’abonnement');
select pg_temp.assert_true(not (public.apply_whop_event('msg_test_paid_late', 'payment.succeeded', 'pay_test_1', now(), pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'),
  jsonb_build_object('id', 'pay_test_1', 'formule', 'annuel', 'total_cents', 6999, 'refunded_cents', 0)) ->> 'refund_confirmed')::boolean, 'remboursement signalé une seule fois');
select pg_temp.assert_true((select refunded_at is not null from public.dossiers where access_token = 'test_lien_acces_dossier_saascan_0123456789a'), 'remboursement conservé malgré un succès tardif');
select pg_temp.assert_true((select statut = 'rembourse' from public.payments where provider_payment_id = 'pay_test_1'), 'premier paiement marqué remboursé');
do $$ begin
  begin perform public.reserve_extras(pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'));
    raise exception 'ÉCHEC : bonus après remboursement';
  exception when object_not_in_prerequisite_state then null; end;
  begin perform public.reopen_checkout(pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'), 'mensuel', 1899, pg_temp.user_id(1));
    raise exception 'ÉCHEC : dossier remboursé réactivé';
  exception when object_not_in_prerequisite_state then null; end;
end $$;

-- Réactivation d’un abonnement terminé, réservée au compte propriétaire : le nouvel abonnement remplace l’ancien.
select public.start_checkout(pg_temp.answers(), 'deux_lien_acces_dossier_saascan_0123456789b', 'mensuel', 1899, pg_temp.user_id(2));
select public.apply_whop_event('msg_test_d2_paid', 'payment.succeeded', 'pay_test_d2', now(), pg_temp.dossier_id('deux_lien_acces_dossier_saascan_0123456789b'),
  jsonb_build_object('id', 'pay_test_d2', 'local_id', pg_temp.pending_payment('deux_lien_acces_dossier_saascan_0123456789b'), 'formule', 'mensuel', 'total_cents', 1899, 'refunded_cents', 0, 'email', 'deux@example.invalid'),
  jsonb_build_object('id', 'mem_test_d2', 'status', 'canceled', 'current_period_end', now() - interval '1 day', 'formule', 'mensuel', 'synced_at', now()));
do $$ begin
  begin perform public.reopen_checkout(pg_temp.dossier_id('deux_lien_acces_dossier_saascan_0123456789b'), 'trimestriel', 2999, pg_temp.user_id(3));
    raise exception 'ÉCHEC : dossier réactivé par un autre compte';
  exception when insufficient_privilege then null; end;
end $$;
select public.reopen_checkout(pg_temp.dossier_id('deux_lien_acces_dossier_saascan_0123456789b'), 'trimestriel', 2999, pg_temp.user_id(2));
select public.apply_whop_event('msg_test_d2_back', 'payment.succeeded', 'pay_test_d2b', now(), pg_temp.dossier_id('deux_lien_acces_dossier_saascan_0123456789b'),
  jsonb_build_object('id', 'pay_test_d2b', 'local_id', pg_temp.pending_payment('deux_lien_acces_dossier_saascan_0123456789b'), 'formule', 'trimestriel', 'total_cents', 2999, 'refunded_cents', 0),
  jsonb_build_object('id', 'mem_test_d2b', 'status', 'active', 'current_period_end', now() + interval '90 days', 'formule', 'trimestriel', 'synced_at', now() + interval '1 second'));
select public.sync_membership(pg_temp.dossier_id('deux_lien_acces_dossier_saascan_0123456789b'), jsonb_build_object('id', 'mem_test_d2', 'status', 'canceled', 'synced_at', now() + interval '2 seconds'));
select pg_temp.assert_true((select membership_id = 'mem_test_d2b' and membership_status = 'active' and formule = 'trimestriel' and user_id = pg_temp.user_id(2)
  from public.dossiers where access_token = 'deux_lien_acces_dossier_saascan_0123456789b'), 'abonnement réactivé par son compte sans retour de l’ancien');

reset role;
rollback;
