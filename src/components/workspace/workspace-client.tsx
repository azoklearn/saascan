"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowRight, Braces, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Clipboard, Clock3, FileText, FolderOpen, LayoutGrid, ListChecks, LoaderCircle, LockKeyhole, Mail, Plus, ScanLine, ShieldCheck, Sparkles, Target, TriangleAlert, UserRound, X } from "lucide-react";
import { brand } from "@/config/brand";
import { planWeeks } from "@/config/plan-weeks";
import { questions, blocks } from "@/lib/questionnaire/questions";
import { validateAnswer } from "@/lib/questionnaire/schemas";
import { demoAnswers, generateDemoContent } from "@/lib/demo/content";
import type { Answers, AnswerValue, DossierContent, DossierRecord, DossierSummary, PlanTask, Selection } from "@/types/domain";
import "./workspace.css";
import { QuestionnaireView, ScanIntro } from "./questionnaire-view";
import { ScanAnalysis, ScanOffer, ScanReady } from "./scan-result-views";
import { ScanShell } from "./scan-shell";

type DemoRecord = DossierRecord & { demoOpened?: boolean };
type Session = { user: { id: string; email: string } | null; configured: boolean };
const demoStorageKey = "saascan:demo:v1";

class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store", credentials: "same-origin", headers: { ...(options?.body ? { "Content-Type": "application/json" } : {}), ...options?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error || "La demande n’a pas abouti. Réessaie dans un instant.", response.status, data.code);
  return data as T;
}

