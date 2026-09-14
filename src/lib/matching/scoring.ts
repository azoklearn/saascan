import type { Answers, Idea } from "@/types/domain";
import type { UserProfile } from "@/lib/questionnaire/profile";
import { ideas, rejectionReasons, resolveProfile } from "./filters";
import { allowedChannels, ideaRules } from "./idea-rules";

// Plus la première vente est proche, plus une idée longue à construire ou à vendre recule.
const urgency: Record<string, number> = { deux_semaines: 3, un_mois: 2, trois_mois: 1, sans_urgence: 0 };

export function scoreIdea(idea: Idea, profile: UserProfile): number {
  const rule = ideaRules[idea.id];
  const channels = allowedChannels(idea);
  let score = 50;
  score += (profile.weeklyHours - rule.effort_mvp_heures) / 2;
  score -= (urgency[profile.firstSale] ?? 0) * (idea.difficulte_distribution + idea.temps_mvp_jours / 2);
  if (profile.content === "face_camera" && channels.some((channel) => channel.id === "face")) score += 10;
  if (profile.content !== "face_camera" && channels[0]?.id !== "face") score += 4;
  if (profile.revenueGoal >= 3000 && idea.tags.includes("b2b")) score += 6;
  if (profile.revenueGoal <= 1000 && !idea.tags.includes("b2b")) score += 3;
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
