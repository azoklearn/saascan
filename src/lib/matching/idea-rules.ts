import type { Idea } from "@/types/domain";
import type { UserProfile } from "@/lib/questionnaire/profile";

export type AcquisitionChannel = { id: "community" | "network" | "cold" | "face"; label: string; requiresFace: boolean; requiresCold: boolean; requiresNetwork: boolean };
export type IdeaRule = { effort_mvp_heures: number; channels: AcquisitionChannel[]; keywords: string[]; dailyTasks: string[]; scope: string };

const community: AcquisitionChannel = { id: "community", label: "Une ressource utile dans une communauté métier, avec l’accord des responsables ; échanges avec les personnes qui se portent volontaires.", requiresFace: false, requiresCold: false, requiresNetwork: false };
const network: AcquisitionChannel = { id: "network", label: "Des conversations avec des contacts déjà connus, puis des présentations consenties à leurs pairs.", requiresFace: false, requiresCold: false, requiresNetwork: true };
const cold: AcquisitionChannel = { id: "cold", label: "Dix prises de contact individuelles, contextualisées et espacées auprès de professionnels ciblés.", requiresFace: false, requiresCold: true, requiresNetwork: false };
const face: AcquisitionChannel = { id: "face", label: "De courtes démonstrations face caméra, suivies d’échanges avec les créateurs qui demandent à tester.", requiresFace: true, requiresCold: false, requiresNetwork: false };

/** Effort for a deliberately narrow MVP, including setup, basic access and testing.
 * Week 2 is the construction window: do not spend all four weeks' capacity here.
 * Zero-budget variants use free plans and manual payment links; transaction fees
 * and future growth costs are disclosed separately in the generated prompt.
 */
