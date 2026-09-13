import "server-only";
import { validateAnswers } from "@/lib/questionnaire/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/security/config";
import { databaseError } from "@/lib/security/http";
import { buildDossierContent, buildExtras } from "./content";
import { ideaContent } from "./library";

/** La base ne réserve la publication qu’après la confirmation du paiement par Whop. */
export async function publishDossier(dossierId: string): Promise<void> {
  const admin = createAdminClient();
  const reserved = await admin.rpc("reserve_generation", { p_dossier_id: dossierId });
  databaseError(reserved.error);
  const attempt = reserved.data.attempt as number;
  try {
    const content = buildDossierContent(validateAnswers(reserved.data.answers), ideaContent);
    const published = await admin.rpc("publish_generation", { p_dossier_id: dossierId, p_attempt: attempt, p_content: content });
    databaseError(published.error);
    if (!published.data) throw new ApiError("Une tentative plus récente a pris le relais.", 409, "STALE_GENERATION");
  } catch (error) {
    const { error: failure } = await admin.rpc("fail_generation", { p_dossier_id: dossierId, p_attempt: attempt });
    if (failure) console.error("[SaaScan] Impossible de libérer la préparation", failure.code);
    throw error;
  }
}

/** Idées de vidéos (3 et 12 mois) et plan de A à Z (12 mois), après la publication du dossier. */
export async function publishExtras(dossierId: string): Promise<void> {
  const admin = createAdminClient();
  const reserved = await admin.rpc("reserve_extras", { p_dossier_id: dossierId });
  // Formule sans bonus, bonus déjà prêts ou préparation en cours : rien à publier.
  if (reserved.error?.code === "55000") return;
  databaseError(reserved.error);
  const { attempt, videos, roadmap, answers, idea_id: ideaId } = reserved.data as { attempt: number; videos: number; roadmap: boolean; answers: unknown; idea_id: string };
  try {
    const extras = buildExtras(validateAnswers(answers), ideaId, { videos, roadmap }, ideaContent);
    const published = await admin.rpc("publish_extras", { p_dossier_id: dossierId, p_attempt: attempt, p_content: extras });
    databaseError(published.error);
    if (!published.data) throw new ApiError("Une tentative plus récente a pris le relais.", 409, "STALE_GENERATION");
  } catch (error) {
    const { error: failure } = await admin.rpc("fail_extras", { p_dossier_id: dossierId, p_attempt: attempt });
    if (failure) console.error("[SaaScan] Impossible de libérer les bonus", failure.code);
    throw error;
  }
}
