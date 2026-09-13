import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertSameOrigin, errorResponse } from "@/lib/security/http";
import { NextResponse } from "next/server";
export async function POST(request: Request) {
  try { assertSameOrigin(request); const client = await createServerSupabaseClient(); await client.auth.signOut(); return NextResponse.redirect(new URL("/connexion", request.url), 303); }
  catch (error) { return errorResponse(error); }
}
