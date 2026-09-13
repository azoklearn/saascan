import "server-only";
import { ideas } from "@/lib/matching/filters";
import type { ContentLookup, IdeaContent } from "./content";
import alertesCatalogue from "@data/contenus/alertes-catalogue.json";
import benevolesCreneaux from "@data/contenus/benevoles-creneaux.json";
import briefChantier from "@data/contenus/brief-chantier.json";
import briefPodcast from "@data/contenus/brief-podcast.json";
import demandesClubsSport from "@data/contenus/demandes-clubs-sport.json";
import faqCoachs from "@data/contenus/faq-coachs.json";
import fichesPedagogiques from "@data/contenus/fiches-pedagogiques.json";
import menuMiseAJour from "@data/contenus/menu-mise-a-jour.json";
import preuvesAvantApres from "@data/contenus/preuves-avant-apres.json";
import recadrageDemonstrations from "@data/contenus/recadrage-demonstrations.json";
import relanceDevisArtisans from "@data/contenus/relance-devis-artisans.json";
import reponsesAvisLocaux from "@data/contenus/reponses-avis-locaux.json";
import resumeReunionsAssociations from "@data/contenus/resume-reunions-associations.json";
import retoursBoutiques from "@data/contenus/retours-boutiques.json";
import retoursFormateurs from "@data/contenus/retours-formateurs.json";
import stockConsommablesSalons from "@data/contenus/stock-consommables-salons.json";
import suiviDemandesCabinets from "@data/contenus/suivi-demandes-cabinets.json";
import suiviDepotsCreateurs from "@data/contenus/suivi-depots-createurs.json";
import suiviPartenariatsCreateurs from "@data/contenus/suivi-partenariats-createurs.json";
import validationContenusAgences from "@data/contenus/validation-contenus-agences.json";

// Textes rédigés à l’avance, contrôlés par tests/contenus.test.ts. Serveur uniquement : ils forment le contenu payant.
const contents = [
  alertesCatalogue, benevolesCreneaux, briefChantier, briefPodcast, demandesClubsSport, faqCoachs, fichesPedagogiques,
  menuMiseAJour, preuvesAvantApres, recadrageDemonstrations, relanceDevisArtisans, reponsesAvisLocaux,
  resumeReunionsAssociations, retoursBoutiques, retoursFormateurs, stockConsommablesSalons, suiviDemandesCabinets,
  suiviDepotsCreateurs, suiviPartenariatsCreateurs, validationContenusAgences,
] as unknown as IdeaContent[];
const library = new Map(contents.map((content) => [content.idea_id, content]));

const missing = ideas.filter((idea) => !library.has(idea.id)).map((idea) => idea.id);
if (missing.length) throw new Error(`Contenu rédigé manquant : ${missing.join(", ")}`);

export const ideaContent: ContentLookup = (ideaId) => {
  const content = library.get(ideaId);
  if (!content) throw new Error(`Contenu rédigé manquant pour l’idée ${ideaId}.`);
  return content;
};
