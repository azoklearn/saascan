import type { Answers } from "@/types/domain";
import { questions } from "./questions";

const storageKey = "saascan:reponses:v2";
// Fallback when the browser blocks storage, so the funnel still works within the visit.
let memory: Answers = {};

export function readLocalAnswers(): Answers {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
    if (stored && typeof stored === "object" && !Array.isArray(stored)) return stored as Answers;
  } catch {}
  return memory;
}

export function writeLocalAnswers(answers: Answers) {
  memory = answers;
  try { window.localStorage.setItem(storageKey, JSON.stringify(answers)); } catch {}
}

export function clearLocalAnswers() {
  memory = {};
  try { window.localStorage.removeItem(storageKey); } catch {}
}

export function questionnaireAnswers(answers: Answers): Answers {
  return Object.fromEntries(questions.flatMap((question) => question.id in answers ? [[question.id, answers[question.id]]] : []));
}
