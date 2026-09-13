import "server-only";
import { randomBytes } from "node:crypto";
import { ApiError } from "./config";

export const createAccessToken = () => randomBytes(32).toString("base64url");

export function parseAccessToken(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new ApiError("Ce dossier est introuvable. Vérifiez votre lien personnel.", 404, "NOT_FOUND");
  return value;
}
