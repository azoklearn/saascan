import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { validateAnswer } from "@/lib/questionnaire/schemas";
import { ApiError } from "@/lib/security/config";
import { databaseError, errorResponse, json, readJson } from "@/lib/security/http";
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; z.string().uuid().parse(id);
    const body = z.object({ question_id: z.string().max(80), value: z.union([z.string().max(4000), z.number().finite(), z.array(z.string().max(300)).max(20)]) }).parse(await readJson(request));
    if (!validateAnswer(body.question_id, body.value)) throw new ApiError("Cette réponse ne correspond pas à la question.", 400, "INVALID_ANSWER");
    const { supabase } = await requireUser();
    const { error } = await supabase.rpc("save_response", { p_dossier_id: id, p_question_id: body.question_id, p_value: body.value });
    databaseError(error); return json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
