import type { Answers, DossierContent, Idea, PlanTask, RoadmapPhase, Selection, VideoIdea } from "@/types/domain";
import { buildProfile, type UserProfile } from "@/lib/questionnaire/profile";
import { answerLabel, formatEuros } from "@/lib/questionnaire/questions";
import { acquisitionFor, ideaRules } from "@/lib/matching/idea-rules";
import { ideas } from "@/lib/matching/filters";
import { matchIdeas } from "@/lib/matching/scoring";

export const videoPlatforms = ["TikTok", "Instagram Reels", "YouTube Shorts", "LinkedIn"] as const;
export type VideoDraft = Omit<VideoIdea, "id" | "lot" | "position">;

/** Textes rédigés à l’avance pour une idée : data/contenus/<id>.json (voir data/contenus/SPEC.md). */
export type IdeaContent = {
  idea_id: string;
  risque: string;
  prompt: { produit: string; ecrans: string[]; donnees: string; criteres: string[] };
  construction: string[];
  videos: VideoDraft[];
  roadmap: RoadmapPhase[];
};
export type ContentLookup = (ideaId: string) => IdeaContent;

/** Profil d’exemple du dossier de démonstration. */
export const demoAnswers: Answers = {
  tranche_age: "25_34", cible_client: "b2b", domaines: ["productivite", "vente"], competences: "sans_code",
  temps_jour: "1h", zone: "francophone", facturation: "abonnement", concurrence: "differencier", objectif_revenu: "2000",
};

const skillEffects: Record<string, string> = {
  application: "Le prompt propose une stack web complète et maintenable, sans infrastructure superflue.",
  interface: "Le prompt s’appuie sur un outil guidé et une base gérée : vous gardez la main sur l’interface sans maintenir de serveur.",
  sans_code: "Le prompt impose un outil visuel sans code, un modèle prêt à adapter et une vérification à chaque étape.",
  aucune: "Le prompt vise un outil très guidé et reste assez précis pour être repris par un associé technique.",
};
const zoneEffects: Record<string, string> = {
  francophone: "Le lancement vise d’abord des clients francophones, avec un produit rédigé en français.",
  anglophone: "Le produit, l’offre et les échanges sont préparés en anglais pour un premier marché anglophone.",
  europe: "Le lancement commence par un seul pays européen et une langue, avant d’élargir.",
  mondial: "Le lancement commence dans une seule langue pour mesurer l’intérêt avant d’élargir.",
};
const competitionEffects: Record<string, string> = {
  nouveau: "Les dix conversations servent d’abord à prouver que le besoin existe, avant de construire.",
  differencier: "Les entretiens identifient l’outil déjà utilisé par la cible et l’angle précis sur lequel vous démarquer.",
  depend: "Le positionnement sera choisi après les premières conversations, selon les alternatives rencontrées.",
};
const stacks: Record<string, string> = {
  aucune: "Utilise un constructeur très guidé comme Lovable, avec une base simple, des formulaires et un espace réservé au propriétaire. Explique chaque étape en langage simple et donne une vérification après chacune. Rédige aussi des consignes qu’un associé technique pourra reprendre. Ne demande aucune commande terminal. Vérifie les limites des offres gratuites avant de choisir les outils.",
  sans_code: "Utilise un constructeur visuel no-code avec une base simple, des formulaires et un espace réservé au propriétaire. Guide chaque clic et explique les vérifications. Commence par une instance séparée par client et des modèles duplicables. Ne demande aucune commande terminal. Vérifie les limites des offres avant de choisir les outils.",
  interface: "Utilise une stack guidée avec un constructeur visuel et Supabase pour la base. Fournis les petites modifications une par une, explique où les appliquer et donne une vérification après chacune. Évite les intégrations externes. Commence par une instance séparée par client et une authentification gérée par le fournisseur.",
  application: "Utilise Next.js, TypeScript, Supabase pour les comptes et la base, puis Vercel pour publier. Garde une structure courte avec validation serveur, accès par propriétaire et composants réutilisables. Explique les variables nécessaires et fournis une migration reproductible. Aucune infrastructure personnalisée, aucun traitement asynchrone complexe et aucune intégration non indispensable.",
};
const markets: Record<string, string> = {
  francophone: "Rédige le produit en français et vise d’abord des clients francophones.",
  anglophone: "Rédige le produit, la page d’accueil et les emails en anglais pour un premier marché anglophone.",
  europe: "Commence par un seul pays européen et sa langue ; garde les traductions pour après la validation.",
  mondial: "Commence dans une seule langue, puis ajoute des traductions seulement après la validation.",
};
const billingModels: Record<string, string> = {
  abonnement: "Propose d’abord un abonnement mensuel simple, sans engagement.",
  usage: "Teste une facturation à l’usage avec un volume inclus clairement annoncé.",
  licence: "Propose aux premiers clients une licence annuelle payée en une fois.",
  indifferent: "Garde le modèle commercial annoncé pour cette idée.",
};

