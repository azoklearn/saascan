import type { Answers, DossierContent, Idea, PlanTask, RoadmapPhase, Selection, VideoIdea } from "@/types/domain";
import { buildProfile, type UserProfile } from "@/lib/questionnaire/profile";
import { formatEuros } from "@/lib/questionnaire/questions";
import { acquisitionFor, channelFor, ideaRules } from "@/lib/matching/idea-rules";
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
  objectif_revenu: "2000", tranche_age: "25_34", delai_premier_euro: "un_mois", temps_jour: "1h", niveau_video: "face_camera",
};

const firstSaleEffects: Record<string, string> = {
  deux_semaines: "Pour vendre sous deux semaines, le plan retient une idée simple à montrer et des clients faciles à joindre.",
  un_mois: "Le plan vise une première vente d’ici un mois : une semaine pour vérifier le problème, une pour construire, deux pour tester et vendre.",
  trois_mois: "Avec trois mois devant vous, le plan laisse le temps de vérifier le problème en profondeur avant de construire.",
  sans_urgence: "Sans date imposée, le plan avance à votre rythme, en vérifiant toujours le problème avant de construire.",
};
const contentEffects: Record<string, string> = {
  face_camera: "Vous êtes à l’aise face caméra : quand l’idée s’y prête, le premier canal s’appuie sur de courtes vidéos où vous montrez le problème et l’outil.",
  sans_visage: "Vous créez du contenu sans montrer votre visage : les vidéos passent par l’écran, les mains ou le texte, et le premier canal reste un échange direct.",
  a_apprendre: "Le contenu est encore à apprendre : le premier canal repose sur des échanges directs, et les vidéos viennent en complément.",
  non: "Vous préférez éviter le contenu : le premier canal repose sur des échanges directs, sans vidéo à tourner.",
};
const firstSalePrompt: Record<string, string> = {
  deux_semaines: "Je vise une première vente sous deux semaines : priorise ce qui se montre vite.",
  un_mois: "Je vise une première vente d’ici un mois.",
  trois_mois: "Je vise une première vente d’ici trois mois.",
  sans_urgence: "Je n’ai pas de date imposée pour la première vente.",
};
const guidedStack = "Utilise un constructeur visuel très guidé comme Lovable, avec une base simple, des formulaires et un espace réservé au propriétaire. Explique chaque étape en langage simple et donne une vérification après chacune. Rédige aussi des consignes qu’un associé technique pourra reprendre. Ne demande aucune commande terminal. Vérifie les limites des offres gratuites avant de choisir les outils.";

function monthlyCustomers(idea: Idea, revenueGoal: number): number | null {
  const price = /(\d+(?:[.,]\d+)?)\s*€\/mois/.exec(idea.prix_conseille);
  return price ? Math.ceil(revenueGoal / Number(price[1].replace(",", "."))) : null;
}

