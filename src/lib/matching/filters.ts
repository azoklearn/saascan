import ideasJson from "@data/ideas.json";
import type { Answers, Idea } from "@/types/domain";
import { buildProfile, type UserProfile } from "@/lib/questionnaire/profile";
import { allowedChannels, ideaRules } from "./idea-rules";

export const ideas: Idea[] = ideasJson;

export function resolveProfile(input: UserProfile | Answers): UserProfile {
  return typeof input.weeklyHours === "number" && Array.isArray(input.evidence) ? input as UserProfile : buildProfile(input as Answers);
}

export function rejectionReasons(idea: Idea, profile: UserProfile): string[] {
  const rule = ideaRules[idea.id];
  if (!rule) return ["Règles de faisabilité absentes."];
  const reasons: string[] = [];
  if (idea.difficulte_technique > profile.maxTechnicalDifficulty) reasons.push("Niveau de code supérieur à ton niveau déclaré.");
  if (idea.budget_min_euros > profile.budgetEuros) reasons.push("Budget de départ dépassé.");
  if (rule.effort_mvp_heures > profile.weeklyHours) reasons.push("Construction trop longue pour ta deuxième semaine.");
  if (idea.temps_mvp_jours > Math.min(7, profile.firstEuroDays)) reasons.push("Calendrier incompatible avec la semaine de construction.");
  if (allowedChannels(idea, profile).length === 0) reasons.push("Acquisition incompatible avec tes limites ou ton réseau.");
  if (!profile.languages.includes("francais")) reasons.push("Cette banque cible des clients francophones.");
  return reasons;
}

/** Hard limits are applied before scoring and never relaxed to fill three slots. */
export function filterIdeas(input: UserProfile | Answers, bank: Idea[] = ideas): Idea[] {
  const profile = resolveProfile(input);
  return bank.filter((idea) => rejectionReasons(idea, profile).length === 0);
}

export class InsufficientIdeasError extends Error {
  readonly code = "INSUFFICIENT_IDEAS";
  constructor(readonly availableCount: number) {
    super(`Seulement ${availableCount} idée${availableCount === 1 ? "" : "s"} respecte${availableCount === 1 ? "" : "nt"} tes contraintes. Aucun dossier ne sera facturé. Revois ton temps, ton budget, ton niveau ou tes canaux uniquement si ta situation le permet.`);
    this.name = "InsufficientIdeasError";
  }
}
