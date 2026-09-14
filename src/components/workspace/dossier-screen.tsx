"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDownToLine, ArrowRight, Braces, Check, ChevronDown, Clapperboard, Clipboard, FileText, Layers3, Link2, ListChecks, LoaderCircle, Route, ShieldCheck, Sparkles, Target, TriangleAlert } from "lucide-react";
import { planWeeks } from "@/config/plan-weeks";
import { findPlan, type PlanId } from "@/config/pricing";
import { loadDemoProgress, saveDemoProgress } from "@/lib/demo/storage";
import { countWords } from "@/lib/dossier/word-count";
import { clearLocalAnswers } from "@/lib/questionnaire/local-answers";
import type { DossierContent, DossierRecord, DossierState, PlanTask, Selection } from "@/types/domain";
import { EndedScreen, RoadmapPanel, SubscriptionPanel, VideosPanel } from "./dossier-extras";
import { ApiError, ErrorNotice, ProblemScreen, Shell, Spinner, api, checkoutUrl, downloadMarkdown, friendlyError } from "./shared";
import "./workspace.css";

const allTabs = [
  { id: "ideas", label: "Vos 3 idées", icon: Layers3 },
  { id: "prompt", label: "Le prompt de construction", icon: Braces },
  { id: "plan", label: "Votre plan sur 30 jours", icon: ListChecks },
  { id: "videos", label: "Vidéos marketing", icon: Clapperboard },
  { id: "roadmap", label: "Plan de A à Z", icon: Route },
] as const;
type Tab = typeof allTabs[number]["id"];
const preparationSteps = ["Paiement confirmé", "Sélection de vos trois idées", "Adaptation du prompt de construction", "Préparation de votre plan sur 30 jours"];
// Le serveur accepte une nouvelle réservation quatre minutes après une préparation interrompue.
const stalledAfterMs = 245_000;
const isRunning = (startedAt: string | null) => !!startedAt && Date.now() - Date.parse(startedAt) <= stalledAfterMs;
// Étiquettes internes de data/ideas.json, dites en mots simples.
const tagLabels: Record<string, string> = { b2b: "Pour les professionnels", b2c: "Pour les particuliers", "no-code": "Sans code", ia: "Avec l’IA" };
const readableTags = (tags: string[]) => tags.flatMap((tag) => tagLabels[tag] ?? []).join(" · ");

function extrasMissing(dossier: DossierState, content: DossierContent | undefined) {
  const plan = findPlan(dossier.formule);
  return !!content && !!plan && ((plan.videoIdeas > 0 && !content.videos?.length) || (plan.roadmap && !content.roadmap));
}

/** Abonnement 12 mois fictif autour du dossier d’exemple assemblé par le serveur. */
function demoRecord(content: DossierContent, done: string[]): DossierRecord {
  const now = Date.now();
  return {
    dossier: { statut: "pret", paid_at: new Date(now).toISOString(), refunded_at: null, generation_attempts: 1, generation_started_at: null, formule: "annuel", membership_status: "active", cancel_at_period_end: false, current_period_end: new Date(now + 365 * 86_400_000).toISOString(), extras_attempts: 0, extras_started_at: null },
    access: true, content: { ...content, tasks: content.tasks.map((task) => ({ ...task, done: done.includes(task.id) })) },
  };
}

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

