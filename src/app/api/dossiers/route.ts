import { requireUser } from "@/lib/auth/session";
import { listDossiers } from "@/lib/supabase/dossiers";
import { assertSameOrigin, databaseError, errorResponse, json } from "@/lib/security/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const { supabase } = await requireUser(); return json({ dossiers: await listDossiers(supabase) }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase.from("dossiers").insert({ user_id: user.id }).select("id").single();
    databaseError(error);
    return json({ id: data!.id }, 201);
  } catch (error) { return errorResponse(error); }
}
