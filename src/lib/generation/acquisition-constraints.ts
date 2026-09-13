import type { UserProfile } from "@/lib/questionnaire/profile";

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’‘]/g, "'").toLowerCase();

/** Conservative lexical check of generated prose, not a semantic guarantee.
 * Structured channel IDs and server-authored acquisition steps remain the hard
 * boundary. This additionally catches explicit contradictory prose, including
 * acquisition tasks mislabeled as `none`. Unknown paraphrases can still escape;
 * ambiguous mentions are rejected unless a nearby restriction is explicit.
 */
export function acquisitionLanguageConflict(text: string, profile: Pick<UserProfile, "acceptsCold" | "acceptsFace">): "cold" | "face" | null {
  const constraints = [
    { kind: "cold" as const, accepted: profile.acceptsCold, expression: /\b(?:a froid|cold[\s-]*(?:e?mail\w*|call\w*|outreach)|non[\s-]+sollicite\w*|inconnu\w*)\b/g },
    { kind: "face" as const, accepted: profile.acceptsFace, expression: /\b(?:face[\s-]*cam(?:era)?|visage|selfie|devant (?:la |ta )?camera)\b/g },
  ];
  // A restriction in one clause must not authorize an instruction in the next.
  const clauses = normalize(text).split(/[.!?;\n,]+|\b(?:mais|puis|et|pourtant|cependant|toutefois)\b/);
  for (const constraint of constraints) {
    if (constraint.accepted) continue;
    for (const clause of clauses) {
      for (const match of clause.matchAll(constraint.expression)) {
        const before = clause.slice(0, match.index);
        const after = clause.slice(match.index + match[0].length);
        const explicitRestriction = /\b(?:aucune?|sans|pas de|jamais de|ni|evite\w*|exclu\w*|refus\w*|interdi\w*)\b(?:[\s'-]+[a-z0-9]+){0,7}[\s'-]*$/.test(before)
          || /\b(?:ne\s+|n')(?:(?:[a-z]+)[\s'-]+){1,4}(?:pas|jamais|plus)\b(?:[\s'-]+[a-z]+){0,5}[\s'-]*$/.test(before)
          || /^\s+(?:(?:est|reste|sont|restent)\s+)?(?:interdit\w*|exclu\w*|refuse\w*|inutile\w*)\b/.test(after);
        if (!explicitRestriction) return constraint.kind;
      }
    }
  }
  return null;
}
