import type { Idea } from "@/types/domain";

export type AcquisitionChannel = { id: "community" | "network" | "cold" | "face"; label: string };
/** `domains` uses the option values of the `domaines` question. */
export type IdeaRule = { effort_mvp_heures: number; channels: AcquisitionChannel[]; domains: string[]; scope: string };

const community: AcquisitionChannel = { id: "community", label: "Une ressource utile dans une communauté métier, avec l’accord des responsables ; échanges avec les personnes qui se portent volontaires." };
const network: AcquisitionChannel = { id: "network", label: "Des conversations avec des contacts concernés par le problème, puis des présentations consenties à leurs pairs." };
const cold: AcquisitionChannel = { id: "cold", label: "Dix prises de contact individuelles, contextualisées et espacées auprès de professionnels ciblés." };
const face: AcquisitionChannel = { id: "face", label: "De courtes démonstrations face caméra, suivies d’échanges avec les créateurs qui demandent à tester." };

// Effort for a deliberately narrow MVP: week 2 is the construction window, not the whole month.
export const ideaRules: Record<string, IdeaRule> = {
  "relance-devis-artisans": { effort_mvp_heures: 5, channels: [network, community], domains: ["vente", "productivite", "automatisation", "nocode"], scope: "un tableau privé, quatre statuts et des modèles de relance copiables ; aucun envoi automatique" },
  "brief-chantier": { effort_mvp_heures: 4, channels: [community, network], domains: ["productivite", "vente", "nocode"], scope: "un formulaire métier et une fiche récapitulative, sans devis automatique ni gestion de chantier" },
  "faq-coachs": { effort_mvp_heures: 4, channels: [community, network], domains: ["sante", "sport", "education", "nocode"], scope: "une page de consignes éditable et dix réponses types ; aucune réservation ni donnée de santé" },
  "benevoles-creneaux": { effort_mvp_heures: 6, channels: [network, community], domains: ["communautes", "productivite", "sport", "nocode"], scope: "un événement, une liste de créneaux et un formulaire d’inscription ; validation manuelle des places" },
  "suivi-partenariats-createurs": { effort_mvp_heures: 6, channels: [community, network], domains: ["contenu", "finance", "marketing"], scope: "une base de partenariats avec dates et paiements déclarés ; aucune connexion aux réseaux sociaux" },
  "retours-formateurs": { effort_mvp_heures: 5, channels: [community, network], domains: ["education", "donnees"], scope: "un formulaire de retour et un bilan de cinq indicateurs ; pas de certification ni de conformité automatisée" },
  "menu-mise-a-jour": { effort_mvp_heures: 8, channels: [cold], domains: ["marketing", "ecommerce", "nocode"], scope: "une page mobile de dix plats au maximum et son formulaire d’édition ; pas de commande en ligne" },
  "preuves-avant-apres": { effort_mvp_heures: 8, channels: [cold], domains: ["marketing", "contenu", "nocode"], scope: "une galerie de dix réalisations et un formulaire photo ; pas de génération d’images" },
  "stock-consommables-salons": { effort_mvp_heures: 8, channels: [network, community], domains: ["productivite", "sante", "finance", "donnees"], scope: "dix références saisies manuellement et une vue sous le seuil ; aucune commande fournisseur automatique" },
  "brief-podcast": { effort_mvp_heures: 5, channels: [community, network], domains: ["contenu", "productivite"], scope: "un formulaire invité et une page privée de consignes ; aucun hébergement ni traitement audio" },
  "demandes-clubs-sport": { effort_mvp_heures: 10, channels: [network, community], domains: ["sport", "communautes", "automatisation"], scope: "une boîte de demandes générales et cinq modèles de réponse ; aucune donnée médicale ou dossier de mineur" },
  "retours-boutiques": { effort_mvp_heures: 12, channels: [community, network], domains: ["ecommerce", "automatisation"], scope: "un formulaire de retour et trois statuts ; aucun remboursement automatique ni connexion transporteur" },
  "validation-contenus-agences": { effort_mvp_heures: 14, channels: [community, network], domains: ["marketing", "contenu", "productivite"], scope: "un espace privé, des commentaires et un bouton de validation horodatée ; aucune publication sociale" },
  "alertes-catalogue": { effort_mvp_heures: 18, channels: [community], domains: ["ecommerce", "donnees", "developpement", "automatisation"], scope: "un contrôle local de trois erreurs CSV et un export ; aucune modification automatique de boutique" },
  "resume-reunions-associations": { effort_mvp_heures: 12, channels: [network, community], domains: ["contenu_ia", "communautes", "productivite"], scope: "un champ de notes, un brouillon structuré à relire et un export ; aucun audio ni donnée sensible" },
  "reponses-avis-locaux": { effort_mvp_heures: 12, channels: [cold], domains: ["contenu_ia", "marketing"], scope: "un avis collé, trois brouillons modifiables et une copie ; aucune publication automatique" },
  "fiches-pedagogiques": { effort_mvp_heures: 14, channels: [community], domains: ["education", "contenu_ia"], scope: "deux modèles de fiches pour adultes, un brouillon relu et une impression ; pas de notation automatisée" },
  "recadrage-demonstrations": { effort_mvp_heures: 8, channels: [face], domains: ["contenu", "education"], scope: "un canevas de script guidé, trois séquences et un export ; aucun montage ou hébergement vidéo" },
  "suivi-depots-createurs": { effort_mvp_heures: 12, channels: [community, network], domains: ["finance", "ecommerce", "productivite"], scope: "cinq lieux, des mouvements manuels et un export CSV ; aucune caisse ni comptabilité intégrée" },
  "suivi-demandes-cabinets": { effort_mvp_heures: 20, channels: [cold], domains: ["productivite", "developpement", "automatisation"], scope: "une checklist privée et des statuts de pièces ; aucun téléversement de document confidentiel" },
};

export function allowedChannels(idea: Idea): AcquisitionChannel[] {
  return ideaRules[idea.id]?.channels ?? [];
}

export function acquisitionFor(idea: Idea, channelId?: AcquisitionChannel["id"]): string {
  const channels = allowedChannels(idea);
  const channel = channelId ? channels.find((candidate) => candidate.id === channelId) : channels[0];
  if (!channel) throw new Error("Aucun canal d’acquisition compatible.");
  if (channel.id === "community") return `Publiez une fiche exemple de ${idea.nom} dans un groupe métier lié à cette cible : ${idea.cible} Demandez l’accord des responsables, recrutez dix volontaires pour un entretien, puis proposez un pilote aux personnes intéressées.`;
  if (channel.id === "network") return `Montrez un exemple de ${idea.nom} à trois personnes concernées par le problème. Demandez à chacune une présentation consentie à ses pairs, puis proposez dix entretiens avant un pilote payant.`;
  if (channel.id === "cold") return `Identifiez dix professionnels correspondant à cette cible : ${idea.cible} Contactez-les individuellement avec un exemple de ${idea.nom}, une question précise et une possibilité simple de refuser.`;
  return `Publiez trois démonstrations face caméra de ${idea.nom}, chacune centrée sur un problème concret de la cible. Proposez dix entretiens aux personnes qui demandent à tester, puis une offre pilote.`;
}
