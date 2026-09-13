import type { Answers, Idea } from "@/types/domain";
import type { UserProfile } from "@/lib/questionnaire/profile";
import { filterIdeas, InsufficientIdeasError, resolveProfile } from "./filters";
import { allowedChannels, ideaRules } from "./idea-rules";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const proximity = (text: string, keywords: string[]) => keywords.filter((keyword) => normalize(text).includes(keyword)).length;

export function scoreIdea(idea: Idea, profile: UserProfile): number {
  const rule = ideaRules[idea.id];
  let score = 50;
  score += proximity(profile.sector, rule.keywords) * 9;
  score += proximity(profile.communities, rule.keywords) * 7;
  score += proximity(profile.audience, rule.keywords) * 5;
  score += profile.preferredTypes.filter((type) => idea.tags.includes(type)).length * 6;
  score += allowedChannels(idea, profile).some((channel) => channel.id === "network") ? 4 : 0;
  score += (profile.weeklyHours - rule.effort_mvp_heures) / 2;
  score += Math.min(3, (profile.budgetEuros - idea.budget_min_euros) / 50);
  score -= idea.difficulte_distribution * (6 - profile.salesSkill);
  score -= idea.difficulte_technique * (profile.incomeExperience === "jamais" ? 2 : 0);
  score -= profile.firstEuroDays === 30 ? idea.temps_mvp_jours : 0;
  score += idea.tags.includes("ia") ? (profile.aiSkill - 3) * 4 : 0;
  score += idea.tags.includes("design") ? (profile.designSkill - 3) * 3 : 0;
  score += idea.tags.includes("video") ? (profile.videoSkill - 3) * 3 : 0;
  score += profile.acceptsFace && allowedChannels(idea, profile).some((channel) => channel.requiresFace) ? 2 : 0;
  score += profile.acceptsCold && allowedChannels(idea, profile).some((channel) => channel.requiresCold) ? 2 : 0;
  score -= profile.risk === "faible" ? idea.difficulte_distribution * 2 + (idea.tags.includes("ia") ? 4 : 0) : 0;
  score += profile.risk === "eleve" && idea.tags.includes("ia") ? 2 : 0;
  score -= profile.dislikes.filter((dislike) => rule.dailyTasks.includes(dislike)).length * 7;
  score += profile.ambition === "complement" ? 8 - rule.effort_mvp_heures / 2 : idea.modele_eco.includes("Abonnement") ? 5 : 0;
  score += profile.codeLevel === "aucun" && idea.tags.includes("no-code") ? 4 : 0;
  return score;
}

export function matchIdeas(input: Answers | UserProfile, limit = 8): Idea[] {
  const profile = resolveProfile(input);
  const candidates = filterIdeas(profile);
  if (candidates.length < 3) throw new InsufficientIdeasError(candidates.length);
  return candidates.sort((a, b) => scoreIdea(b, profile) - scoreIdea(a, profile) || a.id.localeCompare(b.id)).slice(0, Math.max(3, limit));
}
