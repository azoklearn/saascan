import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDossier } from "@/lib/supabase/dossiers";
import { validateAnswers } from "@/lib/questionnaire/schemas";
import { generateDossier } from "@/lib/generation/service";
import { ApiError, requireEnv } from "@/lib/security/config";
import { databaseError, errorResponse, json, readJson } from "@/lib/security/http";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  let attempt: number | undefined; let dossierId: string | undefined;
  try {
    const body = z.object({ dossier_id: z.string().uuid() }).parse(await readJson(request));
    dossierId = body.dossier_id;
    const { user, supabase } = await requireUser();
    const record = await getDossier(supabase, dossierId);
    if (record.dossier.statut === "pret") return json({ ok: true });
    requireEnv("ANTHROPIC_API_KEY");
    validateAnswers(record.answers);
    const admin = createAdminClient();
    const reserved = await admin.rpc("reserve_generation", { p_dossier_id: dossierId, p_user_id: user.id });
    databaseError(reserved.error);
    attempt = reserved.data.attempt as number;
    const answers = validateAnswers(reserved.data.answers);
    const content = await generateDossier(answers);
    const published = await admin.rpc("publish_generation", { p_dossier_id: dossierId, p_attempt: attempt, p_content: content });
    databaseError(published.error);
    if (!published.data) throw new ApiError("Une tentative plus récente a pris le relais. Recharge le dossier.", 409, "STALE_GENERATION");
    return json({ ok: true });
  } catch (error) {
    const domainCode = typeof error === "object" && error && "code" in error ? String(error.code) : undefined;
    if (attempt !== undefined && dossierId) {
      try {
        const { error: failure } = await createAdminClient().rpc("fail_generation", { p_dossier_id: dossierId, p_attempt: attempt, p_editable: domainCode === "INSUFFICIENT_IDEAS" || error instanceof ZodError });
        if (failure) console.error("[SaaScan] Impossible de libérer la génération", failure.code);
      } catch { console.error("[SaaScan] La génération expirera automatiquement après quatre minutes."); }
    }
    if (domainCode === "INSUFFICIENT_IDEAS") return errorResponse(new ApiError(error instanceof Error ? error.message : "Ajuste tes contraintes pour trouver trois idées réalisables.", 422, domainCode));
    return errorResponse(error);
  }
}
