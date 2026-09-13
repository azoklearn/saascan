import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/security/config";
import { errorResponse, json } from "@/lib/security/http";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!supabaseConfigured()) return json({ user: null, configured: false });
  try {
    const client = await createServerSupabaseClient();
    const { data: { user } } = await client.auth.getUser();
    return json({ user: user ? { id: user.id, email: user.email ?? "" } : null, configured: true });
  } catch (error) { return errorResponse(error); }
}
