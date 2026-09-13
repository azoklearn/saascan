import "server-only";
import Stripe from "stripe";
import { requireEnv } from "@/lib/security/config";
export function getStripe() {
  return new Stripe(requireEnv("STRIPE_SECRET_KEY"), { timeout: 20_000, maxNetworkRetries: 2 });
}

export type PaymentRow = {
  id: string; user_id: string | null; dossier_id: string; stripe_session_id: string | null;
  stripe_payment_intent_id: string | null; montant: number; devise: string;
  statut: string; paid_at: string | null; montant_rembourse: number; created_at: string;
};
