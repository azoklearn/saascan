import { after } from "next/server";
import { unwrapWebhook } from "@whop/sdk/helpers";
import { publishDossier, publishExtras } from "@/lib/dossier/publish";
import { ApiError, requireEnv } from "@/lib/security/config";
import { errorResponse, json } from "@/lib/security/http";
import { getWhop } from "@/lib/whop/client";
import { applyWhopEvent, type WhopEvent } from "@/lib/whop/webhook";
export const runtime = "nodejs";
export const maxDuration = 60;

const logFailure = (label: string, id: string) => (error: unknown) => console.error(`[SaaScan] ${label}`, id, error instanceof Error ? error.message : "");

export async function POST(request: Request) {
  try {
    const secret = requireEnv("WHOP_WEBHOOK_SECRET");
    const payload = await request.text();
    let event: WhopEvent;
    try { event = unwrapWebhook<WhopEvent>(payload, { headers: Object.fromEntries(request.headers), key: secret }); }
    catch { throw new ApiError("Signature Whop invalide.", 400); }
    // Identique à chaque nouvelle tentative de la même livraison.
    const deliveryId = request.headers.get("webhook-id");
    if (!deliveryId) throw new ApiError("Identifiant de livraison Whop manquant.", 400);
    const result = await applyWhopEvent(deliveryId, event);
    if (!result.ignored && !result.duplicate && (result.first_payment || result.refund_confirmed)) {
      // Whop attend une réponse en moins de 5 secondes : la publication et la résiliation continuent ensuite.
      after(async () => {
        // La page du dossier relance la publication si ce travail échoue.
        if (result.first_payment) {
          await publishDossier(result.dossierId).then(() => publishExtras(result.dossierId))
            .catch(logFailure("Publication du dossier à reprendre", result.dossierId));
        }
        if (result.refund_confirmed && result.membership_id) {
          await getWhop().memberships.cancel({ id: result.membership_id, reason: "Paiement remboursé" })
            .catch(logFailure("Abonnement remboursé à résilier", result.dossierId));
        }
      });
    }
    return json({ received: true });
  } catch (error) { return errorResponse(error); }
}
