import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/security/config";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (tokenHash && (type === "email" || type === "magiclink" || type === "signup")) {
    try {
      const client = await createServerSupabaseClient();
      const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) return NextResponse.redirect(new URL(safeNext(url.searchParams.get("next")), url.origin));
    } catch { /* Le lien peut être expiré ou la configuration absente. */ }
  }
  return NextResponse.redirect(new URL("/connexion?error=lien-expire", url.origin));
}
