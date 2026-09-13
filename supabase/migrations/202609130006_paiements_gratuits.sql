-- Paiement à 0 € : un code promo Whop de 100 % confirme l’abonnement sans montant.
-- Il ouvre le dossier comme un paiement normal ; il ne peut simplement pas être
-- remboursé. Avant cette migration, apply_whop_event le refusait et le dossier
-- restait bloqué sur « Nous confirmons votre paiement ».

begin;

alter table public.payments drop constraint payments_montant_check;
alter table public.payments add constraint payments_montant_check check (montant >= 0);

create or replace function public.apply_whop_event(
  p_event_id text, p_event_type text, p_object_id text, p_created_at timestamptz,
  p_dossier_id uuid, p_payment jsonb default null, p_membership jsonb default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.dossiers; p public.payments; processed timestamptz;
  total integer; refunded integer; fully_refunded boolean; payment_time timestamptz;
  first_payment boolean := false; refund_confirmed boolean := false;
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
    if total is null or total < 0 or p_payment ->> 'id' is null then raise exception 'Paiement Whop invalide'; end if;
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
    -- Un paiement à 0 € n’est jamais considéré comme remboursé.
    fully_refunded := total > 0 and refunded = total;
    payment_time := coalesce(p.paid_at, (p_payment ->> 'paid_at')::timestamptz, p_created_at);
    update public.payments set provider_payment_id = p_payment ->> 'id', montant = total,
      formule = coalesce(p_payment ->> 'formule', formule), paid_at = payment_time, montant_rembourse = refunded,
      refunded_at = case when fully_refunded then coalesce(refunded_at, greatest(now(), payment_time)) end,
      statut = case when fully_refunded then 'rembourse' when refunded > 0 then 'rembourse_partiel' else 'paye' end
      where id = p.id;
    if d.paid_at is null then
      first_payment := not fully_refunded;
      update public.dossiers set paid_at = payment_time, access_payment_id = p.id,
        email = coalesce(email, left(p_payment ->> 'email', 320)), formule = coalesce(p_payment ->> 'formule', formule),
        refunded_at = case when fully_refunded then greatest(now(), payment_time) end
        where id = d.id;
    elsif d.access_payment_id = p.id and fully_refunded and d.refunded_at is null then
      refund_confirmed := true;
      update public.dossiers set refunded_at = greatest(now(), payment_time) where id = d.id;
    end if;
  end if;

  update public.payment_events set processed_at = now(), payment_id = p.id where event_id = p_event_id;
  select * into d from public.dossiers where id = d.id;
  return jsonb_build_object('duplicate', false, 'first_payment', first_payment, 'refund_confirmed', refund_confirmed,
    'refunded', d.refunded_at is not null, 'membership_id', d.membership_id);
end;
$$;

commit;
