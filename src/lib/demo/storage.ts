// Le dossier de démonstration est assemblé par le serveur ; seules les tâches cochées restent dans le navigateur.
const storageKey = "saascan:dossier-demo:v4";

export function loadDemoProgress(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    if (Array.isArray(stored)) return stored.filter((value): value is string => typeof value === "string");
  } catch {}
  return [];
}

export function saveDemoProgress(done: string[]) {
  try { window.localStorage.setItem(storageKey, JSON.stringify(done)); } catch {}
}

export function resetDemoDossier() {
  try { window.localStorage.removeItem(storageKey); } catch {}
}
