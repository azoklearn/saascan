import { z } from "zod";
import { runPaidGeneration } from "@/lib/generation/service";
import { parseAccessToken } from "@/lib/security/access-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { findDossier } from "@/lib/supabase/dossiers";
import { errorResponse, json, readJson } from "@/lib/security/http";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    const body = z.object({ token: z.string() }).strict().parse(await readJson(request));
    const dossier = await findDossier(createAdminClient(), parseAccessToken(body.token));
    if (dossier.statut !== "pret") await runPaidGeneration(dossier.id);
    return json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
