import "server-only";
import { Resend } from "resend";
import { brand } from "@/config/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, requireEnv } from "@/lib/security/config";
import { databaseError } from "@/lib/security/http";

type EmailClaim = { email: string; kind: "dossier_disponible" | "remboursement_recu"; dossier_id: string; access_token: string | null; payment_id: string; attempt: number };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export async function sendEventEmail(eventId: string): Promise<boolean> {
  const resend = new Resend(requireEnv("RESEND_API_KEY")); const from = requireEnv("RESEND_FROM_EMAIL"); const origin = appUrl();
  const admin = createAdminClient();
  const result = await admin.rpc("claim_event_email", { p_event_id: eventId });
  databaseError(result.error);
  const claim = result.data as EmailClaim | null;
  if (!claim) return false;
  const isRefund = claim.kind === "remboursement_recu";
  const link = !isRefund && claim.access_token ? `${origin}/dossier/${claim.access_token}` : null;
  const title = isRefund ? "Votre remboursement est confirmé" : "Votre dossier est en préparation";
  const paragraphs = isRefund
    ? ["Votre remboursement de 39 € est confirmé. Le délai d’apparition sur votre compte dépend de votre banque. L’accès au dossier est désormais fermé."]
    : [`Merci pour votre achat. ${brand.name} prépare votre dossier : il sera prêt dans quelques minutes.`, "Gardez cet email : ce lien personnel permet de retrouver votre dossier à tout moment. Ne le partagez pas."];
  const text = [paragraphs[0], ...(link ? [`Ouvrir mon dossier : ${link}`] : []), ...paragraphs.slice(1)].join("\n\n");
  const button = link ? `<p style="margin:28px 0"><a href="${escapeHtml(link)}" style="display:inline-block;padding:13px 22px;border-radius:8px;background:#00c2a0;color:#06231d;font-weight:bold;text-decoration:none">Ouvrir mon dossier</a></p>` : "";
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:32px auto;color:#171717"><p style="font-size:22px;font-weight:bold">${escapeHtml(brand.name)}</p><h1 style="font-size:26px">${escapeHtml(title)}</h1><p style="font-size:16px;line-height:1.7">${escapeHtml(paragraphs[0])}</p>${button}${paragraphs.slice(1).map((paragraph) => `<p style="font-size:14px;line-height:1.7;color:#525252">${escapeHtml(paragraph)}</p>`).join("")}</div>`;
  const response = await resend.emails.send({ from, to: claim.email, subject: `${brand.name} — ${title}`, text, html }, { idempotencyKey: `${claim.kind}-${claim.payment_id}` });
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
