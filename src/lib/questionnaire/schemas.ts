import { z } from "zod";
import type { Answers, Question } from "@/types/domain";
import { questions } from "./questions";

function schemaFor(question: Question): z.ZodType {
  const allowed = question.options.map((option) => option.value);
  const choice = z.string().refine((value) => allowed.includes(value), "Choisissez une option proposée.");
  if (question.type !== "multiple") return choice;
  const max = question.maxChoices ?? allowed.length;
  return z.array(choice).min(1, "Choisissez au moins une option.").max(max, `Choisissez au plus ${max} options.`)
    .refine((values) => new Set(values).size === values.length, "Les options doivent être distinctes.");
}

const answerSchemas = Object.fromEntries(questions.map((question) => [question.id, schemaFor(question)]));
const answersSchema = z.object(answerSchemas).strict();

export function validateAnswer(questionId: string, value: unknown): boolean {
  return Object.hasOwn(answerSchemas, questionId) && answerSchemas[questionId].safeParse(value).success;
}

/** Reject unknown IDs, missing answers and values outside the proposed options. */
export function validateAnswers(input: unknown): Answers {
  return answersSchema.parse(input) as Answers;
}

export function isComplete(answers: Answers): boolean {
  return questions.every((question) => validateAnswer(question.id, answers[question.id]));
}

/** Dossiers payés avec l’ancien questionnaire en neuf questions : les réponses encore posées sont reprises, les nouvelles prennent une valeur neutre. */
export function upgradeLegacyAnswers(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input) || !("competences" in input)) return input;
  const legacy = input as Answers;
  return { objectif_revenu: legacy.objectif_revenu, tranche_age: legacy.tranche_age, delai_premier_euro: "trois_mois", temps_jour: legacy.temps_jour, niveau_video: "a_apprendre" };
}
