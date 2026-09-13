import type { Question } from "@/types/domain";

const euros = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
export const formatEuros = (amount: number) => `${euros.format(amount)} €`;

const revenueSteps = [300, 500, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000, 50000];

export const questions: Question[] = [
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
    id: "cible_client", type: "single",
    label: "À qui préférez-vous vendre ?",
    description: "Ce choix oriente tout le reste — laissez SaaScan décider si vous hésitez.",
    options: [
      { value: "b2b", label: "B2B — vendre aux entreprises", short: "B2B", detail: "Vos clients sont des sociétés ou des indépendants. Peu de clients, abonnements élevés, décision plus lente." },
      { value: "b2c", label: "B2C — vendre aux particuliers", short: "B2C", detail: "Vos clients sont des gens, pour leur usage personnel. Beaucoup de clients, petits montants, achat immédiat." },
      { value: "decide", label: "SaaScan décide", detail: "On tranche selon le problème trouvé : c’est lui qui désigne l’acheteur." },
    ],
  },
  {
    id: "domaines", type: "multiple", maxChoices: 3,
    label: "Sur quels domaines faut-il vous écouter en priorité ?",
    description: "Un à trois choix.",
    options: [
      { value: "productivite", label: "Productivité & organisation" },
      { value: "marketing", label: "Marketing & acquisition" },
      { value: "vente", label: "Vente & CRM" },
      { value: "finance", label: "Finance & compta" },
      { value: "developpement", label: "Développement & outils" },
      { value: "donnees", label: "Données & analyse" },
      { value: "contenu", label: "Création de contenu & médias" },
      { value: "ecommerce", label: "Commerce en ligne" },
      { value: "education", label: "Éducation & formation" },
      { value: "sante", label: "Santé & bien-être" },
      { value: "communautes", label: "Communautés & réseaux" },
      { value: "automatisation", label: "Automatisation & sans-code" },
      { value: "contenu_ia", label: "Création de contenu IA" },
      { value: "nocode", label: "No-code & vibecoding" },
      { value: "sport", label: "Sport & compétitions" },
      { value: "trading", label: "Trading & marchés" },
    ],
  },
  {
    id: "competences", type: "single",
    label: "Que pouvez-vous faire seul ?",
    options: [
      { value: "application", label: "Une application complète, interface et serveur", short: "Application complète" },
      { value: "interface", label: "L’interface, ou du sans-code avancé", short: "Interface" },
      { value: "sans_code", label: "Du sans-code et des automatisations", short: "Sans-code" },
      { value: "aucune", label: "Rien de technique — je m’associe pour le code", short: "Non technique" },
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
    id: "zone", type: "single",
    label: "Quelle zone géographique visez-vous d’abord ?",
    options: [
      { value: "francophone", label: "Francophone" },
      { value: "anglophone", label: "Anglophone" },
      { value: "europe", label: "Europe, plusieurs langues", short: "Europe" },
      { value: "mondial", label: "Mondial, indifférent à la langue", short: "Mondial" },
    ],
  },
  {
    id: "facturation", type: "single",
    label: "Quel modèle de facturation vous conviendrait le mieux ?",
    options: [
      { value: "abonnement", label: "Abonnement récurrent — par siège ou par société", short: "Abonnement" },
      { value: "usage", label: "À l’usage — volume, API, transactions", short: "À l’usage" },
      { value: "licence", label: "Licence annuelle" },
      { value: "indifferent", label: "Indifférent", short: "Facturation indifférente" },
    ],
  },
  {
    id: "concurrence", type: "single",
    label: "Face à la concurrence, vous vous situez plutôt où ?",
    options: [
      { value: "nouveau", label: "Un besoin que personne n’adresse vraiment, quitte à l’expliquer", short: "Besoin inexploré" },
      { value: "differencier", label: "Un marché encombré, mais où je peux me différencier", short: "Se différencier" },
      { value: "depend", label: "Ça dépend du problème", short: "Selon le problème" },
    ],
  },
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
