import { track } from "@vercel/analytics/server";
import { z } from "zod";
import { planIds, type PlanId } from "@/config/pricing";
import { validateAnswers } from "@/lib/questionnaire/schemas";
import { parseAccessToken } from "@/lib/security/access-token";
import { rateLimit } from "@/lib/security/rate-limit";
import { errorResponse, json, readJson } from "@/lib/security/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { findDossier } from "@/lib/supabase/dossiers";
import { requireUser } from "@/lib/supabase/server";
import { createCheckout } from "@/lib/whop/checkout";
export const runtime = "nodejs";

// Nouveau dossier à partir des réponses, ou réactivation d’un dossier par son lien. Un compte est requis,
// ainsi que la renonciation expresse à la rétractation cochée avant le paiement.
const waiver = z.literal(true);
const bodySchema = z.union([
  z.object({ formule: z.enum(planIds), answers: z.unknown(), renonciation_retractation: waiver }).strict(),
  z.object({ formule: z.enum(planIds), token: z.string(), renonciation_retractation: waiver }).strict(),
]);

// Événement Vercel Web Analytics envoyé côté serveur, donc compté même avec un bloqueur de publicité.
// Sans cookie ni référent : l’adresse d’origine peut contenir le lien secret d’un dossier.
async function trackCheckoutStarted(request: Request, formule: PlanId, parcours: "nouveau" | "reactivation") {
  const headers = new Headers(request.headers);
  headers.delete("cookie"); headers.delete("referer");
  await track("Checkout Started", { formule, parcours }, { headers }).catch(() => undefined);
}

export async function POST(request: Request) {
  try {
    rateLimit(request, "checkout", 10, 10 * 60_000);
    const body = bodySchema.parse(await readJson(request));
    const user = await requireUser();
    if ("token" in body) {
      const token = parseAccessToken(body.token);
      const dossier = await findDossier(createAdminClient(), token);
      const url = await createCheckout(body.formule, { dossierId: dossier.id, token, userId: user.id });
      await trackCheckoutStarted(request, body.formule, "reactivation");
      return json({ url });
    }
    const url = await createCheckout(body.formule, { answers: validateAnswers(body.answers), userId: user.id });
    await trackCheckoutStarted(request, body.formule, "nouveau");
    return json({ url });
  } catch (error) { return errorResponse(error); }
}
