import { z } from "zod";
import { parseAccessToken } from "@/lib/security/access-token";
import { ApiError } from "@/lib/security/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertContentAccess, findDossier } from "@/lib/supabase/dossiers";
import { databaseError, errorResponse, json, readJson } from "@/lib/security/http";
export async function PATCH(request: Request, context: { params: Promise<{ token: string; taskId: string }> }) {
  try {
    const params = await context.params;
    const token = parseAccessToken(params.token);
    const taskId = z.string().uuid().parse(params.taskId);
    const body = z.object({ done: z.boolean() }).strict().parse(await readJson(request));
    const admin = createAdminClient();
    const dossier = await findDossier(admin, token);
    assertContentAccess(dossier);
    const { data, error } = await admin.from("plan_tasks").update({ done: body.done }).eq("id", taskId).eq("dossier_id", dossier.id).select("id").maybeSingle();
    databaseError(error);
    if (!data) throw new ApiError("Cette tâche est introuvable.", 404, "NOT_FOUND");
    return json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
