import type { DossierContent } from "@/types/domain";
import { isComplete } from "@/lib/questionnaire/schemas";
import { questionnaireAnswers, readLocalAnswers } from "@/lib/questionnaire/local-answers";
import { generateDemoContent } from "./content";

const storageKey = "saascan:dossier-demo:v2";

export function saveDemoDossier(content: DossierContent) {
  try { window.localStorage.setItem(storageKey, JSON.stringify(content)); } catch {}
}

export function resetDemoDossier() {
  try { window.localStorage.removeItem(storageKey); } catch {}
}

export function loadDemoDossier(): DossierContent {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
    if (stored?.selections?.length === 3 && Array.isArray(stored.tasks)) return stored as DossierContent;
  } catch {}
  const answers = questionnaireAnswers(readLocalAnswers());
  const content = generateDemoContent(isComplete(answers) ? answers : undefined);
  saveDemoDossier(content);
  return content;
}
