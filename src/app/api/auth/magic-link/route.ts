import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { appUrl, ApiError, safeNext } from "@/lib/security/config";
import { errorResponse, json, readJson } from "@/lib/security/http";
import { rateLimit } from "@/lib/security/rate-limit";
export async function POST(request: Request) {
  try {
    rateLimit(request, "magic-link", 5, 15 * 60_000);
    const body = z.object({ email: z.string().trim().email().max(254), next: z.string().max(500).optional() }).parse(await readJson(request));
    const client = await createServerSupabaseClient();
    const next = safeNext(body.next);
    const { error } = await client.auth.signInWithOtp({ email: body.email, options: { emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(next)}` } });
    if (error) {
      if (error.status === 429) throw new ApiError("Un lien vient déjà d’être demandé. Attends un instant avant de réessayer.", 429);
      throw new ApiError("Le lien n’a pas pu être envoyé. Vérifie la configuration email de Supabase et réessaie.", 502);
    }
    return json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
