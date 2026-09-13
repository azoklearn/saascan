import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./config";

export function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) return json({ error: error.message, code: error.code }, error.status);
  if (error instanceof ZodError) return json({ error: "Vérifie les informations envoyées.", code: "INVALID_INPUT" }, 400);
  console.error("[SaaScan] Erreur serveur", error instanceof Error ? error.message : "Erreur inconnue");
  return json({ error: "Une erreur est survenue. Réessaie dans un instant.", code: "SERVER_ERROR" }, 500);
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const allowed = new Set([new URL(request.url).origin]);
  if (process.env.NEXT_PUBLIC_APP_URL) allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
  if (!allowed.has(origin)) throw new ApiError("Cette requête provient d’une autre origine.", 403, "FORBIDDEN");
}

export async function readJson(request: Request) {
  assertSameOrigin(request);
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError("Un corps JSON est requis.", 415);
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > 32768) throw new ApiError("La réponse est trop longue.", 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 32768) throw new ApiError("La réponse est trop longue.", 413);
  try { return JSON.parse(raw) as unknown; } catch { throw new ApiError("Le JSON envoyé est invalide."); }
}

export function databaseError(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (error.code === "42501") throw new ApiError("Ce dossier est introuvable ou inaccessible.", 404, "NOT_FOUND");
  if (error.code === "55000") throw new ApiError(error.message, 409, "INVALID_STATE");
  if (error.code === "P0001") throw new ApiError(error.message, 429, "LIMIT_REACHED");
  throw new Error(error.message);
}