export function friendlyError(error: unknown) { return error instanceof Error ? error.message : "Une erreur est survenue. Réessaie dans un instant."; }
export function demoHref(path: string, demo: boolean) { return `${path}${demo ? "?demo=1" : ""}`; }
function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !/[\r\n]/.test(value) ? value : "/app";
}
function useMode() {
  const [mode, setMode] = useState({ demo: false, ready: false });
  useEffect(() => { setMode({ demo: new URLSearchParams(window.location.search).get("demo") === "1", ready: true }); }, []);
  return mode;
}
function readDemos(): Record<string, DemoRecord> {
  const value = window.localStorage.getItem(demoStorageKey);
  if (!value) return {};
  try { const data = JSON.parse(value); return typeof data === "object" && data && !Array.isArray(data) ? data : {}; } catch { return {}; }
}
export function storeDemo(record: DemoRecord) {
  const all = readDemos();
  all[record.dossier.id] = record;
  const entries = Object.entries(all).sort((a, b) => b[1].dossier.created_at.localeCompare(a[1].dossier.created_at)).slice(0, 12);
  try { window.localStorage.setItem(demoStorageKey, JSON.stringify(Object.fromEntries(entries))); }
  catch { throw new Error("Ton navigateur ne permet pas de sauvegarder la démo. Autorise le stockage local pour conserver tes réponses."); }
}
function createDemo(id?: string, example = false): DemoRecord {
  const now = new Date().toISOString();
  const record: DemoRecord = { dossier: { id: id || `demo-${Date.now()}`, statut: example ? "pret" : "brouillon", created_at: now, updated_at: now, paid_at: null, refunded_at: null, response_count: example ? questions.length : 0 }, answers: example ? { ...demoAnswers } : {}, ...(example ? { content: generateDemoContent(demoAnswers), demoOpened: true } : {}) };
  storeDemo(record);
  return record;
}
export function getDemo(id: string): DemoRecord {
  const record = readDemos()[id];
  if (record?.dossier && record?.answers) return record;
  if (id === "exemple") return createDemo(id, true);
  throw new Error("Cette démonstration n’est pas enregistrée dans ce navigateur. Tu peux en démarrer une depuis ton espace démo.");
}
export function useDossier(id: string) {
  const router = useRouter();
  const { demo, ready } = useMode();
  const [record, setRecord] = useState<DemoRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setError("");
    const load = async () => {
      try {
        const data = demo ? getDemo(id) : await api<DossierRecord>(`/api/dossiers/${encodeURIComponent(id)}`);
        if (!cancelled) setRecord(data);
      } catch (cause) {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 401) { router.replace(`/connexion?next=${encodeURIComponent(window.location.pathname)}`); return; }
        setError(friendlyError(cause));
      } finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [id, demo, ready, router, revision]);
  return { record, setRecord, demo, ready, loading, error, reload };
}
export function Spinner({ label = "Ouverture de ton espace…" }: { label?: string }) { return <div className="ws-loading" role="status"><LoaderCircle size={26} className="ws-spinner" /><span>{label}</span></div>; }
export function ErrorNotice({ children }: { children: ReactNode }) { return <div className="ws-error" role="alert">{children}</div>; }
function DemoBanner() { return <div className="ws-demo-banner"><ScanLine size={16} /><span><b>Mode démo.</b> Données enregistrées dans ce navigateur. Aucun paiement ni appel à l’IA.</span><Link href="/connexion">Créer mon vrai dossier <span aria-hidden>↗</span></Link></div>; }
export function Shell({ children, demo = false, crumb, className = "" }: { children: ReactNode; demo?: boolean; crumb?: string; className?: string }) {
  return <main className={`ws-shell ${className}`}>{demo && <DemoBanner />}{crumb && <nav className="ws-breadcrumb" aria-label="Fil d’Ariane"><Link href={demoHref("/app", demo)}>Mon espace</Link><ChevronRight size={12} /><span>{crumb}</span></nav>}{children}</main>;
}
export function ProblemScreen({ message, demo, retry }: { message: string; demo?: boolean; retry?: () => void }) { return <Shell demo={demo} crumb="Dossier"><div className="ws-empty ws-panel"><div className="ws-dossier-icon"><FolderOpen size={21} /></div><h1 className="ws-title">On reprend ?</h1><ErrorNotice>{message}</ErrorNotice>{retry && <button className="ws-button-secondary" onClick={retry}>Réessayer <ArrowRight size={15} /></button>}<p style={{ marginTop: 20 }}><Link className="ws-back" href={demoHref("/app", !!demo)}><ArrowLeft size={13} /> Revenir à mon espace</Link></p></div></Shell>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value)); }
function dossierPath(dossier: DossierSummary, demo: boolean, opened?: boolean) {
  const path = dossier.statut === "brouillon" ? "questionnaire" : dossier.statut === "generation" || dossier.statut === "echec" ? "generation" : dossier.paid_at || (demo && opened) ? "dossier" : "debloquer";
  return demoHref(`/${path}/${dossier.id}`, demo);
}
export function downloadMarkdown(contents: string, name: string) {
  const blob = new Blob([contents], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportDemo(record: DemoRecord) {
  const content = record.content;
  if (!content) return;
  const lines = [`# ${brand.name} — dossier de démonstration`, "", "Exemple local et illustratif. Aucun appel à l’IA ni paiement. Les idées ne garantissent aucun revenu.", "", ...content.selections.flatMap((selection) => [`## ${selection.rang}. ${selection.idea_snapshot.nom}`, "", selection.idea_snapshot.pitch, "", `**Pourquoi toi :** ${selection.justification}`, "", `**Adaptation :** ${selection.adaptation}`, "", `**Premier canal :** ${selection.canal_acquisition}`, "", `**Risque :** ${selection.risque}`, ""]), "## Prompt de construction", "", content.build_prompt, "", "## Plan de 30 jours", "", ...planWeeks.flatMap((week) => [`### Semaine ${week.semaine} — ${week.title}`, "", ...content.tasks.filter((task) => task.semaine === week.semaine).map((task) => `- [${task.done ? "x" : " "}] ${task.libelle}`), ""])];
  downloadMarkdown(lines.join("\n"), "saascan-dossier-demo.md");
}

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void api<Session>("/api/session").then((session) => {
      if (cancelled) return;
      setConfigured(session.configured);
      if (session.user) {
        const next = new URLSearchParams(window.location.search).get("next");
        router.replace(safeNextPath(next));
      }
    }).catch((cause) => { if (!cancelled) setError(friendlyError(cause)); });
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) setError("Ce lien de connexion a expiré ou a déjà été utilisé. Demande un nouveau lien ci-dessous.");
    return () => { cancelled = true; };
  }, [router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSending(true);
    try {
      const next = new URLSearchParams(window.location.search).get("next");
      await api("/api/auth/magic-link", { method: "POST", body: JSON.stringify({ email: email.trim(), next: safeNextPath(next) }) });
      setSent(true);
    } catch (cause) { setError(friendlyError(cause)); } finally { setSending(false); }
  }
  return <Shell><div className="ws-auth"><div><p className="ws-kicker">Ton prochain projet commence ici</p><h1 className="ws-title">Une idée, oui.<br /><em>Mais la tienne.</em></h1><p className="ws-subtitle">Commençons par ce que tu sais faire, le temps que tu as et ce que tu veux vraiment construire.</p><div className="ws-auth-visual"><div className="ws-auth-mark"><ScanLine size={28} strokeWidth={1.5} /></div><div><p>Ton profil. Tes trois pistes. Ton plan.</p><span>Tout au même endroit, quand tu veux.</span></div></div><div className="ws-auth-benefits"><span><Check size={12} /> Questionnaire gratuit</span><span><Check size={12} /> Aucune carte à cette étape</span></div></div><section className="ws-auth-card ws-panel" aria-label="Connexion par email">{sent ? <><div className="ws-success-icon"><Mail size={23} /></div><h2>Regarde ta boîte mail.</h2><p>Un lien de connexion vient d’être envoyé à <strong>{email}</strong>. Ouvre-le dans ce navigateur pour retrouver ton espace.</p><div className="ws-info">Tu ne vois rien ? Vérifie tes spams. Le lien est personnel et ne s’utilise qu’une fois.</div><button className="ws-button-quiet" style={{ marginTop: 18 }} onClick={() => setSent(false)}><ArrowLeft size={14} /> Utiliser une autre adresse</button></> : <><h2>Entre dans ton espace.</h2><p>Un lien par email, aucun mot de passe.<br />Ton dossier reste lié à ton compte.</p>{configured === false && <div className="ws-info" style={{ marginBottom: 23 }}>La connexion n’est pas encore configurée sur cette installation. Tu peux déjà explorer le parcours de démonstration.</div>}<form onSubmit={submit}><label className="ws-field-label" htmlFor="email">Ton adresse email</label><input className="ws-input" id="email" type="email" autoComplete="email" placeholder="toi@exemple.fr" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} disabled={sending || configured === false} /><button className="ws-button" disabled={sending || configured === false || !email.trim()}>{sending ? <><LoaderCircle size={15} className="ws-spinner" /> Envoi du lien…</> : <>Recevoir mon lien de connexion <ArrowRight size={15} /></>}</button></form>{error && <ErrorNotice>{error}</ErrorNotice>}<p className="ws-auth-privacy">En continuant, tu acceptes les <Link href="/cgv">CGV</Link> et la <Link href="/confidentialite">politique de confidentialité</Link>.</p><div className="ws-auth-divider">Tu veux d’abord jeter un œil ?</div><Link className="ws-button-secondary" href="/app?demo=1"><ScanLine size={15} /> Explorer la démo <ArrowRight size={14} /></Link><p className="ws-auth-note">Sans compte. Exemple local, aucune génération IA.</p></>}</section></div></Shell>;
}

