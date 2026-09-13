-- Exécuter avec psql contre une base Supabase locale migrée :
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
-- Toutes les données de test sont annulées à la fin.
begin;

create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin if condition is distinct from true then raise exception 'ÉCHEC : %', message; end if; end;
$$;

insert into auth.users(id, email) values
  ('11111111-1111-4111-8111-111111111111', 'rls-a@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'rls-b@example.invalid');
insert into public.dossiers(id, user_id) values
  ('aaaaaaaa-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222');
insert into public.dossiers(id, user_id, statut, generated_at) values
  ('aaaaaaaa-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'pret', now());
insert into public.selections(dossier_id, idea_id, idea_snapshot, rang, justification, adaptation, canal_acquisition, risque, reponses_citees)
select 'aaaaaaaa-3333-4333-8333-333333333333', 'idee-' || i, '{}'::jsonb, i, 'Justification', 'Adaptation', 'Canal', 'Risque', '[]'::jsonb from generate_series(1,3) i;
insert into public.build_prompts(dossier_id, contenu_md) values
  ('aaaaaaaa-3333-4333-8333-333333333333', btrim(repeat('mot ', 800)));
insert into public.plan_tasks(id, dossier_id, semaine, position, libelle)
values ('cccccccc-1111-4111-8111-111111111111', 'aaaaaaaa-3333-4333-8333-333333333333', 1, 1, 'Une tâche');

set local role anon;
do $$ begin
  begin perform 1 from public.dossiers; raise exception 'ÉCHEC : lecture anonyme autorisée';
  exception when insufficient_privilege then null; end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select pg_temp.assert_true((select count(*) = 2 from public.dossiers), 'isolation des dossiers entre comptes');
select pg_temp.assert_true((select count(*) = 0 from public.selections), 'sélections verrouillées avant paiement');
select pg_temp.assert_true((select count(*) = 0 from public.build_prompts), 'prompt verrouillé avant paiement');
select pg_temp.assert_true((select count(*) = 0 from public.plan_tasks), 'tâches verrouillées avant paiement');

select public.save_response('aaaaaaaa-1111-4111-8111-111111111111', 'temps_semaine', '"5_10"');
select public.save_response('aaaaaaaa-1111-4111-8111-111111111111', 'temps_semaine', '"10_20"');
select pg_temp.assert_true((select count(*) = 1 from public.responses), 'upsert de réponse sans doublon');
do $$ begin
  begin perform public.save_response('bbbbbbbb-2222-4222-8222-222222222222', 'temps_semaine', '"5_10"');
    raise exception 'ÉCHEC : modification de réponse d’un autre compte';
  exception when insufficient_privilege then null; end;
  begin update public.dossiers set paid_at = now() where id = 'aaaaaaaa-3333-4333-8333-333333333333';
    raise exception 'ÉCHEC : droit de paiement modifiable';
  exception when insufficient_privilege then null; end;
  begin perform public.reserve_generation('aaaaaaaa-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111');
    raise exception 'ÉCHEC : RPC serveur accessible au client';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.stripe_events; raise exception 'ÉCHEC : journal Stripe exposé';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
insert into public.payments(id, user_id, dossier_id) values
  ('dddddddd-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-3333-4333-8333-333333333333');
set local role service_role;
select public.apply_stripe_event('evt_test_paid', 'checkout.session.completed', 'cs_test_rls', now(),
  'dddddddd-1111-4111-8111-111111111111', 'cs_test_rls', 'pi_test_rls', true, 0, false, now());
select pg_temp.assert_true((public.apply_stripe_event('evt_test_paid', 'checkout.session.completed', 'cs_test_rls', now(),
  'dddddddd-1111-4111-8111-111111111111', 'cs_test_rls', 'pi_test_rls', true, 0, false, now()) ->> 'duplicate')::boolean,
  'événement dupliqué sans second effet');

set local role authenticated;
select pg_temp.assert_true((select count(*) = 3 from public.selections), 'sélections accessibles après paiement');
select pg_temp.assert_true((select count(*) = 1 from public.build_prompts), 'prompt accessible après paiement');
update public.plan_tasks set done = true where id = 'cccccccc-1111-4111-8111-111111111111';
select pg_temp.assert_true((select done from public.plan_tasks where id = 'cccccccc-1111-4111-8111-111111111111'), 'case cochée persistée');
do $$ begin
  begin update public.plan_tasks set libelle = 'Contenu altéré' where id = 'cccccccc-1111-4111-8111-111111111111';
    raise exception 'ÉCHEC : contenu de tâche modifiable';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select pg_temp.assert_true((select count(*) = 0 from public.selections), 'contenu payé non partagé entre comptes');
select pg_temp.assert_true((select count(*) = 0 from public.payments), 'paiements non partagés entre comptes');

set local role service_role;
select public.apply_stripe_event('evt_test_refund', 'charge.refunded', 'ch_test_rls', now(),
  'dddddddd-1111-4111-8111-111111111111', 'cs_test_rls', 'pi_test_rls', true, 3900, false, now());
select public.apply_stripe_event('evt_test_paid_late', 'checkout.session.completed', 'cs_test_rls', now(),
  'dddddddd-1111-4111-8111-111111111111', 'cs_test_rls', 'pi_test_rls', true, 0, false, now());
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select pg_temp.assert_true((select count(*) = 0 from public.selections), 'remboursement ferme l’accès malgré un succès tardif');
select pg_temp.assert_true((select count(*) = 0 from public.plan_tasks), 'tâches inaccessibles après remboursement');

reset role;
rollback;
