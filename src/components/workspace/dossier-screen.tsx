"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type KeyboardEvent } from "react";
import { ArrowDownToLine, ArrowRight, Braces, Check, ChevronDown, Clipboard, FileText, Layers3, ListChecks, LoaderCircle, ShieldCheck, Sparkles, Target, TriangleAlert } from "lucide-react";
import { planWeeks } from "@/config/plan-weeks";
import { countWords } from "@/lib/generation/word-count";
import type { Selection, PlanTask } from "@/types/domain";
import { useDossier, Shell, Spinner, ProblemScreen, ErrorNotice, friendlyError, getDemo, storeDemo, downloadMarkdown } from "./workspace-client";
import "./workspace.css";

const tabs = [{ id: "ideas", label: "Tes 3 idées", icon: Layers3 }, { id: "prompt", label: "Le prompt de construction", icon: Braces }, { id: "plan", label: "Ton plan sur 30 jours", icon: ListChecks }] as const;
type Tab = typeof tabs[number]["id"];

function IdeaDetails({ selection }: { selection: Selection }) {
  return <><div className="ws-idea-details"><div><h4><Target size={14} /> Pourquoi cette idée pour toi</h4><p>{selection.justification}</p></div><div><h4><Sparkles size={14} /> Ta version du produit</h4><p>{selection.adaptation}</p></div><div><h4><ArrowRight size={14} /> Tes premiers clients</h4><p>{selection.canal_acquisition}</p></div><div><h4><FileText size={14} /> Le problème à valider</h4><p>{selection.idea_snapshot.probleme}</p></div></div><div className="ws-idea-risk"><TriangleAlert size={14} /><strong>Le risque à surveiller. </strong>{selection.risque}</div><details className="ws-evidence"><summary>Les réponses qui ont orienté ce choix <ChevronDown size={14} /></summary><div>{selection.reponses_citees.map((citation) => <div key={citation.question_id}><p><strong>« {citation.reponse} »</strong></p><p>{citation.effet}</p></div>)}</div></details></>;
}

