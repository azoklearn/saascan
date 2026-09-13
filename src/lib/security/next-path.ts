/** Chemin interne où revenir après la connexion ; tout autre valeur renvoie vers le questionnaire. */
export function safeNextPath(value: string | null | undefined, fallback = "/questionnaire") {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : fallback;
}