function monthlyCustomers(idea: Idea, revenueGoal: number): number | null {
  const price = /(\d+(?:[.,]\d+)?)\s*€\/mois/.exec(idea.prix_conseille);
  return price ? Math.ceil(revenueGoal / Number(price[1].replace(",", "."))) : null;
}

function billingEffect(idea: Idea, profile: UserProfile): string {
  if (profile.billing === "abonnement") return idea.modele_eco.startsWith("Abonnement") ? `Le modèle « ${idea.modele_eco} » correspond à votre préférence pour l’abonnement.` : `Une formule mensuelle est testée à côté du prix prévu : ${idea.prix_conseille}.`;
  if (profile.billing === "usage") return "Le prix est testé à l’usage, avec un volume inclus clair et un dépassement annoncé à l’avance.";
  if (profile.billing === "licence") return "Une licence annuelle est proposée aux premiers clients, avec un prix d’essai à valider.";
  return `Le modèle retenu reste celui de l’idée : ${idea.modele_eco}.`;
}

function effectsFor(profile: UserProfile, idea: Idea): Record<string, string> {
  const rule = ideaRules[idea.id];
  const customers = monthlyCustomers(idea, profile.revenueGoal);
  const goal = formatEuros(profile.revenueGoal);
  return {
    tranche_age: profile.ageRange === "moins_18"
      ? "Le plan prévoit l’accompagnement d’un représentant légal pour créer l’activité et encaisser les premiers paiements."
      : "Le plan suppose que vous encaissez vous-même : vérifiez le statut adapté à votre activité avant la première vente.",
    cible_client: profile.buyer === "b2c"
      ? "L’offre privilégie des personnes qui paient pour leur propre usage, avec un parcours d’achat court."
      : profile.buyer === "b2b" ? `L’offre s’adresse à des professionnels précis : ${idea.cible}` : `Le problème désigne l’acheteur : ${idea.cible}`,
    domaines: `Vos domaines « ${answerLabel("domaines", profile.domains)} » orientent le vocabulaire, les exemples et l’angle du produit.`,
    competences: skillEffects[profile.skills],
    temps_jour: rule.effort_mvp_heures <= profile.weeklyHours
      ? `Le MVP demande environ ${rule.effort_mvp_heures} heures, dans vos ${profile.weeklyHours} heures par semaine ; le reste du mois sert à valider et vendre.`
      : `Le MVP est découpé en sessions courtes pour avancer avec environ ${profile.weeklyHours} heures par semaine ; les fonctions secondaires attendent la validation.`,
    zone: zoneEffects[profile.zone],
    facturation: billingEffect(idea, profile),
    concurrence: competitionEffects[profile.competition],
    objectif_revenu: customers
      ? `Pour atteindre ${goal} par mois au prix testé, il faudrait environ ${customers} clients payants : un repère de travail, pas une promesse.`
      : `Votre objectif de ${goal} par mois sert de repère pour fixer le prix à tester, sans promesse de revenu.`,
  };
}

