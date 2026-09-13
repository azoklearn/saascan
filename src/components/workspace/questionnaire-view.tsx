"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type RefObject } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { formatEuros, questions, shortAnswer } from "@/lib/questionnaire/questions";
import { validateAnswer } from "@/lib/questionnaire/schemas";
import type { AnswerValue, Answers, Question } from "@/types/domain";
import { ScanError, ScanShell } from "./scan-shell";

const intros = [
  { title: "Savez-vous pourquoi de nombreux business ne sont pas rentables ?", text: "Ils ne partent pas d’une bonne idée.", action: "Continuer" },
  { title: "Dites-nous en plus sur vous.", text: "Vos réponses à ces questions vont déterminer l’idée rentable qui vous correspond pour votre business.", action: "Répondre au questionnaire" },
];

export function ScanIntro({ step, demo, onContinue }: { step: 0 | 1; demo: boolean; onContinue: () => void }) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (step === 1) title.current?.focus({ preventScroll: true }); }, [step]);
  const intro = intros[step];
  return <ScanShell stage="intro" demo={demo}>
    <div className="scan-intro" key={step}>
      <BrandLogo />
      <h1 ref={title} tabIndex={-1}>{intro.title}</h1>
      <p className={step === 0 ? "scan-intro-lead" : "scan-intro-description"}>{intro.text}</p>
      <button className="scan-button" onClick={onContinue}>{intro.action}<ArrowRight size={16} /></button>
    </div>
  </ScanShell>;
}

type Props = {
  question: Question; index: number; answers: Answers; value: AnswerValue | undefined; valid: boolean; error: string; demo: boolean;
  legendRef: RefObject<HTMLLegendElement | null>;
  onChoose: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPrevious: () => void;
  onJump: (index: number) => void;
};

export function QuestionnaireView({ question, index, answers, value, valid, error, demo, legendRef, onChoose, onSubmit, onPrevious, onJump }: Props) {
  const answered = questions.filter((entry) => validateAnswer(entry.id, answers[entry.id])).length;
  const pills = questions.flatMap((entry, position) => position !== index && validateAnswer(entry.id, answers[entry.id]) ? [{ position, label: shortAnswer(entry, answers[entry.id]) }] : []);
  const selected = Array.isArray(value) ? value : [];
  const describedBy = question.description ? "question-description" : undefined;
  return <ScanShell stage="question" demo={demo} aside={<p className="scan-counter" aria-live="polite">{answered} / {questions.length}</p>}>
    {pills.length > 0 && <nav className="scan-pills" aria-label="Vos réponses précédentes">{pills.map((pill) => <button type="button" key={pill.position} className="scan-pill" onClick={() => onJump(pill.position)} aria-label={`Modifier la réponse « ${pill.label} »`}>{pill.label}</button>)}</nav>}
    <form onSubmit={onSubmit}>
      <fieldset className="scan-question" key={question.id} data-type={question.type}>
        <legend ref={legendRef} tabIndex={-1}>{question.label}</legend>
        {question.description && <p className="scan-question-description" id="question-description">{question.description}</p>}
        {question.type === "multiple" && <p className="scan-selection-count" aria-live="polite">{selected.length} sur {question.maxChoices} sélectionné{selected.length > 1 ? "s" : ""}</p>}
        {question.type === "range"
          ? <RevenueRange question={question} value={typeof value === "string" ? value : question.defaultValue ?? question.options[0].value} describedBy={describedBy} onChange={onChoose} />
          : <div className="scan-options" data-columns={question.options.length > 6 ? 2 : 1}>
            {question.options.map((option) => {
              const multiple = question.type === "multiple";
              const checked = multiple ? selected.includes(option.value) : value === option.value;
              const disabled = multiple && !checked && selected.length >= (question.maxChoices ?? question.options.length);
              return <label className="scan-option" key={option.value} data-selected={checked} data-disabled={disabled} data-multiple={multiple}>
                <input type={multiple ? "checkbox" : "radio"} name={question.id} value={option.value} checked={checked} disabled={disabled} onChange={() => onChoose(option.value)} aria-describedby={describedBy} />
                <span className="scan-option-marker" aria-hidden="true">{checked && <Check size={13} strokeWidth={3} />}</span>
                <span className="scan-option-copy">{option.label}{option.detail && <small>{option.detail}</small>}</span>
              </label>;
            })}
          </div>}
      </fieldset>
      {error && <ScanError>{error}</ScanError>}
      <div className="scan-question-nav">
        <button type="button" className="scan-back" onClick={onPrevious}><ArrowLeft size={15} /> Précédent</button>
        <button type="submit" className="scan-button" disabled={!valid}>{index === questions.length - 1 ? "Lancer l’analyse" : "Continuer"}</button>
      </div>
    </form>
  </ScanShell>;
}

