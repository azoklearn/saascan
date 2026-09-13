import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { getDossier } from "@/lib/supabase/dossiers";
import { ApiError } from "@/lib/security/config";
import { errorResponse } from "@/lib/security/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; z.string().uuid().parse(id);
    const { supabase } = await requireUser(); const record = await getDossier(supabase, id);
    if (!record.content) throw new ApiError("Débloque ce dossier pour télécharger le prompt.", 403, "PAYMENT_REQUIRED");
    return new Response(record.content.build_prompt, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="saascan-prompt-${id}.md"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return errorResponse(error); }
}
