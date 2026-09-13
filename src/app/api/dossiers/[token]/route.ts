import { parseAccessToken } from "@/lib/security/access-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDossierRecord } from "@/lib/supabase/dossiers";
import { errorResponse, json } from "@/lib/security/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const token = parseAccessToken((await context.params).token);
    return json(await getDossierRecord(createAdminClient(), token));
  } catch (error) { return errorResponse(error); }
}
