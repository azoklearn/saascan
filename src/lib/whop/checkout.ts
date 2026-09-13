import "server-only";
import type { Answers } from "@/types/domain";
import { findPlan, type PlanId } from "@/config/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAccessToken } from "@/lib/security/access-token";
import { ApiError, appUrl } from "@/lib/security/config";
import { databaseError } from "@/lib/security/http";
import { getWhop, isWhopSandbox, whopPlanId } from "./client";

type Target = { answers: Answers } | { dossierId: string; token: string };

/** Crée le dossier au passage en caisse, ou rouvre celui dont l’abonnement est terminé. */
export async function createCheckout(formule: PlanId, target: Target): Promise<string> {
  const plan = findPlan(formule);
  if (!plan) throw new ApiError("Cette formule n’existe pas.", 400, "INVALID_INPUT");
  const whop = getWhop(); const planId = whopPlanId(plan); const origin = appUrl();
  if (!origin.startsWith("https://")) {
    throw new ApiError("Whop exige une adresse HTTPS pour le retour après paiement : testez le paiement sur l’adresse Vercel du site.", 503, "NOT_CONFIGURED");
  }
  const admin = createAdminClient();
  const token = "answers" in target ? createAccessToken() : target.token;
  const started = "answers" in target
    ? await admin.rpc("start_checkout", { p_answers: target.answers, p_access_token: token, p_formule: plan.id, p_montant: plan.cents })
    : await admin.rpc("reopen_checkout", { p_dossier_id: target.dossierId, p_formule: plan.id, p_montant: plan.cents });
  databaseError(started.error);
  const { dossier_id: dossierId, payment_id: paymentId } = started.data as { dossier_id: string; payment_id: string };
  // Whop recopie ces métadonnées sur le paiement et l’abonnement. Le lien d’accès n’y figure jamais.
  const checkout = await whop.checkoutConfigurations.create({
    plan_id: planId,
    metadata: { dossier_id: dossierId, payment_id: paymentId },
    redirect_url: `${origin}/dossier/${token}`,
  });
  const attached = await admin.from("payments").update({ checkout_id: checkout.id }).eq("id", paymentId).eq("statut", "en_attente");
  databaseError(attached.error);
  if (!checkout.purchase_url) throw new ApiError("Le paiement n’a pas pu s’ouvrir. Réessayez dans un instant.", 502, "CHECKOUT_UNAVAILABLE");
  return new URL(checkout.purchase_url, isWhopSandbox() ? "https://sandbox.whop.com" : "https://whop.com").href;
}
