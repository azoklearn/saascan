// Aucun email n’est envoyé : le dernier dossier payé ouvert sur cet appareil reste accessible depuis le menu du site.
const storageKey = "saascan:mon-dossier";

export function rememberDossier(token: string) {
  try { window.localStorage.setItem(storageKey, token); } catch {}
}

export function rememberedDossier(): string | null {
  try {
    const token = window.localStorage.getItem(storageKey);
    return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
  } catch { return null; }
}
