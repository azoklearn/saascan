import "server-only";
import { Resend } from "resend";
import { brand } from "@/config/brand";
import { findPlan, formatCents } from "@/config/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, requireEnv } from "@/lib/security/config";
import { databaseError } from "@/lib/security/http";

type EventClaim = { email: string; kind: "dossier_disponible" | "remboursement_recu"; dossier_id: string; access_token: string | null; payment_id: string | null; amount_cents: number | null; formule: string | null; attempt: number };
type ReminderClaim = { email: string; access_token: string; formule: string; period_end: string; attempt: number };
type Message = { title: string; lead: string; link?: { href: string; label: string }; notes?: string[] };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const longDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

async function send(to: string, { title, lead, link, notes = [] }: Message, idempotencyKey: string) {
  const resend = new Resend(requireEnv("RESEND_API_KEY"));
  const text = [lead, ...(link ? [`${link.label} : ${link.href}`] : []), ...notes].join("\n\n");
  const button = link ? `<p style="margin:28px 0"><a href="${escapeHtml(link.href)}" style="display:inline-block;padding:13px 22px;border-radius:8px;background:#00c2a0;color:#06231d;font-weight:bold;text-decoration:none">${escapeHtml(link.label)}</a></p>` : "";
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:32px auto;color:#171717"><p style="font-size:22px;font-weight:bold">${escapeHtml(brand.name)}</p><h1 style="font-size:26px">${escapeHtml(title)}</h1><p style="font-size:16px;line-height:1.7">${escapeHtml(lead)}</p>${button}${notes.map((note) => `<p style="font-size:14px;line-height:1.7;color:#525252">${escapeHtml(note)}</p>`).join("")}</div>`;
  const response = await resend.emails.send({ from: requireEnv("RESEND_FROM_EMAIL"), to, subject: `${brand.name} — ${title}`, text, html }, { idempotencyKey });
  if (response.error) throw new Error(`Resend: ${response.error.name}`);
}

export async function sendEventEmail(eventId: string): Promise<boolean> {
  requireEnv("RESEND_API_KEY"); requireEnv("RESEND_FROM_EMAIL"); const origin = appUrl();
  const admin = createAdminClient();
  const result = await admin.rpc("claim_event_email", { p_event_id: eventId });
  databaseError(result.error);
  const claim = result.data as EventClaim | null;
  if (!claim) return false;
  const plan = findPlan(claim.formule);
  const message: Message = claim.kind === "remboursement_recu"
    ? { title: "Votre remboursement est confirmé", lead: `Votre remboursement de ${formatCents(claim.amount_cents ?? 0)} est confirmé et votre abonnement est résilié. Le délai d’apparition sur votre compte dépend de votre banque. L’accès au dossier est désormais fermé.` }
    : {
      title: "Votre dossier vous attend",
      lead: `Merci pour votre abonnement${plan ? ` ${plan.label}` : ""}. Votre dossier ${brand.name} s’ouvre avec le lien ci-dessous.`,
      link: claim.access_token ? { href: `${origin}/dossier/${claim.access_token}`, label: "Ouvrir mon dossier" } : undefined,
      notes: [
        "Gardez cet email : ce lien personnel permet de retrouver votre dossier à tout moment. Ne le partagez pas.",
        ...(plan ? [`Votre abonnement est renouvelé ${plan.renewal} au prix de ${formatCents(plan.cents)}. Vous pouvez le résilier à tout moment depuis votre dossier : il reste actif jusqu’à la fin de la période payée.`] : []),
      ],
    };
  await send(claim.email, message, `${claim.kind}-${claim.payment_id ?? claim.dossier_id}`);
  const sent = await admin.from("payment_events").update({ email_sent_at: new Date().toISOString() }).eq("event_id", eventId).eq("email_attempts", claim.attempt);
  databaseError(sent.error); return true;
}

/** Rappel envoyé 35 à 50 jours avant la reconduction d’une formule de 3 ou 12 mois. */
export async function sendRenewalReminder(dossierId: string, periodEnd: string): Promise<boolean> {
  const origin = appUrl(); const admin = createAdminClient();
  const result = await admin.rpc("claim_renewal_reminder", { p_dossier_id: dossierId, p_period_end: periodEnd });
  databaseError(result.error);
  const claim = result.data as ReminderClaim | null;
  if (!claim) return false;
  const plan = findPlan(claim.formule);
  await send(claim.email, {
    title: "Votre abonnement va être renouvelé",
    lead: `Votre abonnement ${plan?.label ?? brand.name} sera renouvelé automatiquement le ${longDate.format(new Date(claim.period_end))}${plan ? `, pour ${formatCents(plan.cents)}` : ""}.`,
    link: { href: `${origin}/dossier/${claim.access_token}`, label: "Gérer mon abonnement" },
    notes: ["Si vous ne souhaitez pas le renouveler, résiliez-le depuis votre dossier avant cette date : vous gardez l’accès jusqu’à la fin de la période payée. Sinon, vous n’avez rien à faire."],
  }, `rappel-${dossierId}-${Date.parse(claim.period_end)}`);
  const sent = await admin.from("renewal_reminders").update({ email_sent_at: new Date().toISOString() }).eq("dossier_id", dossierId).eq("period_end", periodEnd).eq("email_attempts", claim.attempt);
  databaseError(sent.error); return true;
}

export async function retryEmails() {
  requireEnv("RESEND_API_KEY"); requireEnv("RESEND_FROM_EMAIL");
  const admin = createAdminClient();
  const queued = await admin.rpc("queue_renewal_reminders");
  databaseError(queued.error);
  const [events, reminders] = await Promise.all([
    admin.from("payment_events").select("event_id").not("email_kind", "is", null).not("processed_at", "is", null).is("email_sent_at", null).lt("email_attempts", 8).order("received_at").limit(10),
    admin.from("renewal_reminders").select("dossier_id,period_end").is("email_sent_at", null).lt("email_attempts", 8).order("created_at").limit(20),
  ]);
  databaseError(events.error); databaseError(reminders.error);
  let sent = 0; let failed = 0;
  const run = async (job: () => Promise<boolean>) => { try { if (await job()) sent += 1; } catch { failed += 1; } };
  for (const event of events.data ?? []) await run(() => sendEventEmail(event.event_id));
  for (const reminder of reminders.data ?? []) await run(() => sendRenewalReminder(reminder.dossier_id, reminder.period_end));
  return { sent, failed, reminders_queued: queued.data as number };
}
