import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfilScreen } from "@/components/workspace/profil-screen";
import { createAdminClient } from "@/lib/supabase/admin";
import { listUserDossiers } from "@/lib/supabase/dossiers";
import { currentUser } from "@/lib/supabase/server";

// Les liens des dossiers ne doivent jamais partir dans l’en-tête Referer.
export const metadata: Metadata = { title: "Votre profil", referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/connexion?suite=/profil");
  const dossiers = await listUserDossiers(createAdminClient(), user.id);
  return <ProfilScreen email={user.email ?? ""} dossiers={dossiers} />;
}
