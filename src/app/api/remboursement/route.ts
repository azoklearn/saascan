import { z } from "zod";
import { refundDays } from "@/config/pricing";
import { parseAccessToken } from "@/lib/security/access-token";
import { ApiError } from "@/lib/security/config";
import { databaseError, errorResponse, json, readJson } from "@/lib/security/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { findDossier } from "@/lib/supabase/dossiers";
import { getWhop } from "@/lib/whop/client";
export const runtime = "nodejs";

type AccessPayment = { id: string; provider_payment_id: string | null; statut: string; paid_at: string | null };

export async function POST(request: Request) {
  try {
    const body = z.object({ token: z.string() }).strict().parse(await readJson(request));
    const admin = createAdminClient();
    const dossier = await findDossier(admin, parseAccessToken(body.token));
    // La garantie porte sur le premier paiement, celui qui a ouvert le dossier.
    const access = await admin.from("dossiers").select("access_payment_id").eq("id", dossier.id).single();
    databaseError(access.error);
    const accessPaymentId = access.data?.access_payment_id as string | null | undefined;
    if (!accessPaymentId) throw new ApiError("Aucun paiement confirmé pour ce dossier.", 404);
    const result = await admin.from("payments").select("id,provider_payment_id,statut,paid_at").eq("id", accessPaymentId).single();
    databaseError(result.error); const payment = result.data as AccessPayment;
    if (!payment.paid_at || !payment.provider_payment_id) throw new ApiError("Aucun paiement confirmé pour ce dossier.", 404);
    if (payment.statut === "rembourse") return json({ ok: true, status: "succeeded" });
    if (Date.now() - Date.parse(payment.paid_at) > refundDays * 24 * 60 * 60_000) throw new ApiError("La garantie de 48 heures est dépassée. Contactez-nous pour examiner votre situation.", 409, "REFUND_WINDOW_EXPIRED");
    const whop = getWhop();
    // Le renouvellement s’arrête avant le remboursement : aucun nouveau prélèvement ne peut suivre.
    if (dossier.membership_id && !dossier.cancel_at_period_end && ["active", "trialing", "past_due"].includes(dossier.membership_status ?? "")) {
      await whop.memberships.cancel({ id: dossier.membership_id, cancel_at_period_end: true, reason: "Demande de remboursement (garantie de 48 heures)" });
    }
    const refunded = await whop.payments.refund({ id: payment.provider_payment_id }, { idempotencyKey: `saascan-refund-${payment.id}` });
    // Seul le webhook confirmé ferme l’accès : un remboursement peut rester en attente.
    return json({ ok: true, status: refunded.refunded_at ? "succeeded" : "pending" });
  } catch (error) { return errorResponse(error); }
}
