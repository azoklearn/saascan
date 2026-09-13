import type { Question } from "@/types/domain";

export const blocks = [
  { id: 1, label: "Acte I · Où tu en es", description: "Quatre questions sur ta situation réelle. Réponds sans filtre." },
  { id: 2, label: "Acte II · Ce qui coince", description: "La partie la plus utile : ce qui t’a freiné jusqu’ici." },
  { id: 3, label: "Acte III · Ce que tu veux", description: "La situation que tu vis décide du produit à construire." },
  { id: 4, label: "Acte IV · Ta signature", description: "Tes limites et ton terrain dessinent la stratégie." },
  { id: 5, label: "Fin de l’acte", description: "Ce qu’on retient de toi avant d’assembler ton dossier." },
] as const;

const skillOptions = [
  { value: "1", label: "Je débute", detail: "Je n’ai encore jamais pratiqué." },
  { value: "2", label: "Quelques bases", detail: "Je peux suivre un exemple." },
  { value: "3", label: "Autonome", detail: "Je me débrouille sur des cas simples." },
  { value: "4", label: "À l’aise", detail: "Je pratique régulièrement." },
  { value: "5", label: "Très à l’aise", detail: "Je pourrais aider quelqu’un à apprendre." },
];

export const questions: Question[] = [
  {
    id: "temps_semaine", block: 1, type: "single",
    label: "Tu peux y consacrer combien d’heures par semaine ?",
    description: "Réponds avec le rythme que tu peux vraiment tenir.",
    options: [
      { value: "3", label: "Moins de 5 h" },
      { value: "5", label: "5 à 15 h" },
      { value: "10", label: "15 à 20 h" },
      { value: "20", label: "Plus de 20 h" },
    ],
  },
  {
    id: "budget_depart", block: 1, type: "single",
    label: "Quel budget peux-tu engager avant ton premier client ?",
    description: "Cette somme couvre les outils et la mise en ligne. Choisis un plafond que tu peux te permettre de perdre.",
    options: [
      { value: "0", label: "0 €", detail: "Je commence avec les offres gratuites." },
      { value: "50", label: "50 € maximum", detail: "De quoi payer les premiers outils." },
      { value: "150", label: "150 € maximum", detail: "Un peu de marge pour construire." },
      { value: "500", label: "500 € maximum", detail: "Je peux financer un petit lancement." },
    ],
  },
  {
    id: "revenus_en_ligne", block: 1, type: "single",
    label: "Tu en es où avec le business en ligne ?",
    description: "La réponse nous aide à calibrer le point de départ.",
    options: [
      { value: "jamais", label: "Je n’ai jamais rien lancé" },
      { value: "moins_500", label: "J’ai lancé, puis abandonné" },
      { value: "500_2000", label: "J’ai déjà vendu quelque chose" },
      { value: "plus_2000", label: "J’ai déjà un truc qui tourne" },
    ],
  },
  {
    id: "delai_premier_euro", block: 1, type: "single",
    label: "D’ici quand ça doit marcher ?",
    description: "Donne-nous ton horizon. On s’en sert pour le rythme du plan.",
    options: [
      { value: "30", label: "30 jours", detail: "Une offre très simple à tester vite." },
      { value: "60", label: "60 jours", detail: "Du temps pour apprendre et valider." },
      { value: "90", label: "90 jours", detail: "Une progression sans précipitation." },
    ],
  },
  { id: "niveau_code", block: 2, type: "single", label: "Où en es-tu avec le code ?", description: "Le prompt de construction s’adaptera à ce niveau exact.", options: [
    { value: "aucun", label: "Je ne sais pas coder", detail: "Je veux un outil guidé et des étapes simples." },
    { value: "lecture", label: "Je sais lire et modifier du code", detail: "Avec une explication ou un exemple." },
    { value: "debutant", label: "Je code des projets simples", detail: "Je sais construire une petite application." },
    { value: "confirme", label: "Je développe régulièrement", detail: "Je suis autonome du début à la mise en ligne." },
  ] },
  { id: "aisance_ia", block: 2, type: "scale", label: "À quel point es-tu à l’aise avec les outils d’IA ?", description: "Pense à ta dernière utilisation de ChatGPT, Claude ou d’un outil de création assistée.", options: skillOptions },
  { id: "niveau_design", block: 2, type: "scale", label: "Peux-tu créer seul une page claire et soignée ?", description: "On parle de mise en page et de lisibilité, pas de dessiner un logo.", options: skillOptions },
  { id: "niveau_vente", block: 2, type: "scale", label: "Peux-tu expliquer une offre et demander un paiement ?", description: "Pense à une conversation réelle avec quelqu’un qui pourrait acheter.", options: skillOptions },
  { id: "niveau_video", block: 2, type: "scale", label: "Sais-tu tourner et monter une vidéo de moins d’une minute ?", description: "Un enregistrement d’écran compte aussi. Montrer ton visage sera une question séparée.", options: skillOptions },
  { id: "secteur", block: 3, type: "text", label: "Quel métier ou domaine d’études connais-tu de l’intérieur ?", description: "Donne un domaine précis et ce que tu y fais. Si tu débutes, cite une activité que tu pratiques vraiment.", placeholder: "Ex. assistante dans un cabinet d’architectes depuis 2 ans" },
  { id: "communautes", block: 3, type: "text", label: "Dans quelle communauté peux-tu déjà engager une conversation ?", description: "Nomme un groupe précis et ton lien avec lui. Écris « aucune » si tu pars de zéro.", placeholder: "Ex. le groupe WhatsApp des artisans de ma ville ; j’y suis membre" },
  { id: "audience", block: 3, type: "text", label: "Quelle audience peux-tu contacter aujourd’hui ?", description: "Indique la plateforme, le nombre de personnes et le sujet. Écris « aucune » si tu n’en as pas.", placeholder: "Ex. 350 abonnés LinkedIn autour du métier de coach" },
  { id: "reseau_pro", block: 3, type: "single", label: "Combien de professionnels peux-tu contacter personnellement cette semaine ?", description: "Compte seulement ceux qui te connaissent déjà et pourraient parler d’un problème de leur métier.", options: [
    { value: "0", label: "Aucun pour l’instant" }, { value: "1_5", label: "1 à 5 personnes" }, { value: "6_20", label: "6 à 20 personnes" }, { value: "plus_20", label: "Plus de 20 personnes" },
  ] },
  { id: "langues", block: 3, type: "multiple", label: "Dans quelles langues peux-tu accompagner un client ?", description: "Choisis seulement les langues dans lesquelles tu peux répondre à une question de support.", options: [
    { value: "francais", label: "Français" }, { value: "anglais", label: "Anglais" }, { value: "espagnol", label: "Espagnol" }, { value: "allemand", label: "Allemand" }, { value: "italien", label: "Italien" },
  ] },
  { id: "montrer_visage", block: 4, type: "single", label: "Acceptes-tu de montrer ton visage dans du contenu public ?", description: "Ta réponse est une limite : aucune stratégie face caméra ne sera proposée si tu refuses.", options: [{ value: "oui", label: "Oui, je suis partant" }, { value: "non", label: "Non, je préfère rester hors caméra" }] },
  { id: "demarchage_froid", block: 4, type: "single", label: "Acceptes-tu d’envoyer un premier message à quelqu’un qui ne te connaît pas ?", description: "Il s’agit de messages individuels pertinents, jamais d’envois en masse.", options: [{ value: "oui", label: "Oui, je peux le faire" }, { value: "non", label: "Non, je veux un autre canal" }] },
  { id: "risque", block: 4, type: "single", label: "Quelle incertitude es-tu prêt à accepter ?", description: "Choisis le scénario dans lequel tu continuerais à travailler sereinement.", options: [
    { value: "faible", label: "Je veux limiter le risque", detail: "Un problème connu, confirmé avant de construire." },
    { value: "modere", label: "Je peux tester une hypothèse", detail: "J’accepte quelques essais et ajustements." },
    { value: "eleve", label: "Je peux explorer une niche nouvelle", detail: "Je peux investir du temps sans résultat rapide." },
  ] },
  { id: "types_produits", block: 5, type: "multiple", label: "Quels produits aurais-tu envie de construire ?", description: "Choisis tes préférences. Une marketplace sera ramenée à un outil pour un seul côté du marché afin de rester réalisable seul.", options: [
    { value: "b2b", label: "Un outil pour les professionnels" }, { value: "createur", label: "Un outil pour les créateurs" }, { value: "marketplace", label: "Un outil autour d’une marketplace" }, { value: "automatisation", label: "Une automatisation utile" }, { value: "infoproduit", label: "Un outil pour transmettre un savoir" },
  ] },
  { id: "taches_detestees", block: 5, type: "multiple", label: "Quelles tâches veux-tu éviter au quotidien ?", description: "Sélectionne tes vrais repoussoirs, ou « Aucune de cette liste ».", options: [
    { value: "code", label: "Déboguer du code" }, { value: "design", label: "Peaufiner le design" }, { value: "vente", label: "Vendre en direct" }, { value: "video", label: "Créer des vidéos" }, { value: "support", label: "Faire du support client" }, { value: "administratif", label: "Faire de la saisie répétitive" }, { value: "aucune", label: "Aucune de cette liste" },
  ] },
  { id: "ambition", block: 5, type: "single", label: "Quel rôle veux-tu donner à ce projet ?", description: "Cela change le périmètre, les prix à tester et le rythme de ton plan.", options: [
    { value: "complement", label: "Un complément de revenu", detail: "Un petit produit simple à entretenir." },
    { value: "plein_temps", label: "En faire mon activité principale", detail: "Valider une offre récurrente que je peux développer." },
  ] },
];

export function answerLabel(questionId: string, value: unknown): string {
  const question = questions.find((entry) => entry.id === questionId);
  const values = Array.isArray(value) ? value : [value];
  return values.map((entry) => question?.options?.find((option) => option.value === String(entry))?.label ?? String(entry ?? "")).join(", ");
}
