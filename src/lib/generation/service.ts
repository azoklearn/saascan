import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Answers, DossierContent } from "@/types/domain";
import { buildProfile } from "@/lib/questionnaire/profile";
import { validateAnswers } from "@/lib/questionnaire/schemas";
import { matchIdeas } from "@/lib/matching/scoring";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, requireEnv } from "@/lib/security/config";
import { databaseError } from "@/lib/security/http";
import { generationInstructions, generationPayload } from "./instructions";
import { contentFromDraft, generationSchema, GenerationValidationError, validateGeneratedDraft } from "./schemas";

export async function generateDossier(answers: Answers): Promise<DossierContent> {
  const profile = buildProfile(answers);
  const candidates = matchIdeas(profile);
  const anthropic = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY"), maxRetries: 0, timeout: 180_000 });
  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
    max_tokens: 10_000,
    system: generationInstructions,
    messages: [{ role: "user", content: generationPayload(profile, candidates) }],
    output_config: { format: zodOutputFormat(generationSchema) },
  }, { signal: AbortSignal.timeout(180_000) });
  if (response.stop_reason !== "end_turn") throw new GenerationValidationError("La génération a été interrompue. Le dossier n’a pas été publié.");
  const text = response.content.filter((block) => block.type === "text").map((block) => block.text).join("");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new GenerationValidationError("La génération n’a pas produit un dossier lisible."); }
  return contentFromDraft(validateGeneratedDraft(raw, candidates, profile), candidates);
}

/** The database only reserves a generation once Stripe has confirmed the payment. */
export async function runPaidGeneration(dossierId: string): Promise<void> {
  requireEnv("ANTHROPIC_API_KEY");
  const admin = createAdminClient();
  const reserved = await admin.rpc("reserve_generation", { p_dossier_id: dossierId });
  databaseError(reserved.error);
  const attempt = reserved.data.attempt as number;
  try {
    const content = await generateDossier(validateAnswers(reserved.data.answers));
    const published = await admin.rpc("publish_generation", { p_dossier_id: dossierId, p_attempt: attempt, p_content: content });
    databaseError(published.error);
    if (!published.data) throw new ApiError("Une tentative plus récente a pris le relais.", 409, "STALE_GENERATION");
  } catch (error) {
    const { error: failure } = await admin.rpc("fail_generation", { p_dossier_id: dossierId, p_attempt: attempt });
    if (failure) console.error("[SaaScan] Impossible de libérer la génération", failure.code);
    throw error;
  }
}
