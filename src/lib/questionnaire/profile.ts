import type { Answers } from "@/types/domain";
import { answerLabel, questions } from "./questions";
import { validateAnswers } from "./schemas";

export type UserProfile = {
  answers: Answers;
  weeklyHours: number;
  budgetEuros: number;
  firstEuroDays: number;
  maxTechnicalDifficulty: number;
  codeLevel: string;
  aiSkill: number;
  designSkill: number;
  salesSkill: number;
  videoSkill: number;
  sector: string;
  communities: string;
  audience: string;
  network: string;
  languages: string[];
  acceptsFace: boolean;
  acceptsCold: boolean;
  risk: string;
  preferredTypes: string[];
  dislikes: string[];
  ambition: string;
  incomeExperience: string;
  evidence: { question_id: string; question: string; reponse: string }[];
};

export function buildProfile(input: Answers): UserProfile {
  const answers = validateAnswers(input);
  const codeLevel = String(answers.niveau_code);
  return {
    answers,
    weeklyHours: Number(answers.temps_semaine),
    budgetEuros: Number(answers.budget_depart),
    firstEuroDays: Number(answers.delai_premier_euro),
    maxTechnicalDifficulty: ({ aucun: 1, lecture: 2, debutant: 3, confirme: 5 } as Record<string, number>)[codeLevel],
    codeLevel,
    aiSkill: Number(answers.aisance_ia),
    designSkill: Number(answers.niveau_design),
    salesSkill: Number(answers.niveau_vente),
    videoSkill: Number(answers.niveau_video),
    sector: String(answers.secteur),
    communities: String(answers.communautes),
    audience: String(answers.audience),
    network: String(answers.reseau_pro),
    languages: answers.langues as string[],
    acceptsFace: answers.montrer_visage === "oui",
    acceptsCold: answers.demarchage_froid === "oui",
    risk: String(answers.risque),
    preferredTypes: answers.types_produits as string[],
    dislikes: answers.taches_detestees as string[],
    ambition: String(answers.ambition),
    incomeExperience: String(answers.revenus_en_ligne),
    evidence: questions.map((question) => ({ question_id: question.id, question: question.label, reponse: answerLabel(question.id, answers[question.id]) })),
  };
}