const revenueTiers = [
  { min: 30000, label: "Un SaaS à grande échelle" },
  { min: 10000, label: "Une vraie entreprise" },
  { min: 5000, label: "De quoi vivre de votre SaaS" },
  { min: 2000, label: "Un deuxième salaire" },
  { min: 1000, label: "Un complément de revenu" },
  { min: 0, label: "Un premier revenu en ligne" },
];
const digits = "0123456789".split("");
const groupedNumber = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const compactEuros = (amount: number) => amount >= 1000 ? `${amount / 1000} k€` : `${amount} €`;
type Intro = "hidden" | "rolling" | "done";

// Digits are keyed by place value so units keep their column when the amount gains a digit.
function RollingNumber({ value, intro }: { value: number; intro: Intro }) {
  const characters = [...groupedNumber.format(value)];
  return <span className="scan-roll" data-intro={intro}>{characters.map((character, index) => {
    const place = characters.length - index;
    if (!/\d/.test(character)) return <span key={`separator-${place}`} className="scan-roll-separator">{character}</span>;
    const shown = intro === "hidden" ? 9 : Number(character);
    return <span key={`digit-${place}`} className="scan-roll-digit">
      <span className="scan-roll-column" style={{ transform: `translateY(${shown * -10}%)`, transitionDelay: intro === "rolling" ? `${index * 70}ms` : undefined }}>{digits.map((digit) => <span key={digit}>{digit}</span>)}</span>
    </span>;
  })}</span>;
}

function RevenueRange({ question, value, describedBy, onChange }: { question: Question; value: string; describedBy?: string; onChange: (value: string) => void }) {
  const last = question.options.length - 1;
  const position = Math.max(0, question.options.findIndex((option) => option.value === value));
  const amount = Number(question.options[position].value);
  const tier = revenueTiers.find((entry) => amount >= entry.min)!;
  const [intro, setIntro] = useState<Intro>(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "done" : "hidden");
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (intro !== "hidden") return;
    // Two frames so the "9" starting position is painted before the digits roll.
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setIntro("rolling")); });
    const timer = window.setTimeout(() => setIntro("done"), 1500);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, []);
  useEffect(() => {
    if (!dragging) return;
    const release = () => setDragging(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => { window.removeEventListener("pointerup", release); window.removeEventListener("pointercancel", release); };
  }, [dragging]);

  const marks = [0, Math.round(last / 3), Math.round((last * 2) / 3), last];
  const tierText = tier.label.charAt(0).toLowerCase() + tier.label.slice(1);
  return <div className="scan-revenue" data-dragging={dragging} data-max={position === last} style={{ "--level": position / last } as CSSProperties}>
    <p className="scan-revenue-tier" aria-hidden="true"><span className="scan-revenue-beacon" /><span key={tier.label} className="scan-revenue-tier-label">{tier.label}</span></p>
    <p className="scan-revenue-amount" aria-hidden="true"><span className="scan-revenue-value"><RollingNumber value={amount} intro={intro} /><span className="scan-revenue-currency">€</span>{position === last && <span className="scan-revenue-plus">+</span>}</span></p>
    <p className="scan-revenue-period" aria-hidden="true">par mois · soit <strong>{formatEuros(amount * 12)}</strong> par an</p>
    <div className="scan-revenue-slider">
      <span className="scan-revenue-track" aria-hidden="true"><span className="scan-revenue-fill" /></span>
      <span className="scan-revenue-ticks" aria-hidden="true">{question.options.map((option, index) => <span key={option.value} data-on={index <= position} style={{ "--at": index / last } as CSSProperties} />)}</span>
      <input type="range" className="scan-revenue-input" min={0} max={last} step={1} value={position} onChange={(event) => onChange(question.options[Number(event.target.value)].value)} onPointerDown={() => setDragging(true)} aria-label={question.label} aria-valuetext={`${question.options[position].label}, ${tierText}`} aria-describedby={describedBy} />
      <span className="scan-revenue-rail" aria-hidden="true"><span className="scan-revenue-thumb" /></span>
    </div>
    <div className="scan-revenue-marks" aria-hidden="true">{marks.map((index) => <span key={index} data-on={index === position} style={{ "--at": index / last } as CSSProperties}>{compactEuros(Number(question.options[index].value))}{index === last ? "+" : ""}</span>)}</div>
  </div>;
}
