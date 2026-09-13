import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/security/config";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  if (code) {
    try {
      const client = await createServerSupabaseClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, url.origin));
    } catch { /* Redirection vers un message public, sans secret. */ }
  }
  return NextResponse.redirect(new URL("/connexion?error=lien-expire", url.origin));
}
