-- Compte obligatoire avant le questionnaire : chaque nouveau dossier appartient à
-- un utilisateur Supabase Auth (Google, ou email et mot de passe sans email de
-- confirmation). Le lien secret du dossier reste valable ; l’espace du compte
-- liste les dossiers payés. Les données restent inaccessibles depuis le navigateur.

begin;

drop function public.start_checkout(jsonb, text, text, integer);
drop function public.reopen_checkout(uuid, text, integer);

-- Le déclencheur de la première migration crée le profil ; cette vérification couvre un compte plus ancien.
create function private.ensure_profile(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email)
    select id, coalesce(email, '') from auth.users where id = p_user_id
    on conflict (id) do nothing;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Compte introuvable' using errcode = '42501';
  end if;
end;
$$;

create function public.start_checkout(p_answers jsonb, p_access_token text, p_formule text, p_montant integer, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_dossier uuid; v_payment uuid;
begin
  if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'Réponses invalides.'; end if;
  perform private.ensure_profile(p_user_id);
  insert into public.dossiers (access_token, formule, user_id) values (p_access_token, p_formule, p_user_id) returning id into v_dossier;
  insert into public.responses (dossier_id, question_id, value)
    select v_dossier, key, value from jsonb_each(p_answers);
  insert into public.payments (dossier_id, montant, formule, user_id) values (v_dossier, p_montant, p_formule, p_user_id) returning id into v_payment;
  return jsonb_build_object('dossier_id', v_dossier, 'payment_id', v_payment);
end;
$$;

-- Nouveau passage en caisse pour un dossier dont l’abonnement est terminé. Un dossier
-- créé avant les comptes est rattaché au compte qui le réactive avec son lien.
create function public.reopen_checkout(p_dossier_id uuid, p_formule text, p_montant integer, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.dossiers; p public.payments;
begin
  select * into d from public.dossiers where id = p_dossier_id for update;
  if not found then raise exception 'Dossier introuvable' using errcode = '42501'; end if;
  if d.user_id is not null and d.user_id <> p_user_id then raise exception 'Ce dossier appartient à un autre compte.' using errcode = '42501'; end if;
  if d.paid_at is null or d.refunded_at is not null then raise exception 'Ce dossier ne peut pas être réactivé.' using errcode = '55000'; end if;
  if d.membership_status = any(array['active', 'trialing', 'past_due', 'canceling']) then
    raise exception 'Votre abonnement est toujours actif.' using errcode = '55000';
  end if;
  if d.user_id is null then
    perform private.ensure_profile(p_user_id);
    update public.dossiers set user_id = p_user_id where id = d.id;
  end if;
  select * into p from public.payments where dossier_id = d.id and statut = 'en_attente' for update;
  if found then
    update public.payments set montant = p_montant, formule = p_formule, checkout_id = null, user_id = p_user_id where id = p.id;
  else
    insert into public.payments (dossier_id, montant, formule, user_id) values (d.id, p_montant, p_formule, p_user_id) returning * into p;
  end if;
  return jsonb_build_object('dossier_id', d.id, 'payment_id', p.id);
end;
$$;

revoke all on function private.ensure_profile(uuid) from public, anon, authenticated;
revoke all on function public.start_checkout(jsonb, text, text, integer, uuid), public.reopen_checkout(uuid, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.start_checkout(jsonb, text, text, integer, uuid), public.reopen_checkout(uuid, text, integer, uuid) to service_role;

commit;
