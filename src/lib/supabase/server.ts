import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ApiError } from "@/lib/security/config";

/** Session du visiteur, lue depuis ses cookies. Les données restent lues avec la clé service_role. */
export async function createSessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new ApiError("Service non configuré : renseignez NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY dans les variables du serveur.", 503, "NOT_CONFIGURED");
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        // Un composant serveur ne peut pas écrire de cookie : le middleware rafraîchit alors la session.
        try { for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options); } catch {}
      },
    },
  });
}

export async function currentUser() {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new ApiError("Connectez-vous pour continuer.", 401, "UNAUTHENTICATED");
  return user;
}
