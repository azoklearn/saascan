import { z } from "zod";
import { pricing } from "@/config/pricing";
import { parseAccessToken } from "@/lib/security/access-token";
import { ApiError } from "@/lib/security/config";
import { databaseError, errorResponse, json, readJson } from "@/lib/security/http";
import { getStripe, type PaymentRow } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { findDossier } from "@/lib/supabase/dossiers";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = z.object({ token: z.string() }).strict().parse(await readJson(request));
    const admin = createAdminClient();
    const dossier = await findDossier(admin, parseAccessToken(body.token));
    const result = await admin.from("payments").select("*").eq("dossier_id", dossier.id).in("statut", ["paye", "rembourse_partiel", "rembourse"]).order("paid_at").limit(1).maybeSingle();
    databaseError(result.error); const payment = result.data as PaymentRow | null;
    if (!payment?.paid_at || !payment.stripe_payment_intent_id) throw new ApiError("Aucun paiement confirmé pour ce dossier.", 404);
    if (payment.statut === "rembourse") return json({ ok: true, status: "succeeded" });
    if (Date.now() - Date.parse(payment.paid_at) > pricing.refundDays * 24 * 60 * 60_000) throw new ApiError("La garantie de 48 heures est dépassée. Contactez-nous pour examiner votre situation.", 409, "REFUND_WINDOW_EXPIRED");
    const refund = await getStripe().refunds.create({ payment_intent: payment.stripe_payment_intent_id, reason: "requested_by_customer", metadata: { payment_id: payment.id, dossier_id: dossier.id } }, { idempotencyKey: `saascan-full-refund-${payment.id}` });
    // Seul le webhook confirmé change l’accès. Un remboursement peut être différé.
    return json({ ok: true, status: refund.status });
  } catch (error) { return errorResponse(error); }
}
