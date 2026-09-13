import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, appUrl, requireEnv } from "@/lib/security/config";
import { brand } from "@/config/brand";
import { databaseError } from "@/lib/security/http";
import { getStripe, type PaymentRow } from "./client";

export async function createCheckout(dossierId: string, userId: string) {
  if (process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")) {
    for (const key of ["LEGAL_COMPANY_NAME", "LEGAL_COMPANY_ADDRESS", "LEGAL_COMPANY_REGISTRATION", "NEXT_PUBLIC_CONTACT_EMAIL"]) requireEnv(key);
  }
  const stripe = getStripe(); const origin = appUrl(); const admin = createAdminClient();
  for (let pass = 0; pass < 2; pass++) {
    const reserved = await admin.rpc("reserve_checkout", { p_dossier_id: dossierId, p_user_id: userId });
    databaseError(reserved.error);
    const payment = reserved.data as PaymentRow;
    if (payment.stripe_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(payment.stripe_session_id);
      if (existing.status === "open" && existing.url) return existing.url;
      if (existing.status !== "expired") throw new ApiError("Le paiement est en cours de confirmation. Recharge le dossier dans un instant.", 409, "PAYMENT_PENDING");
      const expired = await admin.from("payments").update({ statut: "expire" }).eq("id", payment.id).eq("statut", "en_attente");
      databaseError(expired.error); continue;
    }
    const session = await stripe.checkout.sessions.create({
      mode: "payment", client_reference_id: userId,
      success_url: `${origin}/debloquer/${dossierId}?payment=success`,
      cancel_url: `${origin}/debloquer/${dossierId}?payment=cancelled`,
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: 3900, product_data: { name: `Dossier ${brand.name}`, description: "3 idées personnalisées, un prompt de construction et un plan de 30 jours." } } }],
      metadata: { payment_id: payment.id, dossier_id: dossierId, user_id: userId },
      payment_intent_data: { metadata: { payment_id: payment.id, dossier_id: dossierId, user_id: userId } },
    }, { idempotencyKey: `saascan-checkout-${payment.id}` });
    const attached = await admin.from("payments").update({ stripe_session_id: session.id }).eq("id", payment.id).is("stripe_session_id", null);
    databaseError(attached.error);
    if (!session.url) throw new ApiError("Le paiement est en cours de confirmation. Recharge le dossier.", 409, "PAYMENT_PENDING");
    return session.url;
  }
  throw new ApiError("La session précédente vient d’expirer. Réessaie le paiement.", 409);
}
