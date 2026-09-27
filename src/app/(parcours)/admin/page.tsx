import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import { ScanShell } from "@/components/workspace/scan-shell";
import { findPlan } from "@/config/pricing";
import { accountDetails, summarizeSignups, type AccountDetail, type AccountDossier, type SignupCompletion, type SignupUser } from "@/lib/admin/signups";
import { questions, shortAnswer } from "@/lib/questionnaire/questions";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

const shortDay = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const dateTime = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const number = new Intl.NumberFormat("fr-FR");
/** Au-delà, la page deviendrait trop lourde : les chiffres du haut comptent tous les comptes. */
const shownAccounts = 100;

async function loadUsers(admin: ReturnType<typeof createAdminClient>) {
  const users: SignupUser[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

function dossierState(dossier: AccountDossier) {
  const plan = findPlan(dossier.formule);
  const formula = plan ? plan.label : dossier.formule ?? "formule inconnue";
  if (dossier.refundedAt) return `${formula} · remboursé`;
  if (!dossier.paidAt) return `${formula} · page de paiement ouverte, jamais payé`;
  const state = dossier.cancelAtPeriodEnd ? "résilié" : dossier.membershipStatus ?? "sans état";
  return `${formula} · payé le ${dateTime.format(new Date(dossier.paidAt))} · ${state}`;
}

/** Les réponses du questionnaire actuel sont dites en clair ; les anciennes sont seulement signalées. */
function readableAnswers(answers: { question_id: string; value: unknown }[]) {
  const known = questions.flatMap((question) => {
    const answer = answers.find((entry) => entry.question_id === question.id);
    const label = answer ? shortAnswer(question, answer.value) : "";
    return label ? [label] : [];
  });
  if (known.length) return known.join(" · ");
  return answers.length ? "Réponses de l’ancien questionnaire" : "Aucune réponse enregistrée";
}

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/connexion?suite=/admin");
  // Rôle posé dans app_metadata avec la clé service_role : aucun compte ne peut se l’attribuer lui-même.
  if (user.app_metadata?.role !== "admin") notFound();
  const admin = createAdminClient();
  const [users, dossiers, completions] = await Promise.all([
    loadUsers(admin),
    admin.from("dossiers").select("id,user_id,created_at,statut,paid_at,refunded_at,formule,membership_status,cancel_at_period_end"),
    admin.from("questionnaires").select("user_id,answers,created_at,updated_at"),
  ]);
  if (dossiers.error) throw new Error(dossiers.error.message);
  // Tant que la migration 202609270001 n’est pas appliquée, la page s’affiche sans les questionnaires terminés.
  const missingTable = completions.error?.code === "42P01" || completions.error?.code === "PGRST205";
  if (completions.error && !missingTable) throw new Error(completions.error.message);
  const finished = (completions.data ?? []) as SignupCompletion[];
  const responses = await admin.from("responses").select("dossier_id,question_id,value");
  if (responses.error) throw new Error(responses.error.message);
  const stats = summarizeSignups(users, dossiers.data);
  const accounts = accountDetails(users, dossiers.data, responses.data, finished);
  const peak = Math.max(1, ...stats.days.map((entry) => entry.count));
  const tiles: [string, number][] = [
    ["Aujourd’hui", stats.today],
    ["7 derniers jours", stats.last7Days],
    ["30 derniers jours", stats.last30Days],
    ["Avec Google", stats.google],
    ["Par email", stats.email],
    ["Questionnaire terminé", finished.length],
    ["Ont ouvert le paiement", stats.openedCheckout],
    ["Abonnés payants", stats.paying],
  ];
  const accountLine = (account: AccountDetail) =>
    `${account.providers} · créé le ${dateTime.format(new Date(account.createdAt))} · dernière visite ${account.lastSignInAt ? dateTime.format(new Date(account.lastSignInAt)) : "jamais revenu"}`;
  return <ScanShell stage="account"><section className="scan-admin">
    <BrandLogo />
    <p className="scan-count">ADMIN</p>
    <h1><span className="scan-admin-total">{number.format(stats.total)}</span> inscrit{stats.total > 1 ? "s" : ""}</h1>
    <p className="scan-space-account">Chiffres en direct depuis Supabase, à l’heure de Paris. Les comptes de test sont inclus.</p>
    <dl className="scan-admin-tiles">{tiles.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{number.format(value)}</dd></div>)}</dl>

    <h2 className="scan-admin-heading">Inscriptions des 14 derniers jours</h2>
    <ol className="scan-admin-days">{stats.days.map((entry) => <li key={entry.day}>
      <span>{shortDay.format(new Date(`${entry.day}T00:00:00Z`))}</span>
      <span className="scan-admin-bar" aria-hidden="true"><span style={{ width: `${(entry.count / peak) * 100}%` }} /></span>
      <strong>{entry.count}</strong>
    </li>)}</ol>

    <h2 className="scan-admin-heading">Les comptes créés</h2>
    <ul className="scan-admin-accounts">{accounts.slice(0, shownAccounts).map((account) => <li key={account.id || account.email} className="scan-admin-account">
      <p className="scan-admin-account-head">
        <strong>{account.email}</strong>
        <span>{accountLine(account)}</span>
      </p>
      {account.dossiers.length === 0
        ? <p className="scan-admin-account-empty">{account.completedAt
          ? <>Questionnaire terminé le {dateTime.format(new Date(account.completedAt))}, arrêté devant les prix.<span className="scan-admin-dossier-answers">{readableAnswers(account.completionAnswers)}</span></>
          : "Aucun dossier : la page de paiement n’a jamais été ouverte."}</p>
        : <ul className="scan-admin-dossiers">{account.dossiers.map((dossier) => <li key={dossier.id}>
          <span className="scan-admin-dossier-state" data-paid={!!dossier.paidAt && !dossier.refundedAt}>{dossierState(dossier)}</span>
          <span className="scan-admin-dossier-answers">{readableAnswers(dossier.answers)}</span>
        </li>)}</ul>}
    </li>)}</ul>
    <p className="scan-profil-note">Un dossier est créé quand la page de paiement Whop s’ouvre : « jamais payé » signale un abandon devant le paiement. Le questionnaire terminé est enregistré dès l’affichage de l’offre, avant tout paiement.{' '}Les comptes créés avant le 27 septembre 2026 se sont inscrits avant de répondre : pour eux, l’absence de dossier ne dit rien du questionnaire.{accounts.length > shownAccounts ? ` Seuls les ${shownAccounts} comptes les plus récents sont affichés.` : ""}</p>
  </section></ScanShell>;
}
