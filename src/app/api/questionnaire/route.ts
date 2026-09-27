import { z } from "zod";
import { validateAnswers } from "@/lib/questionnaire/schemas";
import { rateLimit } from "@/lib/security/rate-limit";
import { errorResponse, json, readJson } from "@/lib/security/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";
export const runtime = "nodejs";

// Enregistre le questionnaire terminé, avant tout paiement : l’offre l’appelle une fois affichée.
// Les réponses restent par ailleurs dans le navigateur jusqu’au passage en caisse.
export async function POST(request: Request) {
  try {
    rateLimit(request, "questionnaire", 30, 10 * 60_000);
    const body = z.object({ answers: z.unknown() }).strict().parse(await readJson(request));
    const answers = validateAnswers(body.answers);
    const user = await requireUser();
    const { error } = await createAdminClient().from("questionnaires")
      .upsert({ user_id: user.id, answers, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    // Tant que la migration 202609270001 n’est pas appliquée, le parcours continue sans enregistrement.
    if (error && error.code !== "42P01" && error.code !== "PGRST205") throw new Error(error.message);
    return json({ ok: true, enregistre: !error });
  } catch (error) { return errorResponse(error); }
}
