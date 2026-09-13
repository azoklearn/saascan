import { parseAccessToken } from "@/lib/security/access-token";
import { ApiError } from "@/lib/security/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDossierRecord } from "@/lib/supabase/dossiers";
import { errorResponse } from "@/lib/security/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const token = parseAccessToken((await context.params).token);
    const record = await getDossierRecord(createAdminClient(), token);
    if (!record.content) throw new ApiError("Ce dossier n’est pas encore disponible.", 403, "NOT_READY");
    return new Response(record.content.build_prompt, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": "attachment; filename=\"saascan-prompt.md\"", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return errorResponse(error); }
}
