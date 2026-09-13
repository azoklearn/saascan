import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { databaseError } from "@/lib/security/http";
import { cents, getWhop, membershipSnapshot, planFromWhop } from "./client";

export type WhopEvent = { type: string; timestamp?: string; data?: { id?: string; payment_id?: string } };
type Applied = { duplicate: boolean; first_payment: boolean; refund_confirmed: boolean; refunded: boolean; membership_id: string | null };
export type WhopEventResult = { ignored: true } | (Applied & { ignored: false; dossierId: string });

const membershipEvents = ["membership.activated", "membership.deactivated", "membership.cancel_at_period_end_changed"];
/** Événements auxquels abonner le webhook Whop. */
export const whopWebhookEvents = ["payment.succeeded", ...membershipEvents, "refund.created", "refund.updated"];

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function metadataUuid(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && uuidPattern.test(value) ? value : null;
}

async function dossierFor(metadata: Record<string, unknown> | null | undefined, membershipId: string | null) {
  const fromCheckout = metadataUuid(metadata, "dossier_id");
  if (fromCheckout) return fromCheckout;
  if (!membershipId) return null;
  // Un renouvellement ne porte pas forcément les métadonnées du passage en caisse.
  const { data, error } = await createAdminClient().from("dossiers").select("id").eq("membership_id", membershipId).maybeSingle();
  databaseError(error);
  return (data?.id as string | undefined) ?? null;
}

export async function applyWhopEvent(deliveryId: string, event: WhopEvent): Promise<WhopEventResult> {
  const objectId = event.data?.id;
  const isMembership = membershipEvents.includes(event.type);
  const isRefund = event.type === "refund.created" || event.type === "refund.updated";
  if (!objectId || !(isMembership || isRefund || event.type === "payment.succeeded")) return { ignored: true };
  const whop = getWhop();
  let dossierId: string | null;
  let payment: Record<string, unknown> | null = null;
  let membership: ReturnType<typeof membershipSnapshot> | null = null;
  // L’état est toujours relu chez Whop : les livraisons arrivent parfois en double ou dans le désordre.
  if (isMembership) {
    const current = await whop.memberships.retrieve({ id: objectId });
    if (!planFromWhop(current.plan_id)) return { ignored: true };
    dossierId = await dossierFor(current.metadata, current.id);
    membership = membershipSnapshot(current);
  } else {
    const paymentId = isRefund ? event.data?.payment_id : objectId;
    if (!paymentId) return { ignored: true };
    const current = await whop.payments.retrieve({ id: paymentId });
    const plan = planFromWhop(current.plan_id);
    if (!plan || !current.paid_at || current.currency !== "eur") return { ignored: true };
    dossierId = await dossierFor(current.metadata, current.membership_id);
    payment = {
      id: current.id, local_id: metadataUuid(current.metadata, "payment_id"), formule: plan.id, paid_at: current.paid_at,
      total_cents: cents(current.total ?? current.subtotal), refunded_cents: current.refunded_at ? cents(current.refunded_amount) : 0,
      email: current.customer_email,
    };
    if (current.membership_id) membership = membershipSnapshot(await whop.memberships.retrieve({ id: current.membership_id }));
  }
  if (!dossierId) return { ignored: true };
  const { data, error } = await createAdminClient().rpc("apply_whop_event", {
    p_event_id: deliveryId, p_event_type: event.type, p_object_id: objectId, p_created_at: event.timestamp ?? new Date().toISOString(),
    p_dossier_id: dossierId, p_payment: payment, p_membership: membership,
  });
  databaseError(error);
  return { ...(data as Applied), ignored: false, dossierId };
}
