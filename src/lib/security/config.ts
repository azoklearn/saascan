import "server-only";

export class ApiError extends Error {
  constructor(message: string, public status = 400, public code?: string) { super(message); }
}

export function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ApiError(`Service non configuré : renseigne ${name} dans les variables du serveur.`, 503, "NOT_CONFIGURED");
  return value;
}

export function appUrl() {
  const value = requireEnv("NEXT_PUBLIC_APP_URL");
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol)) throw new ApiError("NEXT_PUBLIC_APP_URL doit être une URL HTTP ou HTTPS.", 503, "NOT_CONFIGURED");
  return url.origin;
}

export function safeNext(value: string | null | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !/[\r\n]/.test(value) ? value : "/app";
}
