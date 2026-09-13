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
create function pg_temp.payment_id(token text) returns uuid language sql stable as $$
  select p.id from public.payments p join public.dossiers d on d.id = p.dossier_id where d.access_token = token;
$$;

-- Les navigateurs n’ont plus aucun accès direct aux données ni aux transactions.
set local role anon;
do $$ begin
  begin perform 1 from public.dossiers; raise exception 'ÉCHEC : lecture anonyme des dossiers';
  exception when insufficient_privilege then null; end;
  begin perform public.start_checkout('{}'::jsonb, 'test_lien_acces_dossier_saascan_0123456789a');
    raise exception 'ÉCHEC : dossier créé depuis le navigateur';
  exception when insufficient_privilege then null; end;
end $$;

set local role authenticated;
do $$ begin
  begin perform 1 from public.selections; raise exception 'ÉCHEC : contenu lisible avec une session';
  exception when insufficient_privilege then null; end;
  begin perform public.reserve_generation(gen_random_uuid()); raise exception 'ÉCHEC : génération déclenchée depuis le navigateur';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
set local role service_role;
select public.start_checkout('{"tranche_age":"25_34","cible_client":"b2b","domaines":["vente","productivite"],"competences":"sans_code","temps_jour":"1h","zone":"francophone","facturation":"abonnement","concurrence":"differencier","objectif_revenu":"2000"}'::jsonb, 'test_lien_acces_dossier_saascan_0123456789a');
select pg_temp.assert_true((select count(*) = 9 from public.responses where dossier_id = pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a')), 'réponses enregistrées au passage en caisse');
select pg_temp.assert_true((select user_id is null and questionnaire_version = 2 and statut = 'brouillon' from public.dossiers where access_token = 'test_lien_acces_dossier_saascan_0123456789a'), 'dossier créé sans compte');
do $$ begin
  begin perform public.start_checkout('{"question_inventee":"x"}'::jsonb, 'autre_lien_acces_dossier_saascan_0123456789');
    raise exception 'ÉCHEC : question inconnue acceptée';
  exception when check_violation then null; end;
  begin perform public.start_checkout('{}'::jsonb, 'trop-court');
    raise exception 'ÉCHEC : lien d’accès invalide accepté';
  exception when check_violation then null; end;
  begin perform public.reserve_generation(pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'));
    raise exception 'ÉCHEC : génération réservée avant paiement';
  exception when object_not_in_prerequisite_state then null; end;
  begin update public.dossiers set statut = 'generation', generation_started_at = now() where access_token = 'test_lien_acces_dossier_saascan_0123456789a';
    raise exception 'ÉCHEC : génération possible sans paiement';
  exception when check_violation then null; end;
end $$;

select public.apply_stripe_event('evt_test_paid', 'checkout.session.completed', 'cs_test_parcours', now(),
  pg_temp.payment_id('test_lien_acces_dossier_saascan_0123456789a'), 'cs_test_parcours', 'pi_test_parcours', true, 0, false, now(), 'acheteur@example.invalid');
select pg_temp.assert_true((select paid_at is not null and email = 'acheteur@example.invalid' and statut = 'brouillon' from public.dossiers where access_token = 'test_lien_acces_dossier_saascan_0123456789a'), 'paiement confirmé avant la génération');
select pg_temp.assert_true((public.apply_stripe_event('evt_test_paid', 'checkout.session.completed', 'cs_test_parcours', now(),
  pg_temp.payment_id('test_lien_acces_dossier_saascan_0123456789a'), 'cs_test_parcours', 'pi_test_parcours', true, 0, false, now(), 'acheteur@example.invalid') ->> 'duplicate')::boolean,
  'événement dupliqué sans second effet');
select pg_temp.assert_true((public.claim_event_email('evt_test_paid') ->> 'access_token') = 'test_lien_acces_dossier_saascan_0123456789a', 'email envoyé avec le lien du dossier');
select pg_temp.assert_true((public.reserve_generation(pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a')) -> 'answers' ->> 'objectif_revenu') = '2000', 'génération réservée après paiement avec les réponses');
do $$ begin
  begin perform public.reserve_generation(pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'));
    raise exception 'ÉCHEC : deux générations simultanées';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
select pg_temp.assert_true(public.publish_generation(pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'), 1, jsonb_build_object(
  'selections', (select jsonb_agg(jsonb_build_object('idea_id', 'idee-' || i, 'idea_snapshot', '{}'::jsonb, 'rang', i,
    'justification', 'Justification', 'adaptation', 'Adaptation', 'canal_acquisition', 'Canal', 'risque', 'Risque', 'reponses_citees', '[]'::jsonb)) from generate_series(1, 3) i),
  'build_prompt', btrim(repeat('mot ', 800)),
  'tasks', (select jsonb_agg(jsonb_build_object('semaine', w, 'position', t, 'libelle', 'Une tâche')) from generate_series(1, 4) w, generate_series(1, 6) t)
)), 'dossier publié');
select pg_temp.assert_true((select statut = 'pret' and generated_at is not null from public.dossiers where access_token = 'test_lien_acces_dossier_saascan_0123456789a'), 'dossier prêt');

select public.apply_stripe_event('evt_test_refund', 'charge.refunded', 'ch_test_parcours', now(),
  pg_temp.payment_id('test_lien_acces_dossier_saascan_0123456789a'), 'cs_test_parcours', 'pi_test_parcours', true, 3900, false, now(), null);
select public.apply_stripe_event('evt_test_paid_late', 'checkout.session.completed', 'cs_test_parcours', now(),
  pg_temp.payment_id('test_lien_acces_dossier_saascan_0123456789a'), 'cs_test_parcours', 'pi_test_parcours', true, 0, false, now(), null);
select pg_temp.assert_true((select refunded_at is not null from public.dossiers where access_token = 'test_lien_acces_dossier_saascan_0123456789a'), 'remboursement conservé malgré un succès tardif');
select pg_temp.assert_true((select statut = 'rembourse' from public.payments where id = pg_temp.payment_id('test_lien_acces_dossier_saascan_0123456789a')), 'paiement marqué remboursé');
do $$ begin
  begin perform public.reserve_generation(pg_temp.dossier_id('test_lien_acces_dossier_saascan_0123456789a'));
    raise exception 'ÉCHEC : génération après remboursement';
  exception when object_not_in_prerequisite_state then null; end;
end $$;

reset role;
rollback;
