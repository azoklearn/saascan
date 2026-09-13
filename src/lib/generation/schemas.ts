import { z } from "zod";
import type { DossierContent, Idea } from "@/types/domain";
import type { UserProfile } from "@/lib/questionnaire/profile";
import { questions } from "@/lib/questionnaire/questions";
import { acquisitionFor, allowedChannels } from "@/lib/matching/idea-rules";
import { countWords } from "./word-count";

const questionIds = questions.map((question) => question.id) as [string, ...string[]];
const channelSchema = z.enum(["community", "network", "cold", "face"]);

/** Simple structural schema sent to Claude; semantic limits are checked below. */
export const generationSchema = z.object({
  selections: z.array(z.object({
    idea_id: z.string(),
    rang: z.number().int().min(1).max(3),
    justification: z.string().min(80).max(1800),
    adaptation: z.string().min(80).max(1800),
    canal_id: channelSchema,
    risque: z.string().min(40).max(1000),
    reponses_citees: z.array(z.object({
      question_id: z.enum(questionIds),
      reponse: z.string().min(1).max(500),
      effet: z.string().min(15).max(700),
    }).strict()).min(3).max(questions.length),
  }).strict()).length(3),
  build_prompt: z.string().describe("Prompt Markdown complet pour l’idée de rang 1, entre 700 et 900 mots séparés par des espaces. Vise 800 mots."),
  tasks: z.array(z.object({
    semaine: z.number().int().min(1).max(4),
    position: z.number().int().min(1).max(7),
    libelle: z.string().min(15).max(450),
    canal_id: z.enum(["none", "community", "network", "cold", "face"]),
  }).strict()).min(20).max(28),
}).strict();

export type GeneratedDraft = z.infer<typeof generationSchema>;

export class GenerationValidationError extends Error {
  readonly code = "INVALID_GENERATION";
  constructor(message: string) { super(message); this.name = "GenerationValidationError"; }
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new GenerationValidationError(message);
}

export function validateGeneratedDraft(input: unknown, candidates: Idea[], profile: UserProfile): GeneratedDraft {
  const draft = generationSchema.parse(input);
  invariant(new Set(draft.selections.map((selection) => selection.idea_id)).size === 3, "Les trois idées doivent être distinctes.");
  invariant(new Set(draft.selections.map((selection) => selection.rang)).size === 3, "Les rangs 1 à 3 doivent être distincts.");
  const cited = new Set<string>();
  for (const selection of draft.selections) {
    const idea = candidates.find((candidate) => candidate.id === selection.idea_id);
    invariant(idea, "Une idée sélectionnée ne fait pas partie des candidats.");
    invariant(allowedChannels(idea).some((channel) => channel.id === selection.canal_id), "Un canal ne correspond pas à l’idée choisie.");
    const ownCitations = new Set<string>();
    for (const citation of selection.reponses_citees) {
      invariant(!ownCitations.has(citation.question_id), "Une réponse est citée deux fois dans la même sélection.");
      ownCitations.add(citation.question_id);
      invariant(profile.evidence.find((entry) => entry.question_id === citation.question_id)?.reponse === citation.reponse, "Une réponse citée ne correspond pas au questionnaire.");
      cited.add(citation.question_id);
    }
  }
  invariant(questions.every((question) => cited.has(question.id)), `Les ${questions.length} réponses doivent avoir un effet explicite dans le dossier.`);
  const words = countWords(draft.build_prompt);
  invariant(words >= 700 && words <= 900, `Le prompt contient ${words} mots ; 700 à 900 sont requis.`);
  const firstIdea = candidates.find((candidate) => candidate.id === draft.selections.find((selection) => selection.rang === 1)!.idea_id)!;
  for (let week = 1; week <= 4; week++) {
    const weekTasks = draft.tasks.filter((task) => task.semaine === week).sort((a, b) => a.position - b.position);
    invariant(weekTasks.length >= 5 && weekTasks.length <= 7, "Chaque semaine doit contenir cinq à sept tâches.");
    invariant(weekTasks.every((task, index) => task.position === index + 1), "Les positions des tâches doivent être consécutives et distinctes.");
    invariant(weekTasks.every((task) => task.canal_id === "none" || allowedChannels(firstIdea).some((channel) => channel.id === task.canal_id)), "Une tâche propose un canal incompatible.");
  }
  return draft;
}

export function contentFromDraft(draft: GeneratedDraft, candidates: Idea[]): DossierContent {
  return {
    selections: [...draft.selections].sort((a, b) => a.rang - b.rang).map((selection) => {
      const idea = candidates.find((candidate) => candidate.id === selection.idea_id)!;
      return {
        id: crypto.randomUUID(), idea_id: idea.id, idea_snapshot: idea, rang: selection.rang,
        justification: selection.justification, adaptation: selection.adaptation,
        canal_acquisition: acquisitionFor(idea, selection.canal_id),
        risque: selection.risque, reponses_citees: selection.reponses_citees,
      };
    }),
    build_prompt: draft.build_prompt,
    tasks: [...draft.tasks].sort((a, b) => a.semaine - b.semaine || a.position - b.position).map((task) => ({ id: crypto.randomUUID(), semaine: task.semaine, position: task.position, libelle: task.libelle, done: false })),
  };
}
