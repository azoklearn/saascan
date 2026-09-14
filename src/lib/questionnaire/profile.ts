import type { Answers } from "@/types/domain";
import { answerLabel, questions } from "./questions";
import { validateAnswers } from "./schemas";

export type UserProfile = {
  answers: Answers;
  revenueGoal: number;
  ageRange: string;
  /** Valeur de `delai_premier_euro`. */
  firstSale: string;
  weeklyHours: number;
  /** Valeur de `niveau_video`. */
  content: string;
  evidence: { question_id: string; question: string; reponse: string }[];
};

const hoursPerWeek: Record<string, number> = { moins_1h: 4, "1h": 7, "2_3h": 15, journee: 35 };

export function buildProfile(input: Answers): UserProfile {
  const answers = validateAnswers(input);
  return {
    answers,
    revenueGoal: Number(answers.objectif_revenu),
    ageRange: String(answers.tranche_age),
    firstSale: String(answers.delai_premier_euro),
    weeklyHours: hoursPerWeek[String(answers.temps_jour)],
    content: String(answers.niveau_video),
    evidence: questions.map((question) => ({ question_id: question.id, question: question.label, reponse: answerLabel(question.id, answers[question.id]) })),
  };
}
