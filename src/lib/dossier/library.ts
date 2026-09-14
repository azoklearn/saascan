import "server-only";
import { ideas } from "@/lib/matching/filters";
import type { ContentLookup, IdeaContent } from "./content";
import budgetMensuel from "@data/contenus/budget-mensuel.json";
import calendrierPublications from "@data/contenus/calendrier-publications.json";
import carnetAnimaux from "@data/contenus/carnet-animaux.json";
import carteFidelite from "@data/contenus/carte-fidelite.json";
import cvLettreMotivation from "@data/contenus/cv-lettre-motivation.json";
import depensesColocation from "@data/contenus/depenses-colocation.json";
import facturesImpayees from "@data/contenus/factures-impayees.json";
import journalTrading from "@data/contenus/journal-trading.json";
import menuQrRestaurant from "@data/contenus/menu-qr-restaurant.json";
import menusSemaine from "@data/contenus/menus-semaine.json";
import organisationMariage from "@data/contenus/organisation-mariage.json";
import planningEquipe from "@data/contenus/planning-equipe.json";
import planningRevisions from "@data/contenus/planning-revisions.json";
import planningVoyage from "@data/contenus/planning-voyage.json";
import priseRendezVous from "@data/contenus/prise-rendez-vous.json";
import programmesSportMaison from "@data/contenus/programmes-sport-maison.json";
import reservationCoachs from "@data/contenus/reservation-coachs.json";
import suiviAbonnements from "@data/contenus/suivi-abonnements.json";
import suiviHabitudes from "@data/contenus/suivi-habitudes.json";
import vocabulaireLangues from "@data/contenus/vocabulaire-langues.json";

// Textes rédigés à l’avance, contrôlés par tests/contenus.test.ts. Serveur uniquement : ils forment le contenu payant.
const contents = [
  budgetMensuel, calendrierPublications, carnetAnimaux, carteFidelite, cvLettreMotivation, depensesColocation,
  facturesImpayees, journalTrading, menuQrRestaurant, menusSemaine, organisationMariage, planningEquipe,
  planningRevisions, planningVoyage, priseRendezVous, programmesSportMaison, reservationCoachs, suiviAbonnements,
  suiviHabitudes, vocabulaireLangues,
] as unknown as IdeaContent[];
const library = new Map(contents.map((content) => [content.idea_id, content]));

const missing = ideas.filter((idea) => !library.has(idea.id)).map((idea) => idea.id);
if (missing.length) throw new Error(`Contenu rédigé manquant : ${missing.join(", ")}`);

export const ideaContent: ContentLookup = (ideaId) => {
  const content = library.get(ideaId);
  if (!content) throw new Error(`Contenu rédigé manquant pour l’idée ${ideaId}.`);
  return content;
};
