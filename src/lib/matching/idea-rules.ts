import type { Idea } from "@/types/domain";

export type AcquisitionChannel = { id: "community" | "network" | "cold" | "face"; label: string };
export type IdeaRule = { effort_mvp_heures: number; channels: AcquisitionChannel[]; scope: string };

const community: AcquisitionChannel = { id: "community", label: "Un exemple utile partagé dans une communauté en ligne où se retrouve la cible, avec l’accord des responsables ; échanges avec les personnes qui se portent volontaires." };
const network: AcquisitionChannel = { id: "network", label: "Des conversations avec des proches concernés par le problème, puis des présentations à leur entourage, avec leur accord." };
const cold: AcquisitionChannel = { id: "cold", label: "Dix prises de contact individuelles, en personne ou par message, auprès de professionnels ciblés." };
const face: AcquisitionChannel = { id: "face", label: "De courtes vidéos face caméra qui montrent le problème et l’outil, suivies d’échanges avec les personnes qui demandent à tester." };

// Effort for a deliberately narrow first version: week 2 is the construction window, not the whole month.
export const ideaRules: Record<string, IdeaRule> = {
  "budget-mensuel": { effort_mvp_heures: 5, channels: [face, network], scope: "des catégories de dépenses, une saisie manuelle et le reste à dépenser du mois ; aucune connexion bancaire" },
  "suivi-abonnements": { effort_mvp_heures: 4, channels: [face, community], scope: "une liste d’abonnements saisis à la main, le total du mois et un rappel avant chaque échéance ; aucune résiliation automatique" },
  "menus-semaine": { effort_mvp_heures: 7, channels: [community, face], scope: "un planning de sept jours, vingt recettes et une liste de courses regroupée ; aucun conseil nutritionnel ni commande en ligne" },
  "suivi-habitudes": { effort_mvp_heures: 4, channels: [face, community], scope: "trois habitudes, un bouton « fait » par jour, une série visible et un rappel ; aucun conseil médical" },
  "programmes-sport-maison": { effort_mvp_heures: 8, channels: [face, community], scope: "un programme de huit semaines, une page par séance et le suivi des séances faites ; aucun conseil médical ni suivi de santé" },
  "reservation-coachs": { effort_mvp_heures: 8, channels: [network, community], scope: "une page de créneaux, une réservation avec paiement en ligne et un rappel la veille ; aucune donnée de santé" },
  "planning-revisions": { effort_mvp_heures: 6, channels: [community, face], scope: "une date d’examen, une liste de chapitres et un planning quotidien à cocher ; aucun contenu de cours" },
  "depenses-colocation": { effort_mvp_heures: 7, channels: [network, community], scope: "une colocation, des dépenses partagées, le calcul de qui doit combien et une liste de tâches ; aucun paiement entre colocataires" },
  "organisation-mariage": { effort_mvp_heures: 8, channels: [community, network], scope: "une liste de tâches mois par mois, une liste d’invités avec réponses et un budget prévu comparé au dépensé ; aucune place de marché de prestataires" },
  "cv-lettre-motivation": { effort_mvp_heures: 8, channels: [face, network], scope: "trois modèles de CV, un export PDF et un brouillon de lettre à relire ; aucune candidature envoyée automatiquement" },
  "vocabulaire-langues": { effort_mvp_heures: 8, channels: [face, community], scope: "une langue, des cartes ajoutées par la personne, une révision quotidienne et une série de jours ; aucun cours ni correction de prononciation" },
  "carnet-animaux": { effort_mvp_heures: 5, channels: [community, face], scope: "une fiche par animal, un historique de soins saisi à la main et des rappels ; aucun conseil vétérinaire" },
  "planning-voyage": { effort_mvp_heures: 8, channels: [face, network], scope: "un itinéraire jour par jour, une liste de valise partagée et un budget commun ; aucune réservation en ligne" },
  "prise-rendez-vous": { effort_mvp_heures: 7, channels: [cold, network], scope: "une page de prestations, des créneaux réservables et un rappel la veille ; aucun paiement ni gestion de stock" },
  "factures-impayees": { effort_mvp_heures: 5, channels: [network, community], scope: "une liste de factures saisies à la main, des échéances et des modèles de relance à copier ; aucune facturation électronique ni envoi automatique" },
  "carte-fidelite": { effort_mvp_heures: 9, channels: [cold, network], scope: "un QR code en caisse, une carte à tampons sur téléphone et une récompense ; aucune application à installer ni message publicitaire" },
  "menu-qr-restaurant": { effort_mvp_heures: 6, channels: [cold], scope: "une page menu mobile, un QR code fixe et un formulaire de modification ; aucune commande ni paiement en ligne" },
  "planning-equipe": { effort_mvp_heures: 9, channels: [network, cold], scope: "un planning de la semaine, un lien de consultation pour l’équipe et des demandes d’échange d’horaires ; aucun calcul de paie ni contrôle du droit du travail" },
  "calendrier-publications": { effort_mvp_heures: 8, channels: [network, face], scope: "un calendrier du mois, des idées par type de commerce et un brouillon de texte à relire ; aucune publication automatique" },
  "journal-trading": { effort_mvp_heures: 8, channels: [face, community], scope: "une saisie manuelle des opérations, des notes par trade et des statistiques simples ; aucun conseil, signal ni connexion à un courtier" },
};

export function allowedChannels(idea: Idea): AcquisitionChannel[] {
  return ideaRules[idea.id]?.channels ?? [];
}

/** Canal mis en avant selon l’aisance avec le contenu (`niveau_video`) : les vidéos face caméra seulement pour qui s’y sent à l’aise. */
export function channelFor(idea: Idea, content: string): AcquisitionChannel["id"] | undefined {
  const channels = allowedChannels(idea);
  if (content === "face_camera") return (channels.find((channel) => channel.id === "face") ?? channels[0])?.id;
  return (channels.find((channel) => channel.id !== "face") ?? channels[0])?.id;
}

export function acquisitionFor(idea: Idea, channelId?: AcquisitionChannel["id"]): string {
  const channels = allowedChannels(idea);
  const channel = channelId ? channels.find((candidate) => candidate.id === channelId) : channels[0];
  if (!channel) throw new Error("Aucun canal d’acquisition compatible.");
  if (channel.id === "community") return `Partagez un exemple de ${idea.nom} dans une communauté en ligne où se retrouve cette cible : ${idea.cible} Demandez l’accord des responsables, trouvez dix volontaires pour en parler, puis proposez un essai aux personnes intéressées.`;
  if (channel.id === "network") return `Montrez ${idea.nom} à trois personnes de votre entourage concernées par le problème. Demandez à chacune de le présenter à des proches, avec leur accord, puis proposez dix échanges avant un essai payant.`;
  if (channel.id === "cold") return `Repérez dix professionnels correspondant à cette cible : ${idea.cible} Contactez-les un par un, en personne ou par message, avec un exemple de ${idea.nom}, une question précise et la possibilité de refuser simplement.`;
  return `Publiez trois courtes vidéos face caméra sur ${idea.nom}, chacune centrée sur un problème concret de la cible. Proposez un échange aux personnes qui demandent à tester, puis un essai.`;
}
