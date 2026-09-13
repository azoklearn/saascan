import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/security/next-path";

// Le questionnaire, l’offre et l’espace demandent un compte. La démonstration reste ouverte.
const accountPaths = ["/questionnaire", "/analyse", "/debloquer", "/espace"];
const authPaths = ["/inscription", "/connexion"];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const needsAccount = accountPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)) && searchParams.get("demo") !== "1";
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let signedIn = false;
  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    signedIn = !!data.user;
  }
  if (needsAccount && !signedIn) {
    const target = request.nextUrl.clone();
    target.pathname = "/inscription";
    target.search = `?suite=${encodeURIComponent(`${pathname}${request.nextUrl.search}`)}`;
    return NextResponse.redirect(target);
  }
  if (signedIn && authPaths.includes(pathname)) {
    return NextResponse.redirect(new URL(safeNextPath(searchParams.get("suite")), request.url));
  }
  return response;
}

export const config = {
  matcher: ["/questionnaire/:path*", "/analyse/:path*", "/debloquer/:path*", "/espace/:path*", "/inscription", "/connexion", "/dossier/:path*"],
};
