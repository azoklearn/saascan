import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { getDossier } from "@/lib/supabase/dossiers";
import { errorResponse, json } from "@/lib/security/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const { id } = await context.params; z.string().uuid().parse(id); const { supabase } = await requireUser(); return json(await getDossier(supabase, id)); }
  catch (error) { return errorResponse(error); }
}
