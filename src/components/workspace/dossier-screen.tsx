"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDownToLine, ArrowRight, Braces, Check, ChevronDown, Clipboard, FileText, Layers3, ListChecks, LoaderCircle, ShieldCheck, Sparkles, Target, TriangleAlert } from "lucide-react";
import { planWeeks } from "@/config/plan-weeks";
import { pricing } from "@/config/pricing";
import { loadDemoDossier, saveDemoDossier } from "@/lib/demo/storage";
import { countWords } from "@/lib/generation/word-count";
import { clearLocalAnswers } from "@/lib/questionnaire/local-answers";
import type { DossierRecord, PlanTask, Selection } from "@/types/domain";
import { ApiError, ErrorNotice, ProblemScreen, Shell, Spinner, api, downloadMarkdown, friendlyError, useDemoMode } from "./shared";
import "./workspace.css";

const tabs = [{ id: "ideas", label: "Vos 3 idées", icon: Layers3 }, { id: "prompt", label: "Le prompt de construction", icon: Braces }, { id: "plan", label: "Votre plan sur 30 jours", icon: ListChecks }] as const;
type Tab = typeof tabs[number]["id"];
const preparationSteps = ["Paiement confirmé", "Sélection de vos trois idées", "Rédaction du prompt de construction", "Préparation de votre plan sur 30 jours"];
// Le serveur accepte une nouvelle réservation quatre minutes après une préparation interrompue.
const stalledAfterMs = 245_000;
const refundWindowMs = pricing.refundDays * 24 * 60 * 60_000;

function IdeaDetails({ selection }: { selection: Selection }) {
  return <><div className="ws-idea-details"><div><h4><Target size={14} /> Pourquoi cette idée pour vous</h4><p>{selection.justification}</p></div><div><h4><Sparkles size={14} /> Votre version du produit</h4><p>{selection.adaptation}</p></div><div><h4><ArrowRight size={14} /> Vos premiers clients</h4><p>{selection.canal_acquisition}</p></div><div><h4><FileText size={14} /> Le problème à valider</h4><p>{selection.idea_snapshot.probleme}</p></div></div><div className="ws-idea-risk"><TriangleAlert size={14} /><strong>Le risque à surveiller. </strong>{selection.risque}</div><details className="ws-evidence"><summary>Les réponses qui ont orienté ce choix <ChevronDown size={14} /></summary><div>{selection.reponses_citees.map((citation) => <div key={citation.question_id}><p><strong>« {citation.reponse} »</strong></p><p>{citation.effet}</p></div>)}</div></details></>;
}

function Preparation({ title, text, step, children }: { title: string; text: string; step?: number; children?: ReactNode }) {
  return <Shell><div className="ws-analysis">
    <p className="ws-kicker">Votre dossier</p>
    <h1 className="ws-title">{title}</h1>
    <p className="ws-subtitle">{text}</p>
    <div className="ws-radar" aria-hidden="true"><span className="ws-radar-ring" /><span className="ws-radar-ring" /><span className="ws-radar-ring" /><span className="ws-radar-sweep" /><span className="ws-radar-center"><Sparkles size={22} /></span></div>
    {step !== undefined && <div className="ws-analysis-steps ws-panel" role="status">{preparationSteps.map((label, index) => <div key={label} className="ws-analysis-step" data-active={index === step} data-done={index < step}><span>{index < step ? <Check size={10} strokeWidth={3} /> : index === step ? <LoaderCircle size={10} className="ws-spinner" /> : null}</span>{label}</div>)}</div>}
    {children}
  </div></Shell>;
}

