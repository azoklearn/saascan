import { z } from "zod";
import { publishDossier, publishExtras } from "@/lib/dossier/publish";
import { parseAccessToken } from "@/lib/security/access-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertContentAccess, findDossier } from "@/lib/supabase/dossiers";
import { errorResponse, json, readJson } from "@/lib/security/http";
export const runtime = "nodejs";
/** Relance la publication depuis la page du dossier si le webhook n’a pas pu la terminer. */
export async function POST(request: Request) {
  try {
    const body = z.object({ token: z.string(), part: z.enum(["dossier", "bonus"]).default("dossier") }).strict().parse(await readJson(request));
    const dossier = await findDossier(createAdminClient(), parseAccessToken(body.token));
    if (body.part === "bonus") { assertContentAccess(dossier); await publishExtras(dossier.id); }
    else if (dossier.statut !== "pret") await publishDossier(dossier.id);
    return json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
