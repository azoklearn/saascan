import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/security/config";
import { databaseError } from "@/lib/security/http";
import { getStripe, type PaymentRow } from "./client";

const checkoutEvents = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"]);
const refundEvents = new Set(["charge.refunded", "refund.created", "refund.updated", "refund.failed"]);

function validateSession(session: Stripe.Checkout.Session, payment: PaymentRow) {
  if (session.mode !== "payment" || session.amount_total !== 3900 || session.currency !== "eur"
    || session.metadata?.payment_id !== payment.id || session.metadata?.dossier_id !== payment.dossier_id
    || (payment.stripe_session_id && session.id !== payment.stripe_session_id)) {
    throw new ApiError("La session Stripe ne correspond pas au paiement attendu.", 400, "INVALID_PAYMENT");
  }
}

export async function applyStripeEvent(event: Stripe.Event) {
  if (!checkoutEvents.has(event.type) && !refundEvents.has(event.type)) return { ignored: true as const };
  const stripe = getStripe(); const admin = createAdminClient();
  // Une clé de test ne doit jamais accorder un droit en environnement live.
  const expectsLive = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ?? false;
  if (event.livemode !== expectsLive) throw new ApiError("L’environnement du paiement Stripe ne correspond pas.", 400);
  let session: Stripe.Checkout.Session;
  let payment: PaymentRow | null;
  if (checkoutEvents.has(event.type)) {
    const snapshot = event.data.object as Stripe.Checkout.Session;
    // État actuel, pour supporter la livraison désordonnée des événements.
    session = await stripe.checkout.sessions.retrieve(snapshot.id, { expand: ["payment_intent.latest_charge"] });
    const paymentId = session.metadata?.payment_id;
    if (!paymentId) return { ignored: true as const };
    const result = await admin.from("payments").select("*").eq("id", paymentId).maybeSingle();
    databaseError(result.error); payment = result.data as PaymentRow | null;
    if (!payment) throw new Error("Paiement référencé par Stripe introuvable.");
  } else {
    let intentId: string | null = null;
    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id ?? null;
    } else {
      const refund = event.data.object as Stripe.Refund;
      intentId = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id ?? null;
    }
    if (!intentId) return { ignored: true as const };
    const intent = await stripe.paymentIntents.retrieve(intentId);
    const paymentId = intent.metadata.payment_id;
    if (!paymentId) return { ignored: true as const };
    const result = await admin.from("payments").select("*").eq("id", paymentId).maybeSingle();
    databaseError(result.error); payment = result.data as PaymentRow | null;
    if (!payment) throw new Error("Paiement remboursé introuvable.");
    if (payment.stripe_session_id) session = await stripe.checkout.sessions.retrieve(payment.stripe_session_id, { expand: ["payment_intent.latest_charge"] });
    else {
      const sessions = await stripe.checkout.sessions.list({ payment_intent: intentId, limit: 1, expand: ["data.payment_intent.latest_charge"] });
      if (!sessions.data[0]) throw new Error("Session du remboursement introuvable.");
      session = sessions.data[0];
    }
  }
  validateSession(session, payment);
  const intent = typeof session.payment_intent === "object" ? session.payment_intent : null;
  const intentId = typeof session.payment_intent === "string" ? session.payment_intent : intent?.id ?? null;
  const charge = intent && typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  let refundedCents = 0;
  // Les remboursements en attente/échoués n’annulent pas un droit acquis.
  if (intentId && ((charge?.amount_refunded ?? 0) > 0 || refundEvents.has(event.type))) {
    for await (const refund of stripe.refunds.list({ payment_intent: intentId, limit: 100 })) {
      if (refund.status === "succeeded") refundedCents += refund.amount;
    }
  }
  const result = await admin.rpc("apply_stripe_event", {
    p_event_id: event.id, p_event_type: event.type, p_object_id: (event.data.object as { id: string }).id,
    p_created_at: new Date(event.created * 1000).toISOString(), p_payment_id: payment.id,
    p_session_id: session.id, p_intent_id: intentId,
    p_paid: session.payment_status === "paid", p_refunded_cents: refundedCents,
    p_expired: session.status === "expired" || event.type === "checkout.session.async_payment_failed",
    p_paid_at: charge ? new Date(charge.created * 1000).toISOString() : null,
    p_email: session.customer_details?.email ?? null,
  });
  databaseError(result.error);
  const applied = result.data as { duplicate?: boolean; email_kind?: string | null };
  return { ...applied, dossierId: payment.dossier_id, startGeneration: checkoutEvents.has(event.type) && session.payment_status === "paid" && !applied.duplicate };
}
