import "server-only";

export class ApiError extends Error {
  constructor(message: string, public status = 400, public code?: string) { super(message); }
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ApiError(`Service non configuré : renseignez ${name} dans les variables du serveur.`, 503, "NOT_CONFIGURED");
  return value;
}

export function appUrl() {
  const value = requireEnv("NEXT_PUBLIC_APP_URL");
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol)) throw new ApiError("NEXT_PUBLIC_APP_URL doit être une URL HTTP ou HTTPS.", 503, "NOT_CONFIGURED");
  return url.origin;
}
