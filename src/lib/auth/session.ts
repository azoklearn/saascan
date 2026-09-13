import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/security/config";

export async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new ApiError("Connecte-toi pour retrouver ton dossier.", 401, "UNAUTHENTICATED");
  return { user, supabase };
}
