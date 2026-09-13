import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Answers, DossierContent } from "@/types/domain";
import { buildProfile } from "@/lib/questionnaire/profile";
import { matchIdeas } from "@/lib/matching/scoring";
import { generationInstructions, generationPayload } from "./instructions";
import { contentFromDraft, generationSchema, GenerationValidationError, validateGeneratedDraft } from "./schemas";

export { InsufficientIdeasError } from "@/lib/matching/filters";

export async function generateDossier(answers: Answers): Promise<DossierContent> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("La génération n’est pas configurée sur ce serveur.");
  const profile = buildProfile(answers);
  const candidates = matchIdeas(profile);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 180_000 });
  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
    max_tokens: 10_000,
    system: generationInstructions,
    messages: [{ role: "user", content: generationPayload(profile, candidates) }],
    output_config: { format: zodOutputFormat(generationSchema) },
  }, { signal: AbortSignal.timeout(180_000) });
  if (response.stop_reason !== "end_turn") throw new GenerationValidationError("La génération a été interrompue. Ton dossier n’a pas été publié.");
  const text = response.content.filter((block) => block.type === "text").map((block) => block.text).join("");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new GenerationValidationError("La génération n’a pas produit un dossier lisible."); }
  const draft = validateGeneratedDraft(raw, candidates, profile);
  return contentFromDraft(draft, candidates, profile);
}
