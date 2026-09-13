import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { ApiError } from "@/lib/security/config";
import { databaseError, errorResponse, json, readJson } from "@/lib/security/http";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; z.string().uuid().parse(id);
    const body = z.object({ done: z.boolean() }).strict().parse(await readJson(request));
    const { supabase } = await requireUser();
    const { data, error } = await supabase.from("plan_tasks").update({ done: body.done }).eq("id", id).select("id").maybeSingle();
    databaseError(error);
    if (!data) throw new ApiError("Cette tâche est inaccessible.", 404, "NOT_FOUND");
    return json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
