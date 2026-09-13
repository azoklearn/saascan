-- Contenus rédigés à l’avance : aucun appel à une IA après le paiement. Le
-- dossier et ses bonus sont assemblés par le serveur à partir de textes écrits
-- une fois pour toutes. La formule 12 mois reçoit 60 idées de vidéos et le plan
-- de A à Z ; les lots quotidiens de nouvelles idées disparaissent.

begin;

drop function public.reserve_video_batch(uuid);
drop function public.publish_video_batch(uuid, integer, jsonb);
drop function public.fail_video_batch(uuid);
alter table public.dossiers drop column videos_started_at;

alter table public.marketing_videos drop constraint marketing_videos_position_check;
alter table public.marketing_videos add constraint marketing_videos_position_check check (position between 1 and 60);

-- Nombre d’idées de vidéos inclus dans chaque formule.
create function private.videos_for(p_formule text)
returns integer language sql immutable set search_path = '' as $$
  select case p_formule when 'trimestriel' then 30 when 'annuel' then 60 else 0 end;
$$;
revoke all on function private.videos_for(text) from public, anon, authenticated;

create or replace function public.reserve_extras(p_dossier_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.dossiers; videos integer; needs_roadmap boolean;
begin
  select * into d from public.dossiers where id = p_dossier_id for update;
  if not found then raise exception 'Dossier introuvable' using errcode = '42501'; end if;
  if d.paid_at is null or d.refunded_at is not null or d.statut <> 'pret' then
    raise exception 'Les bonus sont préparés après votre dossier.' using errcode = '55000';
  end if;
  -- Une formule qui change (par exemple de 3 à 12 mois) complète les bonus manquants.
  videos := case when (select count(*) from public.marketing_videos where dossier_id = d.id) < private.videos_for(d.formule)
    then private.videos_for(d.formule) else 0 end;
  needs_roadmap := d.formule = 'annuel' and not exists (select 1 from public.launch_roadmaps where dossier_id = d.id);
  if videos = 0 and not needs_roadmap then raise exception 'Les bonus de votre formule sont déjà prêts.' using errcode = '55000'; end if;
  if d.extras_started_at > now() - interval '4 minutes' then raise exception 'La préparation des bonus est déjà en cours.' using errcode = '55000'; end if;
  if d.extras_attempts >= 3 then raise exception 'La préparation des bonus a échoué trois fois. Contactez-nous.' using errcode = 'P0001'; end if;
  update public.dossiers set extras_started_at = now(), extras_attempts = extras_attempts + 1 where id = d.id;
  return jsonb_build_object('attempt', d.extras_attempts + 1, 'videos', videos, 'roadmap', needs_roadmap,
    'answers', coalesce((select jsonb_object_agg(question_id, value) from public.responses where dossier_id = d.id), '{}'::jsonb),
    'idea_id', (select idea_id from public.selections where dossier_id = d.id and rang = 1));
end;
$$;

create or replace function public.publish_extras(p_dossier_id uuid, p_attempt integer, p_content jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare d public.dossiers; item jsonb; i integer := 0;
begin
  select * into d from public.dossiers where id = p_dossier_id for update;
  if not found or d.extras_started_at is null or d.extras_attempts <> p_attempt then return false; end if;
  if jsonb_typeof(p_content -> 'videos') = 'array' then
    if jsonb_array_length(p_content -> 'videos') <> private.videos_for(d.formule) then
      raise exception 'Le nombre d’idées de vidéos ne correspond pas à la formule.';
    end if;
    delete from public.marketing_videos where dossier_id = d.id;
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
  -- Les tentatives comptent les échecs consécutifs : un succès les remet à zéro.
  update public.dossiers set extras_started_at = null, extras_attempts = 0 where id = d.id;
  return true;
end;
$$;

commit;