export function DossierScreen({ id }: { id: string }) {
  const router = useRouter();
  const { record, setRecord, demo, loading, error: loadError, reload } = useDossier(id);
  const [tab, setTab] = useState<Tab>("ideas");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string[]>([]);

  useEffect(() => {
    if (!record || record.dossier.refunded_at) return;
    if (demo ? !record.demoOpened : !record.dossier.paid_at) router.replace(`/debloquer/${id}${demo ? "?demo=1" : ""}`);
  }, [record, id, demo, router]);
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
    catch { setError("La copie n’est pas autorisée dans ce navigateur. Tu peux télécharger le prompt en Markdown."); }
  }
  function download() {
    if (!record?.content) return;
    if (demo) downloadMarkdown(record.content.build_prompt, "saascan-prompt-demo.md");
    else window.location.assign(`/api/dossiers/${encodeURIComponent(id)}/export`);
  }
  async function toggleTask(task: PlanTask) {
    if (!record?.content || pending.includes(task.id)) return;
    const nextDone = !task.done;
    setPending(previous => [...previous, task.id]); setError("");
    setRecord(previous => previous?.content ? { ...previous, content: { ...previous.content, tasks: previous.content.tasks.map(item => item.id === task.id ? { ...item, done: nextDone } : item) } } : previous);
    try {
      if (demo) {
        const stored = getDemo(id);
        if (stored.content) stored.content.tasks = stored.content.tasks.map(item => item.id === task.id ? { ...item, done: nextDone } : item);
        storeDemo(stored);
      } else {
        const response = await fetch(`/api/plan-tasks/${encodeURIComponent(task.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: nextDone }), credentials: "same-origin" });
        if (!response.ok) { const data = await response.json(); throw new Error(data.error || "La tâche n’a pas été enregistrée."); }
      }
    } catch (cause) {
      setRecord(previous => previous?.content ? { ...previous, content: { ...previous.content, tasks: previous.content.tasks.map(item => item.id === task.id ? { ...item, done: task.done } : item) } } : previous);
      setError(friendlyError(cause));
    } finally { setPending(previous => previous.filter(value => value !== task.id)); }
  }

  if (loading) return <Shell><Spinner label="Ouverture de ton dossier…" /></Shell>;
  if (loadError || !record) return <ProblemScreen message={loadError || "Ce dossier est introuvable."} demo={demo} retry={reload} />;
  if (record.dossier.refunded_at) return <ProblemScreen message="Ce dossier a été remboursé. Son contenu n’est plus accessible." demo={demo} />;
  const hasAccess = demo ? record.demoOpened : !!record.dossier.paid_at;
  if (!hasAccess) return <Shell demo={demo}><Spinner label="Vérification de l’accès à ton dossier…" /></Shell>;
  const content = record.content;
  if (!content) return <ProblemScreen message={demo ? "Le contenu de cette démonstration n’est pas disponible. Réessaie de charger ton dossier." : "Ton paiement est enregistré, mais le contenu du dossier n’a pas pu être chargé. Réessaie dans un instant."} demo={demo} retry={reload} />;
  const selections = [...content.selections].sort((a, b) => a.rang - b.rang);
  const first = selections[0];
  const done = content.tasks.filter(task => task.done).length;
  const progress = content.tasks.length ? Math.round(done / content.tasks.length * 100) : 0;

  return <Shell demo={demo} crumb="Ton dossier"><div className="ws-dossier-top"><div><p className="ws-kicker">De quoi passer à l’étape suivante</p><h1 className="ws-title">Tes idées. <em>Ton point de départ.</em></h1><p className="ws-subtitle">Trois pistes pour ta situation. Un prompt pour construire. Un plan pour avancer, une action à la fois.</p></div><div className="ws-dossier-actions"><button className="ws-button-secondary" onClick={download}><ArrowDownToLine size={14} /> Exporter le prompt</button></div></div>
    <div className="ws-tabs" role="tablist" aria-label="Les parties de ton dossier">{tabs.map(({ id: key, label, icon: Icon }, index) => <button key={key} className="ws-tab" id={`tab-${key}`} role="tab" aria-selected={tab === key} aria-controls={`panel-${key}`} tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)} onKeyDown={event => navigateTab(event, index)}><Icon size={15} />{label}{key === "plan" && <small>{done}/{content.tasks.length}</small>}</button>)}</div>
    {error && <ErrorNotice>{error}</ErrorNotice>}
    <section id="panel-ideas" role="tabpanel" aria-labelledby="tab-ideas" hidden={tab !== "ideas"}>
      {first && <article className="ws-idea-primary ws-panel"><p className="ws-idea-rank"><span>01</span> La piste à explorer en premier</p><div className="ws-idea-header"><div><h3>{first.idea_snapshot.nom}</h3><p className="ws-idea-pitch">{first.idea_snapshot.pitch}</p></div><div className="ws-idea-symbol"><Layers3 size={28} strokeWidth={1.4} /></div></div><div className="ws-tags"><span className="ws-tag">{first.idea_snapshot.cible}</span><span className="ws-tag">Dès {first.idea_snapshot.budget_min_euros} € au départ</span><span className="ws-tag">Prix à tester : {first.idea_snapshot.prix_conseille}</span></div><IdeaDetails selection={first} /></article>}
      <div className="ws-alternatives">{selections.slice(1).map(selection => <article className="ws-alternative ws-panel" key={selection.id}><p className="ws-idea-rank"><span>0{selection.rang}</span> Une autre direction possible</p><h3>{selection.idea_snapshot.nom}</h3><p>{selection.idea_snapshot.pitch}</p><div className="ws-tags"><span className="ws-tag">{selection.idea_snapshot.prix_conseille}</span><span className="ws-tag">{selection.idea_snapshot.tags.slice(0, 2).join(" · ")}</span></div><details><summary>Explorer cette piste <ChevronDown size={15} /></summary><IdeaDetails selection={selection} /></details></article>)}</div>
      <p className="ws-dossier-disclaimer"><ShieldCheck size={14} />Les prix sont des hypothèses à tester. Ces idées et ce plan ne garantissent ni clients ni revenus. Le premier objectif reste de vérifier le problème auprès de vraies personnes.</p>
      <button className="ws-button" style={{ marginTop: 25 }} onClick={() => { setTab("prompt"); document.getElementById("tab-prompt")?.focus(); }}>Découvrir mon prompt <ArrowRight size={14} /></button>
    </section>
    <section id="panel-prompt" role="tabpanel" aria-labelledby="tab-prompt" hidden={tab !== "prompt"}><div className="ws-section-intro"><div><h2>La première version commence ici.</h2><p>Copie ce prompt dans Claude Code ou Lovable. Il définit le produit, le parcours et les critères pour savoir quand c’est prêt.</p></div><div className="ws-prompt-actions"><button className="ws-button-secondary" onClick={download} aria-label="Télécharger le prompt en Markdown"><ArrowDownToLine size={14} /> .md</button><button className="ws-button" onClick={copy}>{copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? "Copié !" : "Copier le prompt"}</button></div></div><div className="ws-panel"><div className="ws-prompt-meta"><span><FileText size={14} /> {first?.idea_snapshot.nom || "mon-projet"}.md</span><span>{countWords(content.build_prompt)} mots</span></div><pre className="ws-prompt-content" tabIndex={0} aria-label="Prompt de construction complet">{content.build_prompt}</pre></div><p className="ws-dossier-disclaimer"><Braces size={14} />Le prompt concerne la piste classée première. Commence par valider son problème avant de construire.</p><span role="status" className="sr-only">{copied ? "Le prompt est copié dans le presse-papiers." : ""}</span></section>
    <section id="panel-plan" role="tabpanel" aria-labelledby="tab-plan" hidden={tab !== "plan"}><div className="ws-section-intro"><div><h2>Un mois pour transformer l’idée en test réel.</h2><p>Coche tes avancées. {demo ? "Elles restent enregistrées dans ce navigateur." : "Ta progression est sauvegardée dans ton compte."}</p></div></div><div className="ws-plan-progress ws-panel"><strong>{progress}%</strong><div><p><span>Chaque petite étape compte.</span><span>{done} / {content.tasks.length} tâches</span></p><div className="ws-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={content.tasks.length} aria-valuenow={done} aria-label="Tâches terminées"><div className="ws-progress-fill" style={{ width: `${progress}%` }} /></div></div></div>{planWeeks.map(week => { const tasks = content.tasks.filter(task => task.semaine === week.semaine).sort((a, b) => a.position - b.position); return <details className="ws-week" key={week.semaine} open><summary><span className="ws-week-number">S0{week.semaine}</span><div><h3>{week.title}</h3><p>{week.description} · {tasks.filter(task => task.done).length}/{tasks.length}</p></div><ChevronDown size={17} /></summary><div className="ws-week-tasks">{tasks.map(task => <label className="ws-task" data-done={task.done} key={task.id}><input type="checkbox" checked={task.done} disabled={pending.includes(task.id)} onChange={() => void toggleTask(task)} /><span>{task.libelle}</span>{pending.includes(task.id) && <LoaderCircle size={12} className="ws-spinner" />}</label>)}</div></details>; })}</section>
    {!demo && <p className="ws-dossier-disclaimer" style={{ marginTop: 34 }}><Link href={`/remboursement?dossier=${id}`}>Consulter la garantie de remboursement de 14 jours</Link></p>}
  </Shell>;
}
