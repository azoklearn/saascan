import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { ScanShell } from "@/components/workspace/scan-shell";
import { findPlan } from "@/config/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { listUserDossiers, type UserDossier } from "@/lib/supabase/dossiers";
import { currentUser } from "@/lib/supabase/server";

// Les liens des dossiers ne doivent jamais partir dans l’en-tête Referer.
export const metadata: Metadata = { title: "Votre espace", referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const longDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

function statusOf(dossier: UserDossier) {
  const plan = findPlan(dossier.formule);
  const formula = plan ? `Formule ${plan.label}` : "Abonnement";
  const end = dossier.currentPeriodEnd ? longDate.format(new Date(dossier.currentPeriodEnd)) : null;
  if (dossier.refunded) return "Remboursé";
  if (!dossier.access) return `${formula} · abonnement terminé`;
  if (dossier.cancelAtPeriodEnd) return `${formula} · résilié, accès jusqu’au ${end ?? "terme de la période"}`;
  return end ? `${formula} · renouvellement le ${end}` : formula;
}

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/connexion?suite=/espace");
  const dossiers = await listUserDossiers(createAdminClient(), user.id);
  return <ScanShell stage="account"><section className="scan-space">
    <BrandLogo />
    <p className="scan-count">VOTRE ESPACE</p>
    <h1>{dossiers.length > 1 ? "Vos dossiers." : "Votre dossier."}</h1>
    <p className="scan-space-account">Connecté avec {user.email}</p>
    {dossiers.length === 0
      ? <div className="scan-space-empty"><p>Vous n’avez pas encore de dossier. Répondez au questionnaire pour découvrir l’idée qui vous correspond.</p><Link className="scan-button" href="/questionnaire">Répondre au questionnaire <ArrowRight size={16} /></Link></div>
      : <ul className="scan-space-list">{dossiers.map((dossier) => <li key={dossier.token}>
        <a className="scan-space-item" href={`/dossier/${dossier.token}`}>
          <span><strong>{dossier.ideaName ?? "Dossier en préparation"}</strong><small>{statusOf(dossier)}</small></span>
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      </li>)}</ul>}
    <form className="scan-space-actions" action="/auth/deconnexion" method="post"><button type="submit" className="scan-back">Se déconnecter</button></form>
  </section></ScanShell>;
}
