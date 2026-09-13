import { NextResponse } from "next/server";
import { siteOrigin } from "@/lib/security/http";
import { safeNextPath } from "@/lib/security/next-path";
import { createSessionClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

/** Retour de Google : Supabase échange le code contre une session, puis le parcours reprend. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const suite = safeNextPath(url.searchParams.get("suite"));
  const origin = siteOrigin(request);
  const code = url.searchParams.get("code");
  if (code) {
    try {
      const supabase = await createSessionClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(suite, origin));
    } catch {}
  }
  return NextResponse.redirect(new URL(`/inscription?erreur=google&suite=${encodeURIComponent(suite)}`, origin));
}