export function buildPrompt(idea: Idea, content: IdeaContent, profile: UserProfile): string {
  const rule = ideaRules[idea.id];
  const customers = monthlyCustomers(idea, profile.revenueGoal);
  const time = rule.effort_mvp_heures <= profile.weeklyHours
    ? `La construction dispose d’environ ${profile.weeklyHours} heures pendant la deuxième semaine, pour un périmètre estimé à ${rule.effort_mvp_heures} heures.`
    : `La construction avance par sessions courtes, avec environ ${profile.weeklyHours} heures par semaine : découpe le périmètre en livrables indépendants.`;
  const criteria = [
    ...content.prompt.criteres,
    "Le parcours fonctionne à 390 pixels, sur ordinateur et au clavier.",
    "Deux comptes ne voient jamais les données de l’autre.",
    "Chargement, réussite, erreur, paiement de test et accès refusé sont vérifiés.",
  ];
  return `# Construire ${idea.nom}

## Le produit
${content.prompt.produit} Cible initiale : ${idea.cible}${profile.buyer === "b2c" ? " Adapte l’offre aux particuliers quand c’est pertinent." : ""} Périmètre autorisé : ${rule.scope}. N’ajoute aucune fonction hors de ce périmètre.

## Contraintes de la personne qui construit
${time} Réserve les autres semaines à la validation, aux essais et à la vente. Mes domaines de prédilection sont ${answerLabel("domaines", profile.domains)}. Mon objectif est d’atteindre ${formatEuros(profile.revenueGoal)} par mois ; ${customers ? `au prix testé, cela représente environ ${customers} clients payants, un repère de travail et non une promesse.` : "le prix testé servira à estimer le nombre de clients nécessaires, sans promesse de revenu."}${profile.ageRange === "moins_18" ? " Je suis mineur : un représentant légal doit accompagner la création de l’activité et l’encaissement." : ""} Signale tout dépassement du périmètre.

## Stack et accompagnement
${stacks[profile.skills]} Avance une action à la fois, vérifie chaque résultat à l’écran et garde un design sobre d’une seule couleur.

## Parcours, écran par écran
${content.prompt.ecrans.map((screen, index) => `${index + 1}. ${screen}`).join("\n")}

## Données et accès
${content.prompt.donnees} Applique ces règles côté serveur ou en base : une URL secrète ne remplace jamais un contrôle d’accès. Prévois la correction, l’export et la suppression des données.

## Paiement et mise en ligne
Le prix à tester est ${idea.prix_conseille}. ${billingModels[profile.billing]} Utilise un lien de paiement hébergé chez Stripe et n’ouvre l’accès qu’après un paiement vérifié, jamais sur un simple paramètre de retour. Aucune carte n’est collectée dans le produit. Distingue mode test et mode réel, et affiche les conditions et les coordonnées du vendeur.

## Acquisition et aide
Le premier canal retenu est : ${acquisitionFor(idea)} ${markets[profile.zone]} Ajoute cinq réponses aux questions fréquentes et un contact humain.

## Critères d’acceptation
${criteria.map((criterion) => `- ${criterion}`).join("\n")}`;
}

export function buildTasks(idea: Idea, content: IdeaContent, profile: UserProfile): PlanTask[] {
  const rule = ideaRules[idea.id];
  const channel = acquisitionFor(idea);
  const guided = profile.skills === "aucune" || profile.skills === "sans_code";
  const weeks = [
    [
      `Définir une seule cible à interroger : ${idea.cible}`,
      `Trouver dix volontaires pour un échange via ce canal : ${channel}`,
      "Préparer quatre questions sur le dernier problème rencontré, son coût et la solution utilisée aujourd’hui.",
      "Mener cinq conversations réelles et noter les mots employés sans présenter le produit trop tôt.",
      "Mener cinq autres conversations et comparer les problèmes répétés aux cinq premiers retours.",
      profile.competition === "nouveau"
        ? "Décider de poursuivre ou d’arrêter : ne construire que si le besoin revient clairement dans les dix échanges."
        : "Noter l’outil déjà utilisé par chaque personne et l’angle qui permettrait de s’en distinguer.",
    ],
    [
      rule.effort_mvp_heures <= profile.weeklyHours
        ? `Copier le prompt et vérifier que le périmètre tient dans ${rule.effort_mvp_heures} heures de construction.`
        : `Copier le prompt et découper le périmètre en sessions courtes, dans vos ${profile.weeklyHours} heures hebdomadaires.`,
      guided ? "Choisir un modèle guidé, vérifier ses limites gratuites et suivre sa configuration étape par étape." : "Préparer le projet, la base et les variables de test avec un premier écran fonctionnel.",
      ...content.construction,
    ],
    [
      "Mettre en ligne une version de test et vérifier le parcours sur un téléphone de 390 pixels.",
      `Créer un paiement en mode test pour l’offre « ${idea.prix_conseille} » et contrôler le montant affiché.`,
      "Vérifier paiement réussi, paiement annulé et accès refusé ; préparer les coordonnées vendeur et les conditions avant le mode réel.",
      `Inviter cinq bêta-testeurs volontaires par le canal retenu : ${channel}`,
      "Observer les cinq essais, noter les blocages et corriger d’abord ce qui empêche d’obtenir le résultat principal.",
      "Créer une démonstration avec trois captures annotées et une page d’aide courte.",
    ],
    [
      `Rédiger une offre simple : résultat concret, périmètre exact et prix à tester ${idea.prix_conseille}.`,
      `Activer le canal choisi avec une première ressource utile ou des échanges consentis : ${channel}`,
      "Proposer l’offre payante aux testeurs intéressés et suivre les réponses sans annoncer de résultat garanti.",
      "Viser dix premiers clients payants en suivant les propositions, les objections et les paiements réellement confirmés.",
      "Demander un retour d’usage et une présentation consentie aux utilisateurs satisfaits, sans inventer de témoignage.",
      `Faire le bilan du mois : temps passé, dépenses, usage et ventes réelles, comparés à votre objectif de ${formatEuros(profile.revenueGoal)} par mois.`,
    ],
  ];
  return weeks.flatMap((tasks, weekIndex) => tasks.map((libelle, position) => ({ id: `tache-${idea.id}-s${weekIndex + 1}-${position + 1}`, semaine: weekIndex + 1, position: position + 1, libelle, done: false })));
}

