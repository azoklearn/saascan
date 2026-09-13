import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, requireEnv } from "@/lib/security/config";
import { databaseError } from "@/lib/security/http";

type EmailClaim = { email: string; kind: "dossier_disponible" | "remboursement_recu"; dossier_id: string; payment_id: string; attempt: number };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export async function sendEventEmail(eventId: string): Promise<boolean> {
  const resend = new Resend(requireEnv("RESEND_API_KEY")); const from = requireEnv("RESEND_FROM_EMAIL"); const origin = appUrl();
  const admin = createAdminClient();
  const result = await admin.rpc("claim_event_email", { p_event_id: eventId });
  databaseError(result.error);
  const claim = result.data as EmailClaim | null;
  if (!claim) return false;
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "SaaScan";
  const isRefund = claim.kind === "remboursement_recu";
  const title = isRefund ? "Ton remboursement est confirmé" : "Ton dossier est prêt à être ouvert";
  const text = isRefund
    ? `Ton remboursement de 39 € a été confirmé. Le délai d’apparition sur ton compte dépend de ta banque. Ton dossier est désormais verrouillé.\n\nRetrouve ton espace : ${origin}/app`
    : `Ton dossier ${brand} est débloqué. Retrouve tes trois idées, ton prompt prêt à copier et ton plan sur 30 jours.\n\nOuvrir mon dossier : ${origin}/dossier/${claim.dossier_id}`;
  const response = await resend.emails.send({ from, to: claim.email, subject: `${brand} — ${title}`, text,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:32px auto;color:#171717"><p style="font-size:22px;font-weight:bold">${escapeHtml(brand)}</p><h1 style="font-size:26px">${escapeHtml(title)}</h1><p style="font-size:16px;line-height:1.7;white-space:pre-line">${escapeHtml(text)}</p></div>` },
  { idempotencyKey: `${claim.kind}-${claim.payment_id}` });
  if (response.error) throw new Error(`Resend: ${response.error.name}`);
  const sent = await admin.from("stripe_events").update({ email_sent_at: new Date().toISOString() }).eq("event_id", eventId).eq("email_attempts", claim.attempt);
  databaseError(sent.error); return true;
}

export async function retryEmails() {
  requireEnv("RESEND_API_KEY"); requireEnv("RESEND_FROM_EMAIL");
  const admin = createAdminClient();
  const result = await admin.from("stripe_events").select("event_id").not("email_kind", "is", null).not("processed_at", "is", null).is("email_sent_at", null).lt("email_attempts", 8).order("received_at").limit(10);
  databaseError(result.error);
  let sent = 0; let failed = 0;
  for (const event of result.data ?? []) {
    try { if (await sendEventEmail(event.event_id)) sent += 1; }
    catch { failed += 1; }
  }
  return { sent, failed };
}
