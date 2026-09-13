import { createBrowserClient } from "@supabase/ssr";

/** Client Supabase du navigateur, limité à la connexion : les données passent toujours par le serveur. */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? createBrowserClient(url, key) : null;
}
