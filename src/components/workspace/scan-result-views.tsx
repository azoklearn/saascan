"use client";

import Link from "next/link";
import { ArrowRight, Check, LoaderCircle, LockKeyhole } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { ScanError, ScanShell } from "./scan-shell";

const analysisSteps = ["Analyse de vos réponses", "Comparaison avec la banque d’idées", "Croisement avec votre objectif de revenu", "Votre résultat est prêt"];
const offerIncludes = [
  "Trois idées choisies pour votre profil, votre temps et votre objectif de revenu",
  "Pour chaque idée : une version du produit, un premier canal d’acquisition et le risque à surveiller",
  "Un prompt de 700 à 900 mots pour construire la première idée",
  "Un plan de quatre semaines, avec des tâches à cocher",
  "Le prompt à copier ou à télécharger en Markdown",
];

export function ScanAnalysis({ demo, step }: { demo: boolean; step: number }) {
  const done = step >= analysisSteps.length - 1;
  const progress = [8, 36, 68, 100][step] ?? 100;
  return <ScanShell stage="analysis" demo={demo}><div className="scan-analysis">
    <BrandLogo />
    <p className="scan-count">CALCUL EN COURS</p>
    <h1>On assemble votre projection.</h1>
    <p className="scan-analysis-copy">Encore quelques secondes pendant que nous croisons vos réponses.</p>
    <div className="scan-analysis-bar" role="progressbar" aria-label="Avancement de l’analyse" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
    <div className="scan-analysis-steps" role="status">{analysisSteps.map((label, index) => {
      const complete = index < step || done;
      return <div key={label} className="scan-analysis-step" data-active={index === step} data-done={complete}><span aria-hidden="true">{complete ? <Check size={12} strokeWidth={3} /> : index === step ? <LoaderCircle size={12} className="scan-spinner" /> : null}</span>{label}</div>;
    })}</div>
  </div></ScanShell>;
}

export function ScanReady({ demo, onContinue }: { demo: boolean; onContinue: () => void }) {
  return <ScanShell stage="ready" demo={demo}><div className="scan-ready">
    <BrandLogo />
    <p className="scan-count">PRÊT</p>
    <h1>Nous avons trouvé l’idée parfaite : celle qui vous correspond et qui répond à vos objectifs.</h1>
    <p>Votre fiche complète vous attend derrière votre formule.</p>
    <button className="scan-button" onClick={onContinue}>Lancer mon SaaS <ArrowRight size={16} /></button>
  </div></ScanShell>;
}

export function ScanOffer({ demo, busy, error, notConfigured, onCheckout }: { demo: boolean; busy: boolean; error: string; notConfigured: boolean; onCheckout: () => void }) {
  return <ScanShell stage="offer" demo={demo}><section className="scan-offer">
    <p className="scan-count">VOTRE FORMULE</p>
    <h1 className="scan-offer-title">Débloquez votre dossier.</h1>
    <div className="scan-offer-guarantee"><strong>Pas de résultat ? On vous rembourse intégralement.</strong><span>Garantie 48 h</span><p>Vous appliquez la méthode pendant 48 heures : si elle ne vous convient pas, nous remboursons votre dossier.</p></div>
    <div className="scan-offer-summary">
      <div className="scan-offer-top"><div><h2>Le dossier SaaScan</h2><p>3 idées · Un prompt de construction · Un plan sur 30 jours</p></div><div className="scan-offer-price">39 €<small>TTC · Paiement unique</small></div></div>
      <ul className="scan-offer-includes">{offerIncludes.map((label) => <li key={label}><Check size={16} />{label}</li>)}</ul>
    </div>
    <button className="scan-button" disabled={busy} onClick={onCheckout}>{busy ? <><LoaderCircle size={16} className="scan-spinner" /> Ouverture du paiement…</> : demo ? "Ouvrir le dossier de démonstration" : "Débloquer mon dossier — 39 €"}</button>
    {error && <ScanError>{error}{notConfigured && <> <Link href="/dossier/demo?demo=1">Voir le dossier de démonstration</Link></>}</ScanError>}
    <p className="scan-offer-note"><LockKeyhole size={12} /> {demo ? "Cette démonstration s’ouvre gratuitement. Aucune carte, aucun paiement." : "Paiement sécurisé par Stripe · Votre dossier est préparé dès la confirmation"}</p>
    <p className="scan-offer-terms">{!demo && <>En continuant, vous acceptez les <Link href="/cgv">CGV</Link>. </>}Consultez la <Link href="/remboursement">garantie de remboursement</Link>. Les idées et le plan sont des pistes à valider auprès de vrais clients.</p>
  </section></ScanShell>;
}
