import "server-only";
import { WhopClient, type Whop } from "@whop/sdk";
import { plans, type Plan, type PlanId } from "@/config/pricing";
import { requireEnv } from "@/lib/security/config";

export function getWhop() {
  const baseUrl = process.env.WHOP_API_URL?.trim();
  return new WhopClient({ token: requireEnv("WHOP_API_KEY"), timeoutInSeconds: 20, maxRetries: 2, ...(baseUrl ? { baseUrl } : {}) });
}

/** Sans WHOP_API_URL, le client vise l’API de production : de vraies ventes. */
export const isWhopSandbox = () => (process.env.WHOP_API_URL ?? "").includes("sandbox");

const planEnvName = (id: PlanId) => `WHOP_PLAN_${id.toUpperCase()}`;
export const whopPlanId = (plan: Plan) => requireEnv(planEnvName(plan.id));
export const planFromWhop = (id: string | null | undefined) => id ? plans.find((plan) => process.env[planEnvName(plan.id)]?.trim() === id) : undefined;

export const cents = (money: Whop.Money | null | undefined) => money ? Math.round(Number(money.amount) * 100) : 0;

/** L’état de l’abonnement tel que Whop le décrit au moment de la lecture. */
export function membershipSnapshot(membership: Whop.Membership) {
  return {
    id: membership.id, status: membership.status, cancel_at_period_end: membership.cancel_at_period_end,
    current_period_end: membership.current_period_end, formule: planFromWhop(membership.plan_id)?.id ?? null,
    synced_at: new Date().toISOString(),
  };
}