function effectsFor(profile: UserProfile, idea: Idea): Record<string, string> {
  const rule = ideaRules[idea.id];
  const customers = monthlyCustomers(idea, profile.revenueGoal);
  const goal = formatEuros(profile.revenueGoal);
  return {
    objectif_revenu: customers
      ? `Pour atteindre ${goal} par mois au prix testé, il faudrait environ ${customers} clients payants : un repère de travail, pas une promesse.`
      : `Votre objectif de ${goal} par mois sert de repère pour fixer le prix à tester, sans promesse de revenu.`,
    tranche_age: profile.ageRange === "moins_18"
      ? "Le plan prévoit l’accompagnement d’un représentant légal pour créer l’activité et encaisser les premiers paiements."
      : "Le plan suppose que vous encaissez vous-même : vérifiez le statut adapté à votre activité avant la première vente.",
    delai_premier_euro: firstSaleEffects[profile.firstSale],
    temps_jour: rule.effort_mvp_heures <= profile.weeklyHours
      ? `La première version demande environ ${rule.effort_mvp_heures} heures, dans vos ${profile.weeklyHours} heures par semaine ; le reste du mois sert à tester l’idée et à vendre.`
      : `La première version est découpée en sessions courtes pour avancer avec environ ${profile.weeklyHours} heures par semaine ; le reste attend les premiers retours.`,
    niveau_video: contentEffects[profile.content],
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
${content.prompt.produit} Cible initiale : ${idea.cible} Périmètre autorisé : ${rule.scope}. N’ajoute aucune fonction hors de ce périmètre.

## Contraintes de la personne qui construit
${time} ${firstSalePrompt[profile.firstSale]} Réserve les autres semaines à la validation, aux essais et à la vente. Mon objectif est d’atteindre ${formatEuros(profile.revenueGoal)} par mois ; ${customers ? `au prix testé, cela représente environ ${customers} clients payants, un repère de travail et non une promesse.` : "le prix testé servira à estimer le nombre de clients nécessaires, sans promesse de revenu."}${profile.ageRange === "moins_18" ? " Je suis mineur : un représentant légal doit accompagner la création de l’activité et l’encaissement." : ""} Signale tout dépassement du périmètre.

## Stack et accompagnement
${guidedStack} Avance une action à la fois, vérifie chaque résultat à l’écran et garde un design sobre d’une seule couleur.

## Parcours, écran par écran
${content.prompt.ecrans.map((screen, index) => `${index + 1}. ${screen}`).join("\n")}

## Données et accès
${content.prompt.donnees} Applique ces règles côté serveur ou en base : une URL secrète ne remplace jamais un contrôle d’accès. Prévois la correction, l’export et la suppression des données.

## Paiement et mise en ligne
Le prix à tester est ${idea.prix_conseille}. Propose d’abord une formule simple et sans engagement. Utilise un lien de paiement hébergé chez Stripe et n’ouvre l’accès qu’après un paiement vérifié, jamais sur un simple paramètre de retour. Aucune carte n’est collectée dans le produit. Distingue mode test et mode réel, et affiche les conditions et les coordonnées du vendeur.

## Acquisition et aide
Le premier canal retenu est : ${acquisitionFor(idea, channelFor(idea, profile.content))} Rédige le produit en français et vise d’abord des clients francophones. Ajoute cinq réponses aux questions fréquentes et un contact humain.

## Critères d’acceptation
${criteria.map((criterion) => `- ${criterion}`).join("\n")}`;
}

export function buildTasks(idea: Idea, content: IdeaContent, profile: UserProfile): PlanTask[] {
  const rule = ideaRules[idea.id];
  const channel = acquisitionFor(idea, channelFor(idea, profile.content));
  const weeks = [
    [
      `Définir une seule cible à interroger : ${idea.cible}`,
      `Trouver dix volontaires pour un échange via ce canal : ${channel}`,
      "Préparer quatre questions sur le dernier problème rencontré, son coût et la solution utilisée aujourd’hui.",
      "Mener cinq conversations réelles et noter les mots employés sans présenter le produit trop tôt.",
      "Mener cinq autres conversations et comparer les problèmes répétés aux cinq premiers retours.",
      profile.firstSale === "deux_semaines"
        ? "Décider vite : ne construire que si au moins trois personnes demandent à tester pendant ces dix échanges."
        : "Noter l’outil déjà utilisé par chaque personne et ce qui lui manque.",
    ],
    [
      rule.effort_mvp_heures <= profile.weeklyHours
        ? `Copier le prompt et vérifier que le périmètre tient dans ${rule.effort_mvp_heures} heures de construction.`
        : `Copier le prompt et découper le périmètre en sessions courtes, dans vos ${profile.weeklyHours} heures hebdomadaires.`,
      "Choisir un modèle guidé, vérifier ses limites gratuites et suivre sa configuration étape par étape.",
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
      justification: `${effects.niveau_video} ${effects.temps_jour}`,
      adaptation: `Commencez uniquement par ${ideaRules[idea.id].scope}. ${effects.delai_premier_euro} Le prix est une hypothèse à valider avec la cible, jamais une estimation de revenu.`,
      canal_acquisition: acquisitionFor(idea, channelFor(idea, profile.content)),
      risque: lookup(idea.id).risque,
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