export function DashboardScreen() {
  const router = useRouter();
  const { demo, ready } = useMode();
  const [session, setSession] = useState<Session | null>(null);
  const [dossiers, setDossiers] = useState<DossierSummary[]>([]);
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const load = async () => {
      try {
        if (demo) {
          const records = Object.values(readDemos());
          if (!cancelled) { setDossiers(records.map((record) => record.dossier).sort((a, b) => b.created_at.localeCompare(a.created_at))); setOpened(Object.fromEntries(records.map((record) => [record.dossier.id, !!record.demoOpened]))); }
        } else {
          const result = await api<Session>("/api/session");
          if (!result.user) { router.replace("/connexion"); return; }
          const data = await api<{ dossiers: DossierSummary[] }>("/api/dossiers");
          if (!cancelled) { setSession(result); setDossiers(data.dossiers); }
        }
      } catch (cause) { if (!cancelled) setError(friendlyError(cause)); } finally { if (!cancelled) setLoading(false); }
    }; void load(); return () => { cancelled = true; };
  }, [demo, ready, router]);
  async function create() {
    setCreating(true); setError("");
    try {
      const id = demo ? createDemo().dossier.id : (await api<{ id: string }>("/api/dossiers", { method: "POST" })).id;
      router.push(demoHref(`/questionnaire/${id}`, demo));
    } catch (cause) { setError(friendlyError(cause)); setCreating(false); }
  }
  if (loading) return <Shell><Spinner /></Shell>;
  return <Shell demo={demo}><div className="ws-account"><UserRound size={13} /><span>{demo ? "Ton espace de démonstration" : session?.user?.email}</span>{!demo && <form action="/auth/deconnexion" method="post"><button className="ws-button-quiet" type="submit">Se déconnecter <ArrowRight size={12} /></button></form>}</div><div className="ws-page-head"><div><p className="ws-kicker" style={{ marginTop: 33 }}>L’idée, c’est de passer à l’action</p><h1 className="ws-title">Ton prochain chapitre.</h1><p className="ws-subtitle">Tes idées au même endroit. Et toujours une prochaine étape.</p></div><button className="ws-button" onClick={create} disabled={creating}>{creating ? <LoaderCircle size={15} className="ws-spinner" /> : <Plus size={16} />} Nouveau scan</button></div>{error && <ErrorNotice>{error}</ErrorNotice>}<div className="ws-dashboard-summary ws-panel"><div><strong>{String(dossiers.length).padStart(2, "0")}</strong> dossier{dossiers.length !== 1 ? "s" : ""}</div><div><strong>{String(dossiers.filter((dossier) => dossier.statut === "brouillon").length).padStart(2, "0")}</strong> en cours</div><p>{demo ? "Ta progression reste dans ce navigateur." : "Sauvegardé automatiquement dans ton compte."}</p></div><div className="ws-list-title">Mes dossiers <span>Du plus récent au plus ancien</span></div>{dossiers.length ? <div className="ws-dossier-list">{dossiers.map((dossier, index) => <Link key={dossier.id} href={dossierPath(dossier, demo, opened[dossier.id])} className="ws-dossier-card"><div className="ws-dossier-icon"><FileText size={21} strokeWidth={1.6} /></div><div><h3>{dossier.id === "exemple" ? "Le dossier d’exemple" : `Mon scan ${String(dossiers.length - index).padStart(2, "0")}`}</h3><p>{formatDate(dossier.created_at)} · {dossier.statut === "brouillon" ? `${dossier.response_count}/20 réponses` : "20 réponses · 3 pistes"}</p></div><span className="ws-status">{dossier.refunded_at ? "Remboursé" : dossier.statut === "brouillon" ? "À poursuivre" : dossier.statut === "echec" ? "À relancer" : dossier.statut === "generation" ? "En analyse" : dossier.paid_at || opened[dossier.id] ? "À explorer" : "Prêt à ouvrir"}</span><ArrowRight size={17} /></Link>)}</div> : <div className="ws-empty ws-panel"><div className="ws-dossier-icon"><ScanLine size={23} /></div><h2>Une page blanche, pour l’instant.</h2><p>20 questions pour trouver des pistes adaptées à ta situation. Tu peux t’arrêter et reprendre quand tu veux.</p><button className="ws-button" onClick={create} disabled={creating}>Commencer mon premier scan <ArrowRight size={15} /></button>{demo && <p style={{ marginTop: 19, marginBottom: 0 }}><Link className="ws-back" href="/dossier/exemple?demo=1">Ou explorer un dossier d’exemple <ArrowRight size={13} /></Link></p>}</div>}<p className="ws-dashboard-footnote"><ShieldCheck size={13} /> {demo ? "Cette démo ne crée aucun compte et ne débite rien." : "Tes réponses et tes dossiers sont privés."}</p></Shell>;
}

