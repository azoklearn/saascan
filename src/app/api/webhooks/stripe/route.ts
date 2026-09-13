import { after } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { applyStripeEvent } from "@/lib/stripe/webhook";
import { sendEventEmail } from "@/lib/email/service";
import { runPaidGeneration } from "@/lib/generation/service";
import { requireEnv, ApiError } from "@/lib/security/config";
import { errorResponse, json } from "@/lib/security/http";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) throw new ApiError("Signature Stripe manquante.", 400);
    const stripe = getStripe(); const secret = requireEnv("STRIPE_WEBHOOK_SECRET");
    let event;
    try { event = stripe.webhooks.constructEvent(await request.text(), signature, secret); }
    catch { throw new ApiError("Signature Stripe invalide.", 400); }
    const result = await applyStripeEvent(event);
    if (!("ignored" in result)) {
      try { await sendEventEmail(event.id); }
      catch { console.error("[SaaScan] Email transactionnel à reprendre", event.id); }
      // La page du dossier relance la préparation si ce travail d’arrière-plan échoue.
      if (result.startGeneration) after(() => runPaidGeneration(result.dossierId).catch((error) => console.error("[SaaScan] Préparation du dossier à reprendre", result.dossierId, error instanceof Error ? error.message : "")));
    }
    return json({ received: true });
  } catch (error) { return errorResponse(error); }
}