export const ideaRules: Record<string, IdeaRule> = {
  "relance-devis-artisans": { effort_mvp_heures: 5, channels: [network, community], keywords: ["artisan", "chantier", "peintre", "menuisier", "paysage", "batiment"], dailyTasks: ["administratif"], scope: "un tableau privé, quatre statuts et des modèles de relance copiables ; aucun envoi automatique" },
  "brief-chantier": { effort_mvp_heures: 4, channels: [community, network], keywords: ["artisan", "renovation", "architecture", "decor", "chantier"], dailyTasks: ["design"], scope: "un formulaire métier et une fiche récapitulative, sans devis automatique ni gestion de chantier" },
  "faq-coachs": { effort_mvp_heures: 4, channels: [community, network], keywords: ["coach", "sport", "professeur", "cours", "yoga"], dailyTasks: ["support"], scope: "une page de consignes éditable et dix réponses types ; aucune réservation ni donnée de santé" },
  "benevoles-creneaux": { effort_mvp_heures: 6, channels: [network, community], keywords: ["association", "benevole", "culture", "club", "sport"], dailyTasks: ["support"], scope: "un événement, une liste de créneaux et un formulaire d’inscription ; validation manuelle des places" },
  "suivi-partenariats-createurs": { effort_mvp_heures: 6, channels: [community, network], keywords: ["createur", "instagram", "tiktok", "youtube", "influence", "communication"], dailyTasks: ["administratif"], scope: "une base de partenariats avec dates et paiements déclarés ; aucune connexion aux réseaux sociaux" },
  "retours-formateurs": { effort_mvp_heures: 5, channels: [community, network], keywords: ["formation", "formateur", "atelier", "education", "enseignement", "professeur"], dailyTasks: ["administratif"], scope: "un formulaire de retour et un bilan de cinq indicateurs ; pas de certification ni de conformité automatisée" },
  "menu-mise-a-jour": { effort_mvp_heures: 8, channels: [cold], keywords: ["restaurant", "restauration", "food", "traiteur", "cuisine"], dailyTasks: ["design", "support"], scope: "une page mobile de dix plats au maximum et son formulaire d’édition ; pas de commande en ligne" },
  "preuves-avant-apres": { effort_mvp_heures: 8, channels: [cold], keywords: ["artisan", "jardin", "renovation", "decor", "photographie"], dailyTasks: ["design"], scope: "une galerie de dix réalisations et un formulaire photo ; pas de génération d’images" },
  "stock-consommables-salons": { effort_mvp_heures: 8, channels: [network, community], keywords: ["salon", "coiffure", "beaute", "esthetique", "institut"], dailyTasks: ["administratif", "support"], scope: "dix références saisies manuellement et une vue sous le seuil ; aucune commande fournisseur automatique" },
  "brief-podcast": { effort_mvp_heures: 5, channels: [community, network], keywords: ["podcast", "media", "journaliste", "interview", "audio", "createur"], dailyTasks: ["design"], scope: "un formulaire invité et une page privée de consignes ; aucun hébergement ni traitement audio" },
  "demandes-clubs-sport": { effort_mvp_heures: 10, channels: [network, community], keywords: ["sport", "club", "association", "benevole"], dailyTasks: ["support"], scope: "une boîte de demandes générales et cinq modèles de réponse ; aucune donnée médicale ou dossier de mineur" },
  "retours-boutiques": { effort_mvp_heures: 12, channels: [community, network], keywords: ["boutique", "commerce", "shopify", "etsy", "marchand", "vente"], dailyTasks: ["support", "code"], scope: "un formulaire de retour et trois statuts ; aucun remboursement automatique ni connexion transporteur" },
  "validation-contenus-agences": { effort_mvp_heures: 14, channels: [community, network], keywords: ["community", "communication", "freelance", "agence", "instagram", "marketing"], dailyTasks: ["design", "support"], scope: "un espace privé, des commentaires et un bouton de validation horodatée ; aucune publication sociale" },
  "alertes-catalogue": { effort_mvp_heures: 18, channels: [community], keywords: ["commerce", "catalogue", "csv", "boutique", "amazon", "etsy"], dailyTasks: ["code"], scope: "un contrôle local de trois erreurs CSV et un export ; aucune modification automatique de boutique" },
  "resume-reunions-associations": { effort_mvp_heures: 12, channels: [network, community], keywords: ["association", "secretaire", "club", "benevole", "reunion"], dailyTasks: ["support", "code"], scope: "un champ de notes, un brouillon structuré à relire et un export ; aucun audio ni donnée sensible" },
  "reponses-avis-locaux": { effort_mvp_heures: 12, channels: [cold], keywords: ["commerce", "restaurant", "local", "communication", "avis"], dailyTasks: ["support"], scope: "un avis collé, trois brouillons modifiables et une copie ; aucune publication automatique" },
  "fiches-pedagogiques": { effort_mvp_heures: 14, channels: [community], keywords: ["formation", "atelier", "dessin", "ecriture", "animation", "education"], dailyTasks: ["design", "support"], scope: "deux modèles de fiches pour adultes, un brouillon relu et une impression ; pas de notation automatisée" },
  "recadrage-demonstrations": { effort_mvp_heures: 8, channels: [face], keywords: ["createur", "video", "tiktok", "youtube", "formation"], dailyTasks: ["video", "design"], scope: "un canevas de script guidé, trois séquences et un export ; aucun montage ou hébergement vidéo" },
  "suivi-depots-createurs": { effort_mvp_heures: 12, channels: [community, network], keywords: ["artisan", "ceramique", "illustration", "bijou", "createur", "boutique"], dailyTasks: ["administratif"], scope: "cinq lieux, des mouvements manuels et un export CSV ; aucune caisse ni comptabilité intégrée" },
  "suivi-demandes-cabinets": { effort_mvp_heures: 20, channels: [cold], keywords: ["cabinet", "architecture", "etudes", "assistant", "administratif"], dailyTasks: ["code", "support"], scope: "une checklist privée et des statuts de pièces ; aucun téléversement de document confidentiel" },
};

export function allowedChannels(idea: Idea, profile: UserProfile): AcquisitionChannel[] {
  const rules = ideaRules[idea.id];
  if (!rules) return [];
  return rules.channels.filter((channel) =>
    (!channel.requiresFace || profile.acceptsFace) &&
    (!channel.requiresCold || profile.acceptsCold) &&
    (!channel.requiresNetwork || profile.network !== "0"),
  );
}

export function acquisitionFor(idea: Idea, profile: UserProfile, channelId?: AcquisitionChannel["id"]): string {
  const channels = allowedChannels(idea, profile);
  const channel = channelId ? channels.find((candidate) => candidate.id === channelId) : channels[0];
  if (!channel) throw new Error("Aucun canal d’acquisition compatible.");
  if (channel.id === "community") return `Publie une fiche exemple de ${idea.nom} dans un groupe métier lié à cette cible : ${idea.cible} Demande l’accord des responsables, recrute dix volontaires pour un entretien, puis propose un pilote aux personnes intéressées.`;
  if (channel.id === "network") return `Montre un exemple de ${idea.nom} à trois contacts connus concernés par le problème. Demande à chacun une présentation consentie à ses pairs, puis propose dix entretiens avant un pilote payant.`;
  if (channel.id === "cold") return `Identifie dix professionnels correspondant à cette cible : ${idea.cible} Contacte-les individuellement avec un exemple de ${idea.nom}, une question précise et une possibilité simple de refuser.`;
  return `Publie trois démonstrations face caméra de ${idea.nom}, chacune centrée sur un problème concret de la cible. Propose dix entretiens aux personnes qui demandent à tester, puis une offre pilote.`;
}