export function QuestionnaireScreen({ id }: { id: string }) {
  const router = useRouter();
  const { record, setRecord, demo, loading, error: loadError, reload } = useDossier(id);
  const [answers, setAnswers] = useState<Answers>({});
  const [intro, setIntro] = useState<0 | 1 | 2>(0);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Tes réponses sont sauvegardées automatiquement");
  const [error, setError] = useState("");
  const [continuing, setContinuing] = useState(false);
  const initialized = useRef("");
  const queue = useRef<Promise<void>>(Promise.resolve());
  const saveNumber = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const legend = useRef<HTMLLegendElement>(null);
  const current = questions[index];
  const currentValue = answers[current.id];
  const valid = validateAnswer(current.id, currentValue);
  useEffect(() => {
    if (!record || record.dossier.id !== id || initialized.current === id) return;
    initialized.current = id;
    setAnswers(record.answers);
    let introComplete = Object.keys(record.answers).length > 0;
    try { introComplete ||= window.sessionStorage.getItem(`saascan:intro:${id}`) === "complete"; } catch {}
    setIntro(introComplete ? 2 : 0);
    const unfinished = questions.findIndex((question) => !validateAnswer(question.id, record.answers[question.id]));
    setIndex(unfinished < 0 ? questions.length - 1 : unfinished);
    if (record.dossier.statut === "generation" || record.dossier.statut === "pret") router.replace(dossierPath(record.dossier, demo, record.demoOpened));
  }, [record, id, demo, router]);
  useEffect(() => () => { if (debounce.current) clearTimeout(debounce.current); }, []);
  function persist(questionId: string, value: AnswerValue): Promise<void> {
    const sequence = ++saveNumber.current;
    setSaving(true); setError(""); setSaveStatus("Sauvegarde en cours…");
    const next = queue.current.catch(() => undefined).then(async () => {
      if (demo) {
        const stored = getDemo(id);
        stored.answers = { ...stored.answers, [questionId]: value };
        stored.dossier = { ...stored.dossier, response_count: questions.filter((question) => validateAnswer(question.id, stored.answers[question.id])).length, updated_at: new Date().toISOString(), statut: "brouillon" };
        storeDemo(stored); setRecord(stored);
      } else {
        await api(`/api/dossiers/${encodeURIComponent(id)}/responses`, { method: "PUT", body: JSON.stringify({ question_id: questionId, value }) });
      }
    });
    queue.current = next;
    void next.then(() => { if (saveNumber.current === sequence) { setSaving(false); setSaveStatus(demo ? "Enregistré dans ce navigateur" : "Réponse enregistrée"); } }, (cause) => { if (saveNumber.current === sequence) { setSaving(false); setSaveStatus("Réponse non enregistrée"); setError(friendlyError(cause)); } });
    return next;
  }
  function change(value: AnswerValue, isText = false) {
    setAnswers((previous) => ({ ...previous, [current.id]: value }));
    setError("");
    if (debounce.current) clearTimeout(debounce.current);
    if (!validateAnswer(current.id, value)) { setSaveStatus("Complète ta réponse pour l’enregistrer"); return; }
    if (isText) { setSaveStatus("Modifications en cours…"); debounce.current = setTimeout(() => { void persist(current.id, value).catch(() => undefined); }, 650); }
    else void persist(current.id, value).catch(() => undefined);
  }
  function choose(value: string) {
    if (current.type === "multiple") {
      const selected = Array.isArray(currentValue) ? currentValue : [];
      let values = selected.includes(value) ? selected.filter((entry) => entry !== value) : [...selected, value];
      if (current.id === "taches_detestees") values = value === "aucune" && !selected.includes(value) ? ["aucune"] : values.filter((entry) => entry !== "aucune");
      change(values);
    } else change(current.type === "scale" ? Number(value) : value);
  }
  async function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || continuing) return;
    if (debounce.current) clearTimeout(debounce.current);
    setContinuing(true);
    try {
      await persist(current.id, currentValue);
      if (index === questions.length - 1) {
        const missing = questions.findIndex((question) => !validateAnswer(question.id, answers[question.id]));
        if (missing >= 0) { setIndex(missing); setError("Il reste une réponse à compléter avant de lancer l’analyse."); }
        else { router.push(demoHref(`/generation/${id}`, demo)); return; }
      } else setIndex((value) => value + 1);
      requestAnimationFrame(() => legend.current?.focus());
    } catch (cause) { setError(friendlyError(cause)); } finally { setContinuing(false); }
  }
  if (loading || (!record && !loadError)) return <ScanShell stage="intro"><Spinner label="On retrouve tes réponses…" /></ScanShell>;
  if (loadError || !record) return <ProblemScreen message={loadError || "Ce questionnaire est introuvable."} demo={demo} retry={reload} />;
  if (intro < 2) return <ScanIntro demo={demo} step={intro as 0 | 1} onContinue={() => {
    if (intro === 0) setIntro(1);
    else {
      setIntro(2);
      try { window.sessionStorage.setItem(`saascan:intro:${id}`, "complete"); } catch {}
      requestAnimationFrame(() => legend.current?.focus());
    }
  }} />;
  function jump(position: number) {
    if (continuing) return;
    if (debounce.current) clearTimeout(debounce.current);
    if (valid) void persist(current.id, currentValue).catch(() => undefined);
    setIndex(position);
    requestAnimationFrame(() => legend.current?.focus());
  }
  return <QuestionnaireView current={current} index={index} answers={answers} demo={demo} valid={valid} saving={saving} continuing={continuing} saveStatus={saveStatus} error={error} legendRef={legend} onSubmit={next} onChoose={choose} onText={change} onPrevious={() => jump(Math.max(0, index - 1))} onJump={jump} />;
}

