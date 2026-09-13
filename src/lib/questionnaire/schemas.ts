import { z } from "zod";
import type { Answers } from "@/types/domain";
import { questions } from "./questions";

function schemaFor(question: (typeof questions)[number]): z.ZodType {
  if (question.type === "text") return z.string().trim().min(3, "Précise ta réponse en quelques mots.").max(400, "400 caractères maximum.");
  if (question.type === "scale") return z.number().int().min(1).max(5);
  const allowed = question.options!.map((option) => option.value);
  const choice = z.string().refine((value) => allowed.includes(value), "Choisis une option proposée.");
  if (question.type === "multiple") {
    return z.array(choice).min(1, "Choisis au moins une option.").max(allowed.length)
      .refine((values) => new Set(values).size === values.length, "Les options doivent être distinctes.")
      .refine((values) => !values.includes("aucune") || values.length === 1, "Choisis « Aucune » seule.");
  }
  return choice;
}

export const answerSchemas = Object.fromEntries(questions.map((question) => [question.id, schemaFor(question)]));
export const answersSchema = z.object(answerSchemas).strict();

export function validateAnswer(questionId: string, value: unknown): boolean {
  return Object.hasOwn(answerSchemas, questionId) && answerSchemas[questionId].safeParse(value).success;
}

/** Reject unknown IDs, missing answers, out-of-range values and unbounded text. */
export function validateAnswers(input: unknown): Answers {
  return answersSchema.parse(input) as Answers;
}
