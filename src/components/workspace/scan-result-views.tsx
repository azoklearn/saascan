"use client";

import Link from "next/link";
import { ArrowRight, Check, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { formatCents, monthlyEquivalent, perDay, planIncludes, plans, refundDays, savingsPercent, type PlanId } from "@/config/pricing";
import { ScanError, ScanShell } from "./scan-shell";

const analysisSteps = ["Analyse de vos réponses", "Comparaison avec la banque d’idées", "Croisement avec votre objectif de revenu", "Votre résultat est prêt"];
const bestSavings = Math.max(...plans.map(savingsPercent));
const bestPlan = plans.find((plan) => savingsPercent(plan) === bestSavings)!;

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

type OfferProps = { demo: boolean; busy: boolean; error: string; notConfigured: boolean; selected: PlanId; onSelect: (plan: PlanId) => void; onCheckout: () => void };

export function ScanOffer({ demo, busy, error, notConfigured, selected, onSelect, onCheckout }: OfferProps) {
  const chosen = plans.find((plan) => plan.id === selected)!;
  return <ScanShell stage="offer" demo={demo}><section className="scan-offer">
    <p className="scan-offer-banner"><strong>−{bestSavings} %</strong><span>avec la formule {bestPlan.label}, par rapport au mensuel</span></p>
    <div className="scan-offer-guarantee">
      <ShieldCheck size={22} aria-hidden="true" />
      <div><strong>Pas de résultat ? On vous rembourse intégralement.</strong><span>Garantie 48 h</span><p>Vous appliquez la méthode pendant 48 heures : si elle ne vous convient pas, nous remboursons votre premier paiement. <Link href="/remboursement">Voir les conditions</Link></p></div>
    </div>
    <h1 className="scan-offer-title">Choisissez votre formule.</h1>
    <fieldset className="scan-plans">
      <legend className="sr-only">Formules d’abonnement</legend>
      {plans.map((plan) => {
        const savings = savingsPercent(plan);
        const checked = plan.id === selected;
        return <label key={plan.id} className="scan-plan" data-selected={checked} data-popular={plan.popular}>
          <input type="radio" name="formule" value={plan.id} checked={checked} onChange={() => onSelect(plan.id)} />
          {plan.popular && <span className="scan-plan-flag">Recommandé</span>}
          <span className="scan-plan-radio" aria-hidden="true">{checked && <Check size={13} strokeWidth={3} />}</span>
          <span className="scan-plan-main">
            <span className="scan-plan-name">{plan.label}{savings > 0 && <span className="scan-plan-badge">−{savings} %</span>}</span>
            <span className="scan-plan-price">{savings > 0 && <s title="Le même nombre de mois en formule mensuelle">{formatCents(monthlyEquivalent(plan))}</s>}<b>{formatCents(plan.cents)}</b> / {plan.cadence}</span>
            <span className="scan-plan-includes">{planIncludes(plan).join(" + ")}</span>
          </span>
          <span className="scan-plan-day"><b>{perDay(plan)}</b>/ jour</span>
        </label>;
      })}
    </fieldset>
    <p className="scan-plans-note">Prix barrés : le même nombre de mois en formule mensuelle. Prix TTC, sans engagement : résiliable à tout moment depuis votre dossier.</p>
    <button className="scan-button" disabled={busy} onClick={onCheckout}>{busy ? <><LoaderCircle size={16} className="scan-spinner" /> Ouverture du paiement…</> : demo ? "Ouvrir le dossier de démonstration" : "Continuer"}</button>
    {error && <ScanError>{error}{notConfigured && <> <Link href="/dossier/demo?demo=1">Voir le dossier de démonstration</Link></>}</ScanError>}
    <p className="scan-offer-note"><LockKeyhole size={12} /> {demo ? "Cette démonstration s’ouvre gratuitement. Aucune carte, aucun paiement." : "Paiement sécurisé par Whop · Votre dossier est préparé dès la confirmation"}</p>
    <p className="scan-offer-terms">{!demo && <>En continuant, vous acceptez les <Link href="/cgv">CGV</Link> et le renouvellement automatique de la formule {chosen.label} ({formatCents(chosen.cents)} {chosen.renewal}) jusqu’à sa résiliation. </>}Garantie de remboursement de {refundDays * 24} heures sur le premier paiement. Les idées et le plan sont des pistes à valider auprès de vrais clients.</p>
  </section></ScanShell>;
}