export function DossierScreen({ token, demoContent }: { token: string; demoContent?: DossierContent }) {
  const demo = !!demoContent;
  const [record, setRecord] = useState<DossierRecord | null>(null);
  const [loadError, setLoadError] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [revision, setRevision] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [tab, setTab] = useState<Tab>("ideas");
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [action, setAction] = useState<{ busy: "cancel" | PlanId | null; error: string; target?: "cancel" | "reactivate" }>({ busy: null, error: "" });
  const requestedAttempt = useRef<number | null>(null);
  const requestedBonus = useRef<number | null>(null);
  const waiting = !record?.content;

  useEffect(() => { setPaymentFailed(new URLSearchParams(window.location.search).get("status") === "error"); }, []);
  useEffect(() => {
    if (demoContent) { setRecord(demoRecord(demoContent, loadDemoProgress())); return; }
    let cancelled = false;
    let timer: number | undefined;
    const load = async () => {
      try {
        const data = await api<DossierRecord>(`/api/dossiers/${encodeURIComponent(token)}`);
        if (cancelled) return;
        setRecord(data); setLoadError("");
        const { dossier, content } = data;
        if (dossier.paid_at) clearLocalAnswers();
        const bonusPending = extrasMissing(dossier, content);
        const closed = !!dossier.refunded_at || (!!dossier.paid_at && !data.access);
        const generationOver = !content && dossier.statut === "echec" && dossier.generation_attempts >= 3;
        const bonusOver = bonusPending && dossier.extras_attempts >= 3 && !isRunning(dossier.extras_started_at);
        if (closed || generationOver || (content && (!bonusPending || bonusOver))) return;
        if (!content) {
          const attempt = dossier.generation_attempts;
          const stalled = dossier.statut === "generation" && !isRunning(dossier.generation_started_at);
          if (dossier.paid_at && (dossier.statut !== "generation" || stalled) && requestedAttempt.current !== attempt) {
            requestedAttempt.current = attempt;
            setGenerationError("");
            api("/api/generate", { method: "POST", body: JSON.stringify({ token }) }).catch((cause) => {
              if (!cancelled && requestedAttempt.current === attempt && !(cause instanceof ApiError && cause.status === 409)) setGenerationError(friendlyError(cause));
            });
          }
        } else if (!isRunning(dossier.extras_started_at) && requestedBonus.current !== dossier.extras_attempts) {
          requestedBonus.current = dossier.extras_attempts;
          // Un échec reste visible dans l’état du dossier, qui autorise trois tentatives.
          api("/api/generate", { method: "POST", body: JSON.stringify({ token, part: "bonus" }) }).catch(() => undefined);
        }
        timer = window.setTimeout(load, dossier.paid_at ? 2500 : 2000);
      } catch (cause) {
        if (cancelled) return;
        setLoadError(friendlyError(cause));
        if (!(cause instanceof ApiError && cause.status === 404)) timer = window.setTimeout(load, 6000);
      }
    };
    void load();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [demoContent, token, revision]);

  useEffect(() => {
    if (!waiting) return;
    const started = Date.now();
    const interval = window.setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => window.clearInterval(interval);
  }, [waiting]);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2500); return () => clearTimeout(timer); }, [copied]);
  useEffect(() => { if (!linkCopied) return; const timer = setTimeout(() => setLinkCopied(false), 2500); return () => clearTimeout(timer); }, [linkCopied]);

  async function copy() {
    if (!record?.content) return;
    try { await navigator.clipboard.writeText(record.content.build_prompt); setCopied(true); setError(""); }
    catch { setError("La copie n’est pas autorisée dans ce navigateur. Vous pouvez télécharger le prompt en Markdown."); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/dossier/${token}`); setLinkCopied(true); setError(""); }
    catch { setError("La copie n’est pas autorisée dans ce navigateur. Votre dossier reste accessible depuis votre espace."); }
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
        const done = new Set(loadDemoProgress());
        if (nextDone) done.add(task.id); else done.delete(task.id);
        saveDemoProgress([...done]);
      } else await api(`/api/dossiers/${encodeURIComponent(token)}/taches/${encodeURIComponent(task.id)}`, { method: "PATCH", body: JSON.stringify({ done: nextDone }) });
    } catch (cause) {
      update(task.done); setError(friendlyError(cause));
    } finally { setPending((previous) => previous.filter((value) => value !== task.id)); }
  }
  async function run(busy: "cancel" | PlanId, target: "cancel" | "reactivate", request: () => Promise<void>) {
    setAction({ busy, error: "", target });
    try { await request(); setAction({ busy: null, error: "" }); }
    catch (cause) { setAction({ busy: null, error: friendlyError(cause), target }); }
  }
  const cancelSubscription = () => run("cancel", "cancel", async () => {
    await api("/api/abonnement", { method: "POST", body: JSON.stringify({ token }) });
    setRevision((value) => value + 1);
  });
  // La redirection vers Whop ou vers la connexion garde le bouton occupé jusqu’au changement de page.
  const reactivate = (formule: PlanId) => run(formule, "reactivate", async () => {
    try {
      const { url } = await api<{ url: string }>("/api/checkout", { method: "POST", body: JSON.stringify({ formule, token, renonciation_retractation: true }) });
      window.location.assign(checkoutUrl(url));
    } catch (cause) {
      if (!(cause instanceof ApiError && cause.status === 401)) throw cause;
      window.location.assign(`/connexion?suite=${encodeURIComponent(`/dossier/${token}`)}`);
    }
    await new Promise(() => undefined);
  });
  const errorFor = (target: "cancel" | "reactivate") => action.target === target ? action.error : "";

  if (!record && !loadError) return <Shell demo={demo}><Spinner label="Ouverture de votre dossier…" /></Shell>;
  if (!record) return <ProblemScreen message={loadError} demo={demo} retry={() => { setLoadError(""); setRevision((value) => value + 1); }} />;
  const { dossier, content } = record;
  const plan = findPlan(dossier.formule);
  if (dossier.refunded_at) return <ProblemScreen message="Ce dossier a été remboursé. Son contenu n’est plus accessible." demo={demo} />;
  if (!dossier.paid_at) {
    if (paymentFailed) return <Preparation title="Le paiement n’a pas abouti." text="Aucun abonnement n’a été créé. Vous pouvez choisir à nouveau votre formule quand vous voulez."><p className="ws-dossier-actions ws-centered"><Link className="ws-button" href="/debloquer">Choisir ma formule</Link></p></Preparation>;
    return <Preparation title="Nous confirmons votre paiement." text={elapsed > 90_000 ? "La confirmation prend plus de temps que prévu. Gardez cette page ouverte : elle s’actualise dès que Whop confirme le paiement." : "Whop nous transmet la confirmation. Votre dossier s’ouvre juste après et reste ensuite dans votre espace."} />;
  }
  if (!record.access) return <Shell><EndedScreen busy={action.target === "reactivate" && action.busy !== "cancel" ? action.busy : null} error={errorFor("reactivate")} onReactivate={reactivate} /></Shell>;
  if (!content) {
    if (dossier.statut === "echec" && dossier.generation_attempts >= 3) return <Preparation title="La préparation n’a pas abouti." text="Nous n’avons pas pu préparer votre dossier. Écrivez-nous : nous le préparons pour vous ou nous remboursons votre paiement.">
      <p className="ws-dossier-actions ws-centered"><Link className="ws-button" href="/contact">Nous contacter</Link></p>
    </Preparation>;
    return <Preparation title="Votre dossier se prépare." text="Nous assemblons vos trois idées, votre prompt et votre plan. Cela ne prend que quelques secondes : gardez cette page ouverte." step={elapsed < 2_000 ? 1 : elapsed < 5_000 ? 2 : 3}>
      {generationError && <><ErrorNotice>{generationError}</ErrorNotice><button className="ws-button-secondary" onClick={() => { requestedAttempt.current = null; setGenerationError(""); setRevision((value) => value + 1); }}>Relancer la préparation</button></>}
    </Preparation>;
  }
  const tabs = allTabs.filter((entry) => entry.id === "videos" ? !!plan?.videoIdeas : entry.id === "roadmap" ? !!plan?.roadmap : true);
  const bonusFailed = dossier.extras_attempts >= 3 && !isRunning(dossier.extras_started_at);
  const selections = [...content.selections].sort((a, b) => a.rang - b.rang);
  const first = selections[0];
  const done = content.tasks.filter((task) => task.done).length;
  const progress = content.tasks.length ? Math.round(done / content.tasks.length * 100) : 0;
  function navigateTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setTab(tabs[next].id); document.getElementById(`tab-${tabs[next].id}`)?.focus();
  }

  return <Shell demo={demo}><div className="ws-dossier-top"><div><p className="ws-kicker">Votre dossier SaaScan</p><h1 className="ws-title">Vos idées. <em>Votre point de départ.</em></h1><p className="ws-subtitle">Trois pistes pour votre situation. Un prompt pour construire. Un plan pour avancer, une action à la fois.</p></div><div className="ws-dossier-actions"><button className="ws-button-secondary" onClick={download}><ArrowDownToLine size={14} /> Exporter le prompt</button></div></div>
    {!demo && <div className="ws-link-save"><p><Link2 size={15} /><span><strong>Ce dossier reste dans votre espace.</strong> Retrouvez-le depuis « Mon espace » sur n’importe quel appareil. Son lien personnel l’ouvre aussi sans connexion : ne le partagez pas.</span></p><button className="ws-button-secondary" onClick={copyLink}>{linkCopied ? <Check size={14} /> : <Clipboard size={14} />}{linkCopied ? "Lien copié" : "Copier le lien"}</button><span role="status" className="sr-only">{linkCopied ? "Le lien du dossier est copié dans le presse-papiers." : ""}</span></div>}
    <div className="ws-tabs" role="tablist" aria-label="Les parties de votre dossier">{tabs.map(({ id: key, label, icon: Icon }, index) => <button key={key} className="ws-tab" id={`tab-${key}`} role="tab" aria-selected={tab === key} aria-controls={`panel-${key}`} tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)} onKeyDown={(event) => navigateTab(event, index)}><Icon size={15} />{label}{key === "plan" && <small>{done}/{content.tasks.length}</small>}{key === "videos" && !!content.videos?.length && <small>{content.videos.length}</small>}</button>)}</div>
    {error && <ErrorNotice>{error}</ErrorNotice>}
    <section id="panel-ideas" role="tabpanel" aria-labelledby="tab-ideas" hidden={tab !== "ideas"}>
      {first && <article className="ws-idea-primary ws-panel"><p className="ws-idea-rank"><span>01</span> La piste à explorer en premier</p><div className="ws-idea-header"><div><h3>{first.idea_snapshot.nom}</h3><p className="ws-idea-pitch">{first.idea_snapshot.pitch}</p></div><div className="ws-idea-symbol"><Layers3 size={28} strokeWidth={1.4} /></div></div><div className="ws-tags"><span className="ws-tag">{first.idea_snapshot.cible}</span><span className="ws-tag">Dès {first.idea_snapshot.budget_min_euros} € au départ</span><span className="ws-tag">Prix à tester : {first.idea_snapshot.prix_conseille}</span></div><IdeaDetails selection={first} /></article>}
      <div className="ws-alternatives">{selections.slice(1).map((selection) => <article className="ws-alternative ws-panel" key={selection.id}><p className="ws-idea-rank"><span>0{selection.rang}</span> Une autre direction possible</p><h3>{selection.idea_snapshot.nom}</h3><p>{selection.idea_snapshot.pitch}</p><div className="ws-tags"><span className="ws-tag">{selection.idea_snapshot.prix_conseille}</span>{readableTags(selection.idea_snapshot.tags) && <span className="ws-tag">{readableTags(selection.idea_snapshot.tags)}</span>}</div><details><summary>Explorer cette piste <ChevronDown size={15} /></summary><IdeaDetails selection={selection} /></details></article>)}</div>
      <p className="ws-dossier-disclaimer"><ShieldCheck size={14} />Les prix sont des hypothèses à tester. Ces idées et ce plan ne garantissent ni clients ni revenus. Le premier objectif reste de vérifier le problème auprès de vraies personnes.</p>
      <button className="ws-button" style={{ marginTop: 25 }} onClick={() => { setTab("prompt"); document.getElementById("tab-prompt")?.focus(); }}>Découvrir mon prompt <ArrowRight size={14} /></button>
    </section>
    <section id="panel-prompt" role="tabpanel" aria-labelledby="tab-prompt" hidden={tab !== "prompt"}><div className="ws-section-intro"><div><h2>La première version commence ici.</h2><p>Copiez ce prompt dans Claude Code ou Lovable. Il définit le produit, le parcours et les critères pour savoir quand c’est prêt.</p></div><div className="ws-prompt-actions"><button className="ws-button-secondary" onClick={download} aria-label="Télécharger le prompt en Markdown"><ArrowDownToLine size={14} /> .md</button><button className="ws-button" onClick={copy}>{copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? "Copié !" : "Copier le prompt"}</button></div></div><div className="ws-panel"><div className="ws-prompt-meta"><span><FileText size={14} /> {first?.idea_snapshot.nom || "mon-projet"}.md</span><span>{countWords(content.build_prompt)} mots</span></div><pre className="ws-prompt-content" tabIndex={0} aria-label="Prompt de construction complet">{content.build_prompt}</pre></div><p className="ws-dossier-disclaimer"><Braces size={14} />Le prompt concerne la piste classée première. Commencez par valider son problème avant de construire.</p><span role="status" className="sr-only">{copied ? "Le prompt est copié dans le presse-papiers." : ""}</span></section>
    <section id="panel-plan" role="tabpanel" aria-labelledby="tab-plan" hidden={tab !== "plan"}><div className="ws-section-intro"><div><h2>Un mois pour transformer l’idée en test réel.</h2><p>Cochez vos avancées. {demo ? "Elles restent enregistrées dans ce navigateur." : "Votre progression est enregistrée avec votre dossier."}</p></div></div><div className="ws-plan-progress ws-panel"><strong>{progress}%</strong><div><p><span>Chaque petite étape compte.</span><span>{done} / {content.tasks.length} tâches</span></p><div className="ws-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={content.tasks.length} aria-valuenow={done} aria-label="Tâches terminées"><div className="ws-progress-fill" style={{ width: `${progress}%` }} /></div></div></div>{planWeeks.map((week) => { const tasks = content.tasks.filter((task) => task.semaine === week.semaine).sort((a, b) => a.position - b.position); return <details className="ws-week" key={week.semaine} open><summary><span className="ws-week-number">S0{week.semaine}</span><div><h3>{week.title}</h3><p>{week.description} · {tasks.filter((task) => task.done).length}/{tasks.length}</p></div><ChevronDown size={17} /></summary><div className="ws-week-tasks">{tasks.map((task) => <label className="ws-task" data-done={task.done} key={task.id}><input type="checkbox" checked={task.done} disabled={pending.includes(task.id)} onChange={() => void toggleTask(task)} /><span>{task.libelle}</span>{pending.includes(task.id) && <LoaderCircle size={12} className="ws-spinner" />}</label>)}</div></details>; })}</section>
    {!!plan?.videoIdeas && <section id="panel-videos" role="tabpanel" aria-labelledby="tab-videos" hidden={tab !== "videos"}><VideosPanel videos={content.videos ?? []} failed={bonusFailed} /></section>}
    {!!plan?.roadmap && <section id="panel-roadmap" role="tabpanel" aria-labelledby="tab-roadmap" hidden={tab !== "roadmap"}><RoadmapPanel roadmap={content.roadmap} failed={bonusFailed} /></section>}
    {!demo && <SubscriptionPanel dossier={dossier} busy={action.busy === "cancel"} error={errorFor("cancel")} onCancel={cancelSubscription} />}
  </Shell>;
}