/** Remplace les deux balises autorisées dans le plan de A à Z. */
export function fillRoadmap(roadmap: RoadmapPhase[], profile: UserProfile): RoadmapPhase[] {
  const fill = (text: string) => text.replaceAll("{objectif_revenu}", `${formatEuros(profile.revenueGoal)} par mois`).replaceAll("{heures_par_semaine}", String(profile.weeklyHours));
  return roadmap.map((phase) => ({ titre: fill(phase.titre), periode: fill(phase.periode), objectif: fill(phase.objectif), actions: phase.actions.map(fill), indicateur: fill(phase.indicateur) }));
}

/** Les trois idées, le prompt et le plan sur 30 jours, sans aucun appel externe. */
export function buildDossierContent(answers: Answers, lookup: ContentLookup): DossierContent {
  const profile = buildProfile(answers);
  const matches = matchIdeas(profile).slice(0, 3);
  const selections: Selection[] = matches.map((idea, index) => {
    const effects = effectsFor(profile, idea);
    return {
      id: `selection-${idea.id}`, idea_id: idea.id, idea_snapshot: idea, rang: index + 1,
      justification: `${effects.domaines} ${effects.cible_client} ${effects.temps_jour}`,
      adaptation: `Commencez uniquement par ${ideaRules[idea.id].scope}. ${effects.competences} ${effects.zone} Le prix est une hypothèse à valider avec la cible, jamais une estimation de revenu.`,
      canal_acquisition: acquisitionFor(idea),
      risque: `${lookup(idea.id).risque} ${effects.concurrence}`,
      reponses_citees: profile.evidence.filter((_, evidenceIndex) => evidenceIndex % 3 === index).map((evidence) => ({ question_id: evidence.question_id, reponse: evidence.reponse, effet: effects[evidence.question_id] })),
    };
  });
  const first = lookup(matches[0].id);
  return { selections, build_prompt: buildPrompt(matches[0], first, profile), tasks: buildTasks(matches[0], first, profile) };
}

/** Bonus de la formule : les premières idées de vidéos et, pour 12 mois, le plan de A à Z. */
export function buildExtras(answers: Answers, ideaId: string, parts: { videos: number; roadmap: boolean }, lookup: ContentLookup): { videos?: VideoDraft[]; roadmap?: RoadmapPhase[] } {
  if (!ideas.some((idea) => idea.id === ideaId)) throw new Error("L’idée principale du dossier est introuvable.");
  const content = lookup(ideaId);
  return {
    ...(parts.videos > 0 ? { videos: content.videos.slice(0, parts.videos) } : {}),
    ...(parts.roadmap ? { roadmap: fillRoadmap(content.roadmap, buildProfile(answers)) } : {}),
  };
}

export function withVideoIds(videos: VideoDraft[], prefix: string): VideoIdea[] {
  return videos.map((video, index) => ({ ...video, id: `${prefix}-${index + 1}`, lot: 1, position: index + 1 }));
}
