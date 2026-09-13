"use client";

import { useEffect, useRef, type FormEvent, type RefObject } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCheck, LoaderCircle } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { blocks, questions } from "@/lib/questionnaire/questions";
import type { Answers, AnswerValue, Question } from "@/types/domain";
import { ScanError, ScanShell } from "./scan-shell";

export function ScanIntro({ step, demo, onContinue }: { step: 0 | 1; demo: boolean; onContinue: () => void }) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (step === 1) title.current?.focus({ preventScroll: true }); }, [step]);
  return <ScanShell stage="intro" demo={demo}>
    <div className="scan-intro" key={step}>
      <BrandLogo />
      <p className="scan-count">{step === 0 ? "BIENVENUE" : "L’IDÉE"}</p>
      <h1 ref={title} tabIndex={-1}>{step === 0 ? <>Bienvenue dans {""}<span>SaaScan.</span></> : <>Trouve les idées<br />qui cartonnent.</>}</h1>
      <p className={step === 0 ? "scan-intro-lead" : "scan-intro-description"}>{step === 0 ? "Une banque d’idées de SaaS sourcées, le prompt exact à coller dans Claude, et le plan des 30 premiers jours. Rien d’autre." : "On part de SaaS qui marchent déjà et on cherche ce que leurs clients leur reprochent. Cette faille devient ton angle."}</p>
      <button className="scan-button scan-button-glow" onClick={onContinue}>{step === 0 ? "Suivant" : "Répondre au questionnaire"}<ArrowRight size={15} /></button>
    </div>
  </ScanShell>;
}

type Props = {
  current: Question; index: number; answers: Answers; demo: boolean;
  valid: boolean; saving: boolean; continuing: boolean; saveStatus: string; error: string;
  legendRef: RefObject<HTMLLegendElement | null>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChoose: (value: string) => void;
  onText: (value: AnswerValue, isText?: boolean) => void;
  onPrevious: () => void;
  onJump: (index: number) => void;
};

export function QuestionnaireView({ current, index, answers, demo, valid, saving, continuing, saveStatus, error, legendRef, onSubmit, onChoose, onText, onPrevious }: Props) {
  const currentValue = answers[current.id];
  const multiple = current.type === "multiple";
  const scale = current.type === "scale";
  const progress = (index + 1) / questions.length * 100;
  const block = blocks.find((entry) => entry.id === current.block);

  return <ScanShell demo={demo} wide={multiple && (current.options?.length || 0) > 4}>
    <div className="scan-progress-row">
      <div className="scan-progress" role="progressbar" aria-label="Progression du questionnaire" aria-valuenow={index + 1} aria-valuemin={0} aria-valuemax={questions.length}><span style={{ width: `${progress}%` }} /></div>
    </div>
    <form onSubmit={onSubmit}>
      <button type="button" className="scan-back" disabled={index === 0 || continuing} onClick={onPrevious}><ArrowLeft size={14} /> Question précédente</button>
      <fieldset className="scan-question" key={current.id}>
        <p className="scan-count">{block?.label}</p>
        <legend ref={legendRef} tabIndex={-1}>{current.label}</legend>
        <p className="scan-question-description" id="question-description">{current.description}</p>
        {multiple && <p className="scan-selection-count" aria-live="polite">{Array.isArray(currentValue) ? currentValue.length : 0} choix sélectionné{Array.isArray(currentValue) && currentValue.length > 1 ? "s" : ""}</p>}
        {current.type === "text" ? <>
          <textarea className="scan-textarea" value={typeof currentValue === "string" ? currentValue : ""} onChange={event => onText(event.target.value, true)} placeholder={current.placeholder} aria-label={current.label} aria-describedby="question-description" maxLength={400} rows={5} />
          <p className="scan-selection-count">{typeof currentValue === "string" ? currentValue.length : 0} / 400 caractères</p>
        </> : <div className="scan-options" data-multiple={multiple} data-scale={scale}>
          {current.options?.map(option => {
            const selected = Array.isArray(currentValue) ? currentValue.includes(option.value) : String(currentValue) === option.value;
            return <label className="scan-option" key={option.value} data-selected={selected}>
              <input type={multiple ? "checkbox" : "radio"} name={current.id} value={option.value} checked={selected} onChange={() => onChoose(option.value)} aria-describedby="question-description" aria-label={scale ? `${option.value} — ${option.label}. ${option.detail || ""}` : undefined} />
              <span className="scan-option-marker" aria-hidden="true">{selected && <Check size={12} strokeWidth={2.5} />}</span>
              <span className="scan-option-copy">{scale ? option.value : option.label}{!scale && option.detail && <small>{option.detail}</small>}</span>
            </label>;
          })}
        </div>}
        {scale && <><div className="scan-scale-labels"><span>1 · Je débute</span><span>5 · Très à l’aise</span></div>{currentValue !== undefined && <p className="scan-scale-description">{current.options?.find(option => option.value === String(currentValue))?.label} — {current.options?.find(option => option.value === String(currentValue))?.detail}</p>}</>}
      </fieldset>
      {error && <ScanError>{error}</ScanError>}
      <div className="scan-question-nav">
        <button type="submit" className="scan-button" disabled={!valid || continuing}>{continuing && <LoaderCircle size={14} className="scan-spinner" />}{index === questions.length - 1 ? "Lancer mon analyse" : "Continuer"}</button>
      </div>
      <p className="scan-save-status" role="status">{saving ? <LoaderCircle size={12} className="scan-spinner" /> : <CheckCheck size={12} />}{saveStatus}</p>
    </form>
  </ScanShell>;
}
