import { NextResponse } from "next/server";
import { assertSameOrigin, errorResponse, siteOrigin } from "@/lib/security/http";
import { createSessionClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await createSessionClient();
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/", siteOrigin(request)), 303);
  } catch (error) { return errorResponse(error); }
}
