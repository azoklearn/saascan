"use client";

import Link from "next/link";
import { Check, LoaderCircle } from "lucide-react";
import type { CSSProperties } from "react";
import { ScanError, ScanShell } from "./scan-shell";

export function ScanAnalysis({ demo, step, running, complete, error, questionnaireHref, onRetry }: { demo: boolean; step: number; running: boolean; complete: boolean; error: string; questionnaireHref: string; onRetry: () => void }) {
  const progress = [12, 38, 72, 100][step] || 12;
  const labels = ["On étudie tes réponses", "On filtre les idées réalisables", "On prépare le prompt et le plan", "Ton dossier est prêt"];
  const circumference = 2 * Math.PI * 78;
  return <ScanShell stage="analysis" demo={demo}><div className="scan-analysis-container">
    <p className="scan-count">CALCUL EN COURS</p>
    <h1>On assemble ta projection.</h1>
    <p className="scan-analysis-copy">Encore quelques secondes pendant qu’on croise tes réponses.</p>
    <div className="scan-analysis-card">
      <div className="scan-analysis-ring" style={{ "--scan-progress": `${progress}%` } as CSSProperties} role="progressbar" aria-label="Avancement estimé de la préparation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <svg viewBox="0 0 200 200" aria-hidden="true"><circle className="scan-analysis-track" cx="100" cy="100" r="78" /><circle className="scan-analysis-fill" cx="100" cy="100" r="78" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress / 100)} /></svg>
        <span className="scan-analysis-number" aria-hidden="true">{progress}<small>%</small></span>
      </div>
      <div className="scan-analysis-steps" role="status" aria-live="polite">{labels.map((label, index) => <div key={label} className="scan-analysis-step" data-active={index === step} data-done={index < step}><span>{index < step ? <Check size={13} strokeWidth={3} /> : index === step && running ? <LoaderCircle size={13} className="scan-spinner" /> : null}</span>{label}</div>)}</div>
    </div>
    <p className="scan-analysis-timing">{demo ? "Animation de démonstration · Contenu préparé localement." : "Progression estimée · Garde cette page ouverte."}</p>
    {!complete ? <ScanError>Il reste des réponses à compléter. <Link href={questionnaireHref}>Revenir au questionnaire</Link></ScanError> : error && <div className="scan-analysis-actions"><ScanError>{error}</ScanError><button className="scan-button" onClick={onRetry}>Relancer l’analyse</button><Link className="scan-back" href={questionnaireHref}>Revoir mes réponses</Link></div>}
  </div></ScanShell>;
}

export function ScanReady({ demo, onContinue }: { demo: boolean; onContinue: () => void }) {
  return <ScanShell stage="ready" demo={demo}>
    <div className="scan-progress-row"><div className="scan-progress"><span style={{ width: "100%" }} /></div><span className="scan-count">Prêt</span></div>
    <div className="scan-ready"><p className="scan-count">LE PROMPT</p><h1>L’IA écrit. Toi, tu construis.</h1><p>Plus besoin de savoir par où commencer. Tu colles le prompt dans Claude, il te rend un plan de build étape par étape.</p><button className="scan-button scan-button-glow" onClick={onContinue}>Voir mon dossier</button></div>
  </ScanShell>;
}

export function ScanOffer({ demo, busy, confirming, error, onCheckout }: { demo: boolean; busy: boolean; confirming: boolean; error: string; onCheckout: () => void }) {
  return <ScanShell stage="offer" demo={demo} wide><section className="scan-offer">
    <p className="scan-count">TON ENGAGEMENT</p><h1 className="scan-offer-title">Choisis ton plan.</h1>
    <div className="scan-offer-guarantee"><strong>Pas de résultat ? On te rembourse intégralement.</strong><span>Garantie 48 h</span><p>Tu appliques la méthode pendant 48 h : si elle ne te convient pas, on rembourse ton dossier.</p></div>
    <div className="scan-offer-summary">
      <div className="scan-offer-top"><div><h2>Le dossier SaaScan</h2><p>3 idées · Un prompt de construction · Un plan sur 30 jours</p></div><div className="scan-offer-price">39 €<small>TTC · Paiement unique</small></div></div>
      <ul className="scan-offer-includes">{["Trois idées adaptées à tes compétences, ton temps et ton budget", "Une version du produit, un canal d’acquisition concret et un risque par idée", "Un prompt de 700 à 900 mots pour construire la première piste", "Quatre semaines de tâches à cocher et une progression sauvegardée", "Le prompt à copier ou à télécharger en Markdown"].map(label => <li key={label}><Check size={16} />{label}</li>)}</ul>
    </div>
    {confirming ? <div className="scan-status-message" role="status"><LoaderCircle size={15} className="scan-spinner" /> On attend la confirmation de Stripe. Ton dossier s’ouvrira automatiquement.</div> : <button className="scan-button" disabled={busy} onClick={onCheckout}>{busy ? <><LoaderCircle size={16} className="scan-spinner" /> Ouverture…</> : demo ? "Ouvrir le dossier de démonstration" : "Débloquer mon dossier — 39 €"}</button>}
    {error && <ScanError>{error}</ScanError>}
    <p className="scan-offer-note">{demo ? "Cette démonstration s’ouvre gratuitement. Aucune carte, aucun paiement." : "Paiement unique · Garantie de remboursement de 48 h"}</p>
    <p className="scan-offer-terms">{!demo && <>En continuant, tu acceptes les <Link href="/cgv">CGV</Link>. </>}Consulte la <Link href="/remboursement">garantie de remboursement</Link>. Les idées et le plan sont des pistes à valider auprès de vrais clients.</p>
  </section></ScanShell>;
}
