import type { Answers } from "@/types/domain";
import { answerLabel, questions } from "./questions";
import { validateAnswers } from "./schemas";

export type UserProfile = {
  answers: Answers;
  ageRange: string;
  buyer: string;
  domains: string[];
  skills: string;
  maxTechnicalDifficulty: number;
  weeklyHours: number;
  zone: string;
  billing: string;
  competition: string;
  revenueGoal: number;
  evidence: { question_id: string; question: string; reponse: string }[];
};

const technicalCeiling: Record<string, number> = { application: 5, interface: 3, sans_code: 2, aucune: 1 };
const hoursPerWeek: Record<string, number> = { moins_1h: 4, "1h": 7, "2_3h": 15, journee: 35 };

export function buildProfile(input: Answers): UserProfile {
  const answers = validateAnswers(input);
  const skills = String(answers.competences);
  return {
    answers,
    ageRange: String(answers.tranche_age),
    buyer: String(answers.cible_client),
    domains: answers.domaines as string[],
    skills,
    maxTechnicalDifficulty: technicalCeiling[skills],
    weeklyHours: hoursPerWeek[String(answers.temps_jour)],
    zone: String(answers.zone),
    billing: String(answers.facturation),
    competition: String(answers.concurrence),
    revenueGoal: Number(answers.objectif_revenu),
    evidence: questions.map((question) => ({ question_id: question.id, question: question.label, reponse: answerLabel(question.id, answers[question.id]) })),
  };
}
