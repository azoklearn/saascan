import "server-only";
import type { Answers } from "@/types/domain";
import { brand } from "@/config/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAccessToken } from "@/lib/security/access-token";
import { ApiError, appUrl, requireEnv } from "@/lib/security/config";
import { databaseError } from "@/lib/security/http";
import { getStripe } from "./client";

export async function createCheckout(answers: Answers): Promise<string> {
  if (process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")) {
    for (const key of ["LEGAL_COMPANY_NAME", "LEGAL_COMPANY_ADDRESS", "LEGAL_COMPANY_REGISTRATION", "NEXT_PUBLIC_CONTACT_EMAIL"]) requireEnv(key);
  }
  const stripe = getStripe(); const origin = appUrl(); const admin = createAdminClient();
  const token = createAccessToken();
  const started = await admin.rpc("start_checkout", { p_answers: answers, p_access_token: token });
  databaseError(started.error);
  const { dossier_id: dossierId, payment_id: paymentId } = started.data as { dossier_id: string; payment_id: string };
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${origin}/dossier/${token}`,
    cancel_url: `${origin}/debloquer?paiement=annule`,
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: 3900, product_data: { name: `Dossier ${brand.name}`, description: "3 idées personnalisées, un prompt de construction et un plan de 30 jours." } } }],
    metadata: { payment_id: paymentId, dossier_id: dossierId },
    payment_intent_data: { metadata: { payment_id: paymentId, dossier_id: dossierId } },
  }, { idempotencyKey: `saascan-checkout-${paymentId}` });
  const attached = await admin.from("payments").update({ stripe_session_id: session.id }).eq("id", paymentId).is("stripe_session_id", null);
  databaseError(attached.error);
  if (!session.url) throw new ApiError("Le paiement n’a pas pu s’ouvrir. Réessayez dans un instant.", 502, "CHECKOUT_UNAVAILABLE");
  return session.url;
}
