import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { getStripe, type PaymentRow } from "@/lib/stripe/client";
import { ApiError } from "@/lib/security/config";
import { databaseError, errorResponse, json, readJson } from "@/lib/security/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = z.object({ dossier_id: z.string().uuid(), reason: z.string().max(1000).optional() }).parse(await readJson(request));
    const { user, supabase } = await requireUser();
    const result = await supabase.from("payments").select("*").eq("dossier_id", body.dossier_id).eq("user_id", user.id).in("statut", ["paye", "rembourse_partiel", "rembourse"]).order("paid_at").limit(1).maybeSingle();
    databaseError(result.error); const payment = result.data as PaymentRow | null;
    if (!payment?.paid_at || !payment.stripe_payment_intent_id) throw new ApiError("Aucun paiement confirmé pour ce dossier.", 404);
    if (payment.statut === "rembourse") return json({ ok: true, status: "succeeded" });
    if (Date.now() - Date.parse(payment.paid_at) > 2 * 24 * 60 * 60_000) throw new ApiError("La garantie de 48 heures est dépassée. Contacte-nous pour examiner ta situation.", 409, "REFUND_WINDOW_EXPIRED");
    const refund = await getStripe().refunds.create({ payment_intent: payment.stripe_payment_intent_id, reason: "requested_by_customer", metadata: { payment_id: payment.id, dossier_id: body.dossier_id, user_id: user.id } }, { idempotencyKey: `saascan-full-refund-${payment.id}` });
    // Seul le webhook confirmé change l’accès. Un remboursement peut être différé.
    return json({ ok: true, status: refund.status });
  } catch (error) { return errorResponse(error); }
}
