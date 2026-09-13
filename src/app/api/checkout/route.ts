import { z } from "zod";
import { planIds } from "@/config/pricing";
import { validateAnswers } from "@/lib/questionnaire/schemas";
import { parseAccessToken } from "@/lib/security/access-token";
import { rateLimit } from "@/lib/security/rate-limit";
import { errorResponse, json, readJson } from "@/lib/security/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { findDossier } from "@/lib/supabase/dossiers";
import { createCheckout } from "@/lib/whop/checkout";
export const runtime = "nodejs";

// Nouveau dossier à partir des réponses, ou réactivation d’un dossier par son lien.
const bodySchema = z.union([
  z.object({ formule: z.enum(planIds), answers: z.unknown() }).strict(),
  z.object({ formule: z.enum(planIds), token: z.string() }).strict(),
]);

export async function POST(request: Request) {
  try {
    rateLimit(request, "checkout", 10, 10 * 60_000);
    const body = bodySchema.parse(await readJson(request));
    if ("token" in body) {
      const token = parseAccessToken(body.token);
      const dossier = await findDossier(createAdminClient(), token);
      return json({ url: await createCheckout(body.formule, { dossierId: dossier.id, token }) });
    }
    return json({ url: await createCheckout(body.formule, { answers: validateAnswers(body.answers) }) });
  } catch (error) { return errorResponse(error); }
}