export function GenerationScreen({ id }: { id: string }) {
  const router = useRouter();
  const { record, setRecord, demo, loading, error: loadError, reload } = useDossier(id);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const request = useRef<{ key: string; promise: Promise<DemoRecord | void> } | null>(null);
  const complete = record && questions.every((question) => validateAnswer(question.id, record.answers[question.id]));
  useEffect(() => {
    if (!record || !complete) return;
    if (record.dossier.statut === "pret") { router.replace(demoHref(`/debloquer/${id}`, demo)); return; }
    if (record.dossier.statut === "echec" && attempt === 0) { setError("L’analyse précédente n’a pas pu se terminer. Tu peux la relancer ou ajuster tes réponses."); return; }
    const controller = new AbortController();
    const { signal } = controller;
    setRunning(true); setError("");
    const readLatest = () => api<DossierRecord>(`/api/dossiers/${encodeURIComponent(id)}`, { signal });
    const pause = () => new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException("Analyse quittée", "AbortError")); };
      const timer = window.setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 2000);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    });
    const run = async (): Promise<DemoRecord> => {
      let latest = record;
      // Une reprise observe la tentative existante. Un POST n'est effectué
      // qu'au premier lancement ou après une relance explicite.
      if (demo || record.dossier.statut !== "generation" || attempt > 0) {
        const key = `${id}:${demo}:${attempt}`;
        if (request.current?.key !== key) {
          request.current = { key, promise: (async () => {
            if (demo) {
              await new Promise((resolve) => window.setTimeout(resolve, 4300));
              const stored = getDemo(id);
              stored.content = generateDemoContent(stored.answers);
              stored.dossier = { ...stored.dossier, statut: "pret", updated_at: new Date().toISOString() };
              storeDemo(stored);
              return stored;
            }
            await api("/api/generate", { method: "POST", body: JSON.stringify({ dossier_id: id }) });
          })() };
        }
        try {
          const result = await request.current.promise;
          if (signal.aborted) throw new DOMException("Analyse quittée", "AbortError");
          if (demo && result) return result;
          latest = await readLatest();
        } catch (cause) {
          if (signal.aborted || !(cause instanceof ApiError) || cause.status !== 409) throw cause;
          latest = await readLatest();
          if (latest.dossier.statut !== "generation" && latest.dossier.statut !== "pret") throw cause;
        }
      }
      // Le serveur autorise une nouvelle tentative après quatre minutes.
      // updated_at est modifié lorsque la génération réserve le dossier.
      const startedAt = Date.parse(latest.dossier.updated_at);
      const deadline = Number.isFinite(startedAt) ? Math.min(Date.now() + 245000, startedAt + 245000) : Date.now() + 245000;
      while (latest.dossier.statut === "generation") {
        if (Date.now() >= deadline) throw new Error("L’analyse ne s’est pas terminée dans le délai prévu. Tu peux maintenant relancer une tentative.");
        await pause();
        latest = await readLatest();
      }
      if (latest.dossier.statut !== "pret") throw new Error("L’analyse n’a pas pu se terminer. Relance-la ou ajuste tes réponses avant de réessayer.");
      return latest;
    };
    void run().then((result) => {
      if (signal.aborted) return;
      setStep(3); setRunning(false); setRecord(result);
      router.replace(demoHref(`/debloquer/${id}`, demo));
    }, (cause) => { if (!signal.aborted) { setRunning(false); setError(friendlyError(cause)); } });
    return () => { controller.abort(); };
  }, [record, complete, id, demo, router, attempt, setRecord]);
  useEffect(() => {
    if (!running) return;
    setStep(0);
    const first = window.setTimeout(() => setStep(1), 1200);
    const second = window.setTimeout(() => setStep(2), demo ? 2800 : 12000);
    return () => { clearTimeout(first); clearTimeout(second); };
  }, [running, demo]);
  if (loading) return <ScanShell stage="analysis" demo={demo}><Spinner label="Préparation de ton analyse…" /></ScanShell>;
  if (loadError || !record) return <ProblemScreen message={loadError || "Ce dossier est introuvable."} demo={demo} retry={reload} />;
  return <ScanAnalysis demo={demo} step={step} running={running} complete={!!complete} error={error} questionnaireHref={demoHref(`/questionnaire/${id}`, demo)} onRetry={() => { request.current = null; setAttempt(value => value + 1); }} />;
}

