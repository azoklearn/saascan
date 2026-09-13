import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireEnv } from "@/lib/security/config";

export async function createServerSupabaseClient() {
  const store = await cookies();
  return createServerClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Le middleware rafraîchit les cookies des Server Components. */ }
      },
    },
  });
}
export const createClient = createServerSupabaseClient;
