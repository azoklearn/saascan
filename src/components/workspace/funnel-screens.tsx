"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { resetDemoDossier } from "@/lib/demo/storage";
import { questionnaireAnswers, readLocalAnswers, writeLocalAnswers } from "@/lib/questionnaire/local-answers";
import { questions } from "@/lib/questionnaire/questions";
import { isComplete, validateAnswer } from "@/lib/questionnaire/schemas";
import type { AnswerValue, Answers } from "@/types/domain";
import { QuestionnaireView, ScanIntro } from "./questionnaire-view";
import { ScanAnalysis, ScanOffer, ScanReady } from "./scan-result-views";
import { ScanShell } from "./scan-shell";
import { ApiError, api, demoHref, friendlyError, useDemoMode } from "./shared";

const firstIntro = -2;

export function QuestionnaireScreen() {
  const router = useRouter();
  const { demo, ready } = useDemoMode();
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState<number | null>(null);
  const [error, setError] = useState("");
  const legend = useRef<HTMLLegendElement>(null);

  useEffect(() => {
    const stored = questionnaireAnswers(readLocalAnswers());
    const missing = questions.findIndex((question) => !validateAnswer(question.id, stored[question.id]));
    setAnswers(stored);
    setStep(Object.keys(stored).length === 0 ? firstIntro : missing < 0 ? questions.length - 1 : missing);
  }, []);
  useEffect(() => { if (step !== null && step >= 0) requestAnimationFrame(() => legend.current?.focus({ preventScroll: true })); }, [step]);

  if (!ready || step === null) return <ScanShell stage="intro" demo={demo}><p className="scan-loading" role="status">Chargement…</p></ScanShell>;
  if (step < 0) return <ScanIntro demo={demo} step={step === firstIntro ? 0 : 1} onContinue={() => setStep(step + 1)} />;

  const question = questions[step];
  const value = answers[question.id] ?? question.defaultValue;
  const valid = validateAnswer(question.id, value);

  function save(next: Answers) { setAnswers(next); writeLocalAnswers(next); }
  function choose(option: string) {
    setError("");
    const current = answers[question.id];
    const next: AnswerValue = question.type !== "multiple" ? option
      : Array.isArray(current) && current.includes(option) ? current.filter((entry) => entry !== option)
        : [...(Array.isArray(current) ? current : []), option];
    const updated = { ...answers, [question.id]: next };
    if (!validateAnswer(question.id, next)) delete updated[question.id];
    save(updated);
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || value === undefined) return;
    const updated = { ...answers, [question.id]: value };
    save(updated);
    if (step < questions.length - 1) { setStep(step + 1); return; }
    if (isComplete(updated)) { router.push(demoHref("/analyse", demo)); return; }
    setStep(questions.findIndex((entry) => !validateAnswer(entry.id, updated[entry.id])));
    setError("Il reste une réponse à compléter avant de lancer l’analyse.");
  };
  return <QuestionnaireView question={question} index={step} answers={answers} value={value} valid={valid} error={error} demo={demo} legendRef={legend}
    onChoose={choose} onSubmit={submit} onPrevious={() => { setError(""); setStep(step - 1); }} onJump={(position) => { setError(""); setStep(position); }} />;
}

export function AnalysisScreen() {
  const router = useRouter();
  const { demo, ready } = useDemoMode();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!ready) return;
    if (!isComplete(questionnaireAnswers(readLocalAnswers()))) { router.replace(demoHref("/questionnaire", demo)); return; }
    const timers = [1400, 2900, 4400].map((delay, index) => window.setTimeout(() => setStep(index + 1), delay));
    timers.push(window.setTimeout(() => router.replace(demoHref("/debloquer", demo)), 5600));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [ready, demo, router]);
  return <ScanAnalysis demo={demo} step={step} />;
}

export function OfferScreen() {
  const router = useRouter();
  const { demo, ready } = useDemoMode();
  const [allowed, setAllowed] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notConfigured, setNotConfigured] = useState(false);
  useEffect(() => {
    if (!ready) return;
    if (!isComplete(questionnaireAnswers(readLocalAnswers()))) { router.replace(demoHref("/questionnaire", demo)); return; }
    setAllowed(true);
    if (new URLSearchParams(window.location.search).get("paiement") === "annule") {
      setShowOffer(true);
      setError("Le paiement a été annulé. Vous pouvez reprendre quand vous voulez.");
    }
  }, [ready, demo, router]);

  async function checkout() {
    setBusy(true); setError(""); setNotConfigured(false);
    if (demo) { resetDemoDossier(); router.push("/dossier/demo?demo=1"); return; }
    try {
      const { url } = await api<{ url: string }>("/api/checkout", { method: "POST", body: JSON.stringify({ answers: questionnaireAnswers(readLocalAnswers()) }) });
      const checkoutUrl = new URL(url);
      if (checkoutUrl.protocol !== "https:" || !(checkoutUrl.hostname === "checkout.stripe.com" || checkoutUrl.hostname.endsWith(".stripe.com"))) throw new Error("Le lien de paiement reçu n’est pas valide. Réessayez.");
      window.location.assign(checkoutUrl.href);
    } catch (cause) {
      setError(friendlyError(cause));
      setNotConfigured(cause instanceof ApiError && cause.code === "NOT_CONFIGURED");
      setBusy(false);
    }
  }

  if (!allowed) return <ScanShell stage="ready" demo={demo}><p className="scan-loading" role="status">Chargement…</p></ScanShell>;
  if (!showOffer) return <ScanReady demo={demo} onContinue={() => setShowOffer(true)} />;
  return <ScanOffer demo={demo} busy={busy} error={error} notConfigured={notConfigured} onCheckout={checkout} />;
}