export function PaywallScreen({ id }: { id: string }) {
  const router = useRouter();
  const { record, setRecord, demo, loading, error: loadError, reload } = useDossier(id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  useEffect(() => { if (new URLSearchParams(window.location.search).has("payment")) setShowOffer(true); }, []);
  useEffect(() => {
    if (!record) return;
    if (record.dossier.refunded_at) return;
    if (record.dossier.paid_at && !demo) { router.replace(`/dossier/${id}`); return; }
    if (record.dossier.statut !== "pret") { router.replace(dossierPath(record.dossier, demo, record.demoOpened)); return; }
    if (demo || new URLSearchParams(window.location.search).get("payment") !== "success") return;
    setConfirming(true);
    let cancelled = false;
    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      void api<DossierRecord>(`/api/dossiers/${encodeURIComponent(id)}`).then((data) => {
        if (cancelled) return;
        if (data.dossier.paid_at && !data.dossier.refunded_at) { clearInterval(timer); setRecord(data); router.replace(`/dossier/${id}`); }
      }).catch((cause) => { if (!cancelled) { setError(friendlyError(cause)); clearInterval(timer); setConfirming(false); } });
      if (count >= 45) { clearInterval(timer); setConfirming(false); setError("La confirmation du paiement prend plus de temps que prévu. Ton dossier s’ouvrira dès réception de la confirmation Stripe. Reviens dans ton espace dans un instant."); }
    }, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [record, id, demo, router, setRecord]);
  async function checkout() {
    setBusy(true); setError("");
    try {
      if (demo) {
        const stored = getDemo(id); stored.demoOpened = true; storeDemo(stored);
        router.push(demoHref(`/dossier/${id}`, true));
      } else {
        const result = await api<{ url: string }>("/api/checkout", { method: "POST", body: JSON.stringify({ dossier_id: id }) });
        const checkoutUrl = new URL(result.url);
        if (checkoutUrl.protocol !== "https:" || !(checkoutUrl.hostname === "checkout.stripe.com" || checkoutUrl.hostname.endsWith(".stripe.com"))) throw new Error("Le lien de paiement reçu n’est pas valide. Réessaie depuis ton espace.");
        window.location.assign(checkoutUrl.href);
      }
    } catch (cause) { setError(friendlyError(cause)); setBusy(false); }
  }
  if (loading) return <ScanShell stage="ready" demo={demo}><Spinner label="Ouverture de ton aperçu…" /></ScanShell>;
  if (loadError || !record) return <ProblemScreen message={loadError || "Ce dossier est introuvable."} demo={demo} retry={reload} />;
  if (record.dossier.refunded_at) return <ProblemScreen message="Ce dossier a été remboursé. Son contenu n’est plus accessible." demo={demo} />;
  if (!showOffer) return <ScanReady demo={demo} onContinue={() => setShowOffer(true)} />;
  return <ScanOffer demo={demo} busy={busy} confirming={confirming} error={error} onCheckout={checkout} />;
}
