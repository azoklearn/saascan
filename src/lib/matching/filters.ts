import ideasJson from "@data/ideas.json";
import type { Answers, Idea } from "@/types/domain";
import { buildProfile, type UserProfile } from "@/lib/questionnaire/profile";
import { ideaRules } from "./idea-rules";

export const ideas: Idea[] = ideasJson;

export function resolveProfile(input: UserProfile | Answers): UserProfile {
  return typeof input.weeklyHours === "number" && Array.isArray(input.evidence) ? input as UserProfile : buildProfile(input as Answers);
}

export function rejectionReasons(idea: Idea, profile: UserProfile): string[] {
  const rule = ideaRules[idea.id];
  if (!rule) return ["Règles de faisabilité absentes."];
  const reasons: string[] = [];
  if (idea.difficulte_technique > profile.maxTechnicalDifficulty) reasons.push("Niveau technique supérieur aux compétences déclarées.");
  if (rule.effort_mvp_heures > profile.weeklyHours) reasons.push("Construction plus longue que le temps hebdomadaire.");
  if (idea.temps_mvp_jours > 7) reasons.push("Construction plus longue que la semaine prévue.");
  if (profile.zone === "anglophone") reasons.push("Banque pensée d’abord pour des clients francophones.");
  return reasons;
}
