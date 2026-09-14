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
  if (rule.effort_mvp_heures > profile.weeklyHours) reasons.push("Construction plus longue que le temps hebdomadaire.");
  if (idea.temps_mvp_jours > 7) reasons.push("Construction plus longue que la semaine prévue.");
  // Vendre sous deux semaines demande des clients faciles à joindre.
  if (profile.firstSale === "deux_semaines" && idea.difficulte_distribution >= 3) reasons.push("Clients trop longs à convaincre pour une vente sous deux semaines.");
  return reasons;
}
