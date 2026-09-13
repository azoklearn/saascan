import type { Answers, Idea } from "@/types/domain";
import type { UserProfile } from "@/lib/questionnaire/profile";
import { ideas, rejectionReasons, resolveProfile } from "./filters";
import { ideaRules } from "./idea-rules";

const billingMatches: Record<string, (idea: Idea) => boolean> = {
  abonnement: (idea) => idea.modele_eco.startsWith("Abonnement"),
  usage: (idea) => /crédits|par événement/i.test(idea.modele_eco),
  licence: (idea) => /annuel/i.test(idea.modele_eco),
};

export function scoreIdea(idea: Idea, profile: UserProfile): number {
  const rule = ideaRules[idea.id];
  let score = 50;
  score += profile.domains.filter((domain) => rule.domains.includes(domain)).length * 12;
  if (profile.buyer !== "decide") score += idea.tags.includes("b2b") === (profile.buyer === "b2b") ? 8 : -8;
  score += billingMatches[profile.billing]?.(idea) ? 6 : 0;
  score += (profile.weeklyHours - rule.effort_mvp_heures) / 2;
  score -= Math.max(0, idea.difficulte_technique - profile.maxTechnicalDifficulty) * 6;
  score += idea.tags.includes("no-code") && profile.maxTechnicalDifficulty <= 2 ? 4 : 0;
  if (profile.competition === "differencier") score -= idea.difficulte_distribution * 2;
  if (profile.competition === "nouveau" && idea.tags.includes("ia")) score += 3;
  if (profile.revenueGoal >= 5000 && idea.modele_eco.startsWith("Abonnement")) score += 3;
  return score;
}

/** Ideas within every limit come first; when fewer than three fit, the closest ones complete the selection. */
export function matchIdeas(input: Answers | UserProfile, limit = 8): Idea[] {
  const profile = resolveProfile(input);
  const ranked = ideas.filter((idea) => ideaRules[idea.id]).sort((a, b) => scoreIdea(b, profile) - scoreIdea(a, profile) || a.id.localeCompare(b.id));
  const fitting = ranked.filter((idea) => rejectionReasons(idea, profile).length === 0);
  if (fitting.length >= 3) return fitting.slice(0, limit);
  const closest = ranked.filter((idea) => !fitting.includes(idea)).sort((a, b) => rejectionReasons(a, profile).length - rejectionReasons(b, profile).length);
  return [...fitting, ...closest].slice(0, 3);
}
