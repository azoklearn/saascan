import type { Question } from "@/types/domain";

const euros = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
export const formatEuros = (amount: number) => `${euros.format(amount)} €`;

const revenueSteps = [300, 500, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000, 50000];

// Les identifiants reprennent des questions déjà autorisées par la base (contrainte responses_question_id_check).
export const questions: Question[] = [
  {
    id: "objectif_revenu", type: "range",
    label: "Combien aimeriez-vous gagner chaque mois ?",
    description: "Faites glisser le curseur jusqu’au revenu mensuel que vous visez.",
    defaultValue: "2000",
    options: revenueSteps.map((amount, index) => {
      const last = index === revenueSteps.length - 1;
      return { value: String(amount), label: `${formatEuros(amount)} par mois${last ? " ou plus" : ""}`, short: `${formatEuros(amount)}/mois${last ? " et +" : ""}` };
    }),
  },
  {
    id: "tranche_age", type: "single",
    label: "Quelle est votre tranche d’âge ?",
    options: [
      { value: "moins_18", label: "Moins de 18 ans" },
      { value: "18_24", label: "18 à 24 ans" },
      { value: "25_34", label: "25 à 34 ans" },
      { value: "35_44", label: "35 à 44 ans" },
      { value: "45_54", label: "45 à 54 ans" },
      { value: "55_plus", label: "55 ans et plus" },
    ],
  },
  {
    id: "delai_premier_euro", type: "single",
    label: "Quand voulez-vous faire votre première vente ?",
    options: [
      { value: "deux_semaines", label: "Le plus vite possible, sous deux semaines", short: "Sous deux semaines" },
      { value: "un_mois", label: "D’ici un mois" },
      { value: "trois_mois", label: "D’ici trois mois" },
      { value: "sans_urgence", label: "Rien ne presse, j’avance à mon rythme", short: "Sans urgence" },
    ],
  },
  {
    id: "temps_jour", type: "single",
    label: "Combien de temps par jour pouvez-vous y consacrer ?",
    options: [
      { value: "moins_1h", label: "Moins d’une heure — sur les temps morts", short: "Moins d’une heure" },
      { value: "1h", label: "Une heure environ — avant ou après le travail", short: "Une heure par jour" },
      { value: "2_3h", label: "Deux à trois heures — mes soirées", short: "Deux à trois heures" },
      { value: "journee", label: "La journée entière — c’est mon activité", short: "Journée entière" },
    ],
  },
  {
    id: "niveau_video", type: "single",
    label: "Savez-vous créer du contenu, comme des vidéos courtes ?",
    options: [
      { value: "face_camera", label: "Oui, et je suis à l’aise face caméra", short: "À l’aise face caméra" },
      { value: "sans_visage", label: "Oui, mais sans montrer mon visage", short: "Contenu sans visage" },
      { value: "a_apprendre", label: "Pas encore, mais je veux apprendre", short: "Contenu à apprendre" },
      { value: "non", label: "Non, je préfère éviter", short: "Sans contenu" },
    ],
  },
];

export function answerLabel(questionId: string, value: unknown): string {
  const question = questions.find((entry) => entry.id === questionId);
  const values = Array.isArray(value) ? value : [value];
  return values.map((entry) => question?.options.find((option) => option.value === String(entry))?.label ?? String(entry ?? "")).join(", ");
}

export function shortAnswer(question: Question, value: unknown): string {
  const labels = (Array.isArray(value) ? value : [value]).flatMap((entry) => {
    const option = question.options.find((candidate) => candidate.value === entry);
    return option ? [option.short ?? option.label] : [];
  });
  return labels.length > 1 ? `${labels[0]} +${labels.length - 1}` : labels[0] ?? "";
}
