"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { findPlan } from "@/config/pricing";
import type { UserDossier } from "@/lib/supabase/dossiers";
import { ScanError, ScanShell } from "./scan-shell";
import { api, friendlyError } from "./shared";

const longDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

function subscriptionText(dossier: UserDossier) {
  const plan = findPlan(dossier.formule);
  const formula = plan ? `Formule ${plan.label}` : "Abonnement";
  const end = dossier.currentPeriodEnd ? longDate.format(new Date(dossier.currentPeriodEnd)) : null;
  if (dossier.refunded) return `${formula} · remboursé`;
  if (!dossier.access) return `${formula} · terminé`;
  if (dossier.cancelAtPeriodEnd) return `${formula} · résilié, accès jusqu’au ${end ?? "terme de la période payée"}`;
  return end ? `${formula} · renouvellement le ${end}` : `${formula} · renouvellement automatique`;
}

export function ProfilScreen({ email, dossiers }: { email: string; dossiers: UserDossier[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  const cancelSubscription = async (dossier: UserDossier) => {
    setBusy(dossier.token); setError("");
    try {
      await api("/api/abonnement", { method: "POST", body: JSON.stringify({ token: dossier.token }) });
      startTransition(() => router.refresh());
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(null); setConfirming(null); }
  };

  return <ScanShell stage="account"><section className="scan-profil">
    <BrandLogo />
    <p className="scan-count">VOTRE PROFIL</p>
    <h1>Votre compte.</h1>
    <p className="scan-space-account">Connecté avec {email}</p>
    {error && <ScanError>{error}</ScanError>}

    <h2 className="scan-profil-heading">Vos dossiers et votre abonnement</h2>
    {dossiers.length === 0
      ? <div className="scan-space-empty"><p>Vous n’avez pas encore de dossier. Répondez au questionnaire pour découvrir l’idée qui vous correspond.</p><Link className="scan-button" href="/questionnaire">Répondre au questionnaire <ArrowRight size={16} /></Link></div>
      : <ul className="scan-profil-subscriptions">{dossiers.map((dossier) => <li key={dossier.token} className="scan-profil-card">
        <div>
          <strong>{dossier.ideaName ?? "Dossier en préparation"}</strong>
          <small>{subscriptionText(dossier)}</small>
        </div>
        <div className="scan-profil-card-actions">
          <Link className="scan-profil-link" href={`/dossier/${dossier.token}`}>{dossier.access ? "Ouvrir le dossier" : "Rouvrir ce dossier"} <ArrowRight size={14} /></Link>
          {dossier.access && !dossier.cancelAtPeriodEnd && (confirming === dossier.token
            ? <span className="scan-profil-confirm">
              <button type="button" className="scan-profil-button" onClick={() => setConfirming(null)}>Garder</button>
              <button type="button" className="scan-profil-button scan-profil-danger" disabled={busy !== null} onClick={() => cancelSubscription(dossier)}>{busy === dossier.token && <LoaderCircle size={13} className="scan-spinner" />}Confirmer la résiliation</button>
            </span>
            : <button type="button" className="scan-profil-button" onClick={() => setConfirming(dossier.token)}>Résilier</button>)}
        </div>
      </li>)}</ul>}
    <p className="scan-profil-note">La résiliation prend effet à la fin de la période déjà payée : aucun nouveau prélèvement, et le dossier reste ouvert jusque-là.</p>

    <form className="scan-space-actions" action="/auth/deconnexion" method="post"><button type="submit" className="scan-back">Se déconnecter</button></form>
  </section></ScanShell>;
}