export function DossierScreen({ token }: { token: string }) {
  const { demo, ready } = useDemoMode();
  const [record, setRecord] = useState<DossierRecord | null>(null);
  const [loadError, setLoadError] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [revision, setRevision] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [tab, setTab] = useState<Tab>("ideas");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const requestedAttempt = useRef<number | null>(null);
  const waiting = !record?.content;

  useEffect(() => {
    if (!ready) return;
    if (demo) { setRecord({ dossier: { statut: "pret", paid_at: new Date().toISOString(), refunded_at: null, generation_attempts: 1, generation_started_at: null }, content: loadDemoDossier() }); return; }
    let cancelled = false;
    let timer: number | undefined;
    const load = async () => {
      try {
        const data = await api<DossierRecord>(`/api/dossiers/${encodeURIComponent(token)}`);
        if (cancelled) return;
        setRecord(data); setLoadError("");
        const { dossier } = data;
        if (dossier.paid_at) clearLocalAnswers();
        if (dossier.refunded_at || data.content || (dossier.statut === "echec" && dossier.generation_attempts >= 3)) return;
        const stalled = dossier.statut === "generation" && !!dossier.generation_started_at && Date.now() - Date.parse(dossier.generation_started_at) > stalledAfterMs;
        const attempt = dossier.generation_attempts;
        if (dossier.paid_at && (dossier.statut !== "generation" || stalled) && requestedAttempt.current !== attempt) {
          requestedAttempt.current = attempt;
          setGenerationError("");
          api("/api/generate", { method: "POST", body: JSON.stringify({ token }) }).catch((cause) => {
            if (!cancelled && requestedAttempt.current === attempt && !(cause instanceof ApiError && cause.status === 409)) setGenerationError(friendlyError(cause));
          });
        }
        timer = window.setTimeout(load, dossier.paid_at ? 3000 : 2000);
      } catch (cause) {
        if (cancelled) return;
        setLoadError(friendlyError(cause));
        if (!(cause instanceof ApiError && cause.status === 404)) timer = window.setTimeout(load, 6000);
      }
    };
    void load();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [ready, demo, token, revision]);

  useEffect(() => {
    if (!waiting) return;
    const started = Date.now();
    const interval = window.setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => window.clearInterval(interval);
  }, [waiting]);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2500); return () => clearTimeout(timer); }, [copied]);

  function navigateTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setTab(tabs[next].id); document.getElementById(`tab-${tabs[next].id}`)?.focus();
  }
  async function copy() {
    if (!record?.content) return;
    try { await navigator.clipboard.writeText(record.content.build_prompt); setCopied(true); setError(""); }
    catch { setError("La copie n’est pas autorisée dans ce navigateur. Vous pouvez télécharger le prompt en Markdown."); }
  }
  function download() {
    if (!record?.content) return;
    if (demo) downloadMarkdown(record.content.build_prompt, "saascan-prompt-demo.md");
    else window.location.assign(`/api/dossiers/${encodeURIComponent(token)}/export`);
  }
  async function toggleTask(task: PlanTask) {
    if (!record?.content || pending.includes(task.id)) return;
    const nextDone = !task.done;
    const update = (done: boolean) => setRecord((previous) => previous?.content ? { ...previous, content: { ...previous.content, tasks: previous.content.tasks.map((item) => item.id === task.id ? { ...item, done } : item) } } : previous);
    setPending((previous) => [...previous, task.id]); setError(""); update(nextDone);
    try {
      if (demo) {
        const content = loadDemoDossier();
        saveDemoDossier({ ...content, tasks: content.tasks.map((item) => item.id === task.id ? { ...item, done: nextDone } : item) });
      } else await api(`/api/dossiers/${encodeURIComponent(token)}/taches/${encodeURIComponent(task.id)}`, { method: "PATCH", body: JSON.stringify({ done: nextDone }) });
    } catch (cause) {
      update(task.done); setError(friendlyError(cause));
    } finally { setPending((previous) => previous.filter((value) => value !== task.id)); }
  }

  if (!ready || (!record && !loadError)) return <Shell demo={demo}><Spinner label="Ouverture de votre dossier…" /></Shell>;
  if (!record) return <ProblemScreen message={loadError} demo={demo} retry={() => { setLoadError(""); setRevision((value) => value + 1); }} />;
  const { dossier, content } = record;
  const refundable = !demo && !!dossier.paid_at && Date.now() - Date.parse(dossier.paid_at) <= refundWindowMs;
  if (dossier.refunded_at) return <ProblemScreen message="Ce dossier a été remboursé. Son contenu n’est plus accessible." demo={demo} />;
  if (!dossier.paid_at) return <Preparation title="Nous confirmons votre paiement." text={elapsed > 90_000 ? "La confirmation prend plus de temps que prévu. Gardez l’email de confirmation : le lien de votre dossier y figure." : "Stripe nous transmet la confirmation. Votre dossier se prépare juste après."} />;
  if (!content) {
    if (dossier.statut === "echec" && dossier.generation_attempts >= 3) return <Preparation title="La préparation n’a pas abouti." text="Nous n’avons pas pu rédiger votre dossier. Vous pouvez demander son remboursement intégral ou nous écrire.">
      <p className="ws-dossier-actions">{refundable && <Link className="ws-button" href={`/remboursement?dossier=${token}`}>Demander le remboursement</Link>}<Link className="ws-button-secondary" href="/contact">Nous contacter</Link></p>
    </Preparation>;
    return <Preparation title="Votre dossier se prépare." text="Nous rédigeons vos trois idées, votre prompt et votre plan. Cela prend en général une à deux minutes : gardez cette page ouverte." step={elapsed < 15_000 ? 1 : elapsed < 50_000 ? 2 : 3}>
      {generationError && <><ErrorNotice>{generationError}</ErrorNotice><button className="ws-button-secondary" onClick={() => { requestedAttempt.current = null; setGenerationError(""); setRevision((value) => value + 1); }}>Relancer la préparation</button></>}
    </Preparation>;
  }
  const selections = [...content.selections].sort((a, b) => a.rang - b.rang);
  const first = selections[0];
  const done = content.tasks.filter((task) => task.done).length;
  const progress = content.tasks.length ? Math.round(done / content.tasks.length * 100) : 0;

  return <Shell demo={demo}><div className="ws-dossier-top"><div><p className="ws-kicker">Votre dossier SaaScan</p><h1 className="ws-title">Vos idées. <em>Votre point de départ.</em></h1><p className="ws-subtitle">Trois pistes pour votre situation. Un prompt pour construire. Un plan pour avancer, une action à la fois.</p></div><div className="ws-dossier-actions"><button className="ws-button-secondary" onClick={download}><ArrowDownToLine size={14} /> Exporter le prompt</button></div></div>
    {!demo && <p className="ws-info">Ce lien est personnel : ajoutez cette page à vos favoris ou retrouvez-la dans l’email reçu après le paiement.</p>}
    <div className="ws-tabs" role="tablist" aria-label="Les parties de votre dossier">{tabs.map(({ id: key, label, icon: Icon }, index) => <button key={key} className="ws-tab" id={`tab-${key}`} role="tab" aria-selected={tab === key} aria-controls={`panel-${key}`} tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)} onKeyDown={(event) => navigateTab(event, index)}><Icon size={15} />{label}{key === "plan" && <small>{done}/{content.tasks.length}</small>}</button>)}</div>
    {error && <ErrorNotice>{error}</ErrorNotice>}
    <section id="panel-ideas" role="tabpanel" aria-labelledby="tab-ideas" hidden={tab !== "ideas"}>
      {first && <article className="ws-idea-primary ws-panel"><p className="ws-idea-rank"><span>01</span> La piste à explorer en premier</p><div className="ws-idea-header"><div><h3>{first.idea_snapshot.nom}</h3><p className="ws-idea-pitch">{first.idea_snapshot.pitch}</p></div><div className="ws-idea-symbol"><Layers3 size={28} strokeWidth={1.4} /></div></div><div className="ws-tags"><span className="ws-tag">{first.idea_snapshot.cible}</span><span className="ws-tag">Dès {first.idea_snapshot.budget_min_euros} € au départ</span><span className="ws-tag">Prix à tester : {first.idea_snapshot.prix_conseille}</span></div><IdeaDetails selection={first} /></article>}
      <div className="ws-alternatives">{selections.slice(1).map((selection) => <article className="ws-alternative ws-panel" key={selection.id}><p className="ws-idea-rank"><span>0{selection.rang}</span> Une autre direction possible</p><h3>{selection.idea_snapshot.nom}</h3><p>{selection.idea_snapshot.pitch}</p><div className="ws-tags"><span className="ws-tag">{selection.idea_snapshot.prix_conseille}</span><span className="ws-tag">{selection.idea_snapshot.tags.slice(0, 2).join(" · ")}</span></div><details><summary>Explorer cette piste <ChevronDown size={15} /></summary><IdeaDetails selection={selection} /></details></article>)}</div>
      <p className="ws-dossier-disclaimer"><ShieldCheck size={14} />Les prix sont des hypothèses à tester. Ces idées et ce plan ne garantissent ni clients ni revenus. Le premier objectif reste de vérifier le problème auprès de vraies personnes.</p>
      <button className="ws-button" style={{ marginTop: 25 }} onClick={() => { setTab("prompt"); document.getElementById("tab-prompt")?.focus(); }}>Découvrir mon prompt <ArrowRight size={14} /></button>
    </section>
    <section id="panel-prompt" role="tabpanel" aria-labelledby="tab-prompt" hidden={tab !== "prompt"}><div className="ws-section-intro"><div><h2>La première version commence ici.</h2><p>Copiez ce prompt dans Claude Code ou Lovable. Il définit le produit, le parcours et les critères pour savoir quand c’est prêt.</p></div><div className="ws-prompt-actions"><button className="ws-button-secondary" onClick={download} aria-label="Télécharger le prompt en Markdown"><ArrowDownToLine size={14} /> .md</button><button className="ws-button" onClick={copy}>{copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? "Copié !" : "Copier le prompt"}</button></div></div><div className="ws-panel"><div className="ws-prompt-meta"><span><FileText size={14} /> {first?.idea_snapshot.nom || "mon-projet"}.md</span><span>{countWords(content.build_prompt)} mots</span></div><pre className="ws-prompt-content" tabIndex={0} aria-label="Prompt de construction complet">{content.build_prompt}</pre></div><p className="ws-dossier-disclaimer"><Braces size={14} />Le prompt concerne la piste classée première. Commencez par valider son problème avant de construire.</p><span role="status" className="sr-only">{copied ? "Le prompt est copié dans le presse-papiers." : ""}</span></section>
    <section id="panel-plan" role="tabpanel" aria-labelledby="tab-plan" hidden={tab !== "plan"}><div className="ws-section-intro"><div><h2>Un mois pour transformer l’idée en test réel.</h2><p>Cochez vos avancées. {demo ? "Elles restent enregistrées dans ce navigateur." : "Votre progression est enregistrée avec votre dossier."}</p></div></div><div className="ws-plan-progress ws-panel"><strong>{progress}%</strong><div><p><span>Chaque petite étape compte.</span><span>{done} / {content.tasks.length} tâches</span></p><div className="ws-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={content.tasks.length} aria-valuenow={done} aria-label="Tâches terminées"><div className="ws-progress-fill" style={{ width: `${progress}%` }} /></div></div></div>{planWeeks.map((week) => { const tasks = content.tasks.filter((task) => task.semaine === week.semaine).sort((a, b) => a.position - b.position); return <details className="ws-week" key={week.semaine} open><summary><span className="ws-week-number">S0{week.semaine}</span><div><h3>{week.title}</h3><p>{week.description} · {tasks.filter((task) => task.done).length}/{tasks.length}</p></div><ChevronDown size={17} /></summary><div className="ws-week-tasks">{tasks.map((task) => <label className="ws-task" data-done={task.done} key={task.id}><input type="checkbox" checked={task.done} disabled={pending.includes(task.id)} onChange={() => void toggleTask(task)} /><span>{task.libelle}</span>{pending.includes(task.id) && <LoaderCircle size={12} className="ws-spinner" />}</label>)}</div></details>; })}</section>
    {refundable && <p className="ws-dossier-disclaimer" style={{ marginTop: 34 }}><Link href={`/remboursement?dossier=${token}`}>Demander le remboursement (garantie de 48 heures)</Link></p>}
  </Shell>;
}
