import { redirect } from "next/navigation";

// L’espace est devenu la page profil : dossiers, abonnement et suivi des commerces contactés.
export default function Page() {
  redirect("/profil");
}
