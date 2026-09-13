"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, LoaderCircle, Megaphone, Target } from "lucide-react";
import { findPlan, formatCents, plans, type PlanId } from "@/config/pricing";
import type { DossierState, RoadmapPhase, VideoIdea } from "@/types/domain";
import { ErrorNotice } from "./shared";

const longDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const marker = (index: number) => String(index + 1).padStart(2, "0");

function Waiting({ failed, label }: { failed: boolean; label: string }) {
  return <div className="ws-extras-wait ws-panel" role="status">{failed
    ? <p>La préparation de ce bonus n’a pas abouti. <Link href="/contact">Contactez-nous</Link> : nous le relançons pour vous.</p>
    : <p><LoaderCircle size={15} className="ws-spinner" /> {label}</p>}</div>;
}

export function VideosPanel({ videos, failed }: { videos: VideoIdea[]; failed: boolean }) {
  return <>
    <div className="ws-section-intro"><div><h2>Des vidéos pour faire connaître votre SaaS.</h2><p>Chaque idée se tourne seul, avec un téléphone ou un enregistrement d’écran : l’accroche des trois premières secondes, le déroulé et l’appel à l’action.</p></div></div>
    {videos.length === 0 ? <Waiting failed={failed} label="Vos idées de vidéos arrivent dans un instant." />
      : <ol className="ws-videos">{videos.map((video, index) => <li className="ws-video ws-panel" key={video.id}>
        <p className="ws-video-meta"><span>{marker(index)}</span>{video.plateforme} · {video.format}</p>
        <h3>« {video.accroche} »</h3>
        <p>{video.deroule}</p>
        <p className="ws-video-cta"><Megaphone size={13} /> {video.appel_action}</p>
      </li>)}</ol>}
  </>;
}

export function RoadmapPanel({ roadmap, failed }: { roadmap?: RoadmapPhase[]; failed: boolean }) {
  return <>
    <div className="ws-section-intro"><div><h2>Votre plan de A à Z sur douze mois.</h2><p>De la validation du problème au bilan de l’année. Passez à la phase suivante quand son indicateur est atteint.</p></div></div>
    {!roadmap ? <Waiting failed={failed} label="Votre plan de A à Z arrive dans un instant." />
      : <ol className="ws-roadmap">{roadmap.map((phase, index) => <li className="ws-roadmap-phase ws-panel" key={`${phase.periode}-${phase.titre}`}>
        <p className="ws-roadmap-period"><span>{String.fromCharCode(65 + index)}</span>{phase.periode}</p>
        <h3>{phase.titre}</h3>
        <p>{phase.objectif}</p>
        <ul>{phase.actions.map((action) => <li key={action}>{action}</li>)}</ul>
        <p className="ws-roadmap-signal"><Target size={13} /><span><strong>Pour passer à la suite : </strong>{phase.indicateur}</span></p>
      </li>)}</ol>}
  </>;
}

type SubscriptionProps = { dossier: DossierState; refundHref: string | null; busy: boolean; error: string; onCancel: () => void };

export function SubscriptionPanel({ dossier, refundHref, busy, error, onCancel }: SubscriptionProps) {
  const [confirming, setConfirming] = useState(false);
  const plan = findPlan(dossier.formule);
  const end = dossier.current_period_end ? longDate.format(new Date(dossier.current_period_end)) : null;
  const status = dossier.cancel_at_period_end
    ? `Résilié : votre dossier reste accessible ${end ? `jusqu’au ${end}` : "jusqu’à la fin de la période payée"}.`
    : end ? `Prochain renouvellement le ${end}.` : "Renouvellement automatique à la fin de chaque période.";
  return <section className="ws-subscription ws-panel" aria-labelledby="subscription-title">
    <div>
      <p className="ws-kicker">Votre abonnement</p>
      <h2 id="subscription-title">{plan ? `Formule ${plan.label}` : "Abonnement"}{plan && <small>{formatCents(plan.cents)} {plan.renewal}</small>}</h2>
      <p>{confirming ? `Aucun nouveau prélèvement ne sera effectué. ${end ? `Vous gardez l’accès jusqu’au ${end}.` : "Vous gardez l’accès jusqu’à la fin de la période payée."}` : status}</p>
      {error && <ErrorNotice>{error}</ErrorNotice>}
    </div>
    <div className="ws-subscription-actions">
      {refundHref && !confirming && <Link className="ws-button-secondary" href={refundHref}>Demander le remboursement</Link>}
      {!dossier.cancel_at_period_end && (confirming
        ? <><button className="ws-button-secondary" disabled={busy} onClick={() => setConfirming(false)}>Garder mon abonnement</button><button className="ws-button" disabled={busy} onClick={onCancel}>{busy && <LoaderCircle size={14} className="ws-spinner" />}Confirmer la résiliation</button></>
        : <button className="ws-button-secondary" onClick={() => setConfirming(true)}>Résilier l’abonnement</button>)}
    </div>
  </section>;
}

export function EndedScreen({ busy, error, onReactivate }: { busy: PlanId | null; error: string; onReactivate: (plan: PlanId) => void }) {
  return <div className="ws-empty ws-panel">
    <div className="ws-dossier-icon"><CalendarClock size={21} /></div>
    <h1 className="ws-title">Votre abonnement est terminé.</h1>
    <p>Votre dossier est conservé. Choisissez une formule pour retrouver vos idées, votre prompt et votre plan.</p>
    {error && <ErrorNotice>{error}</ErrorNotice>}
    <div className="ws-reactivate">{plans.map((plan) => <button key={plan.id} className={plan.popular ? "ws-button" : "ws-button-secondary"} disabled={!!busy} onClick={() => onReactivate(plan.id)}>
      {busy === plan.id && <LoaderCircle size={14} className="ws-spinner" />}{plan.label} · {formatCents(plan.cents)}
    </button>)}</div>
  </div>;
}
