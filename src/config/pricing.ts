import catalogue from "./plans.json";

export type PlanId = "mensuel" | "trimestriel" | "annuel";
export type Plan = {
  id: PlanId; label: string; cents: number; periodDays: number; months: number;
  cadence: string; renewal: string; videoIdeas: number; roadmap: boolean; popular: boolean;
};

/** Prix TTC en centimes. scripts/whop-catalogue.mjs crée les mêmes formules sur Whop. */
export const plans = catalogue as Plan[];
export const planIds = plans.map((plan) => plan.id) as [PlanId, ...PlanId[]];
export const defaultPlanId: PlanId = "trimestriel";
/** Case cochée avant chaque paiement : accès immédiat et renonciation à la rétractation (art. L221-28, 13° du Code de la consommation). */
export const withdrawalWaiver = "Je demande l’accès immédiat à mon dossier dès le paiement et je renonce expressément à mon droit de rétractation de 14 jours.";

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
export const formatCents = (cents: number) => euros.format(cents / 100);
export const findPlan = (id: string | null | undefined) => plans.find((plan) => plan.id === id);
export const perDay = (plan: Plan) => formatCents(Math.round(plan.cents / plan.periodDays));
/** Ce que coûterait la même durée en formule mensuelle : la seule référence des prix barrés. */
export const monthlyEquivalent = (plan: Plan) => plans[0].cents * plan.months;
export const savingsPercent = (plan: Plan) => Math.round((1 - plan.cents / monthlyEquivalent(plan)) * 100);

export function planIncludes(plan: Plan): string[] {
  return [
    "3 idées", "prompt de construction", "plan sur 30 jours",
    ...(plan.videoIdeas ? [`${plan.videoIdeas} idées de vidéos marketing`] : []),
    ...(plan.roadmap ? ["plan de A à Z sur 12 mois"] : []),
  ];
}
