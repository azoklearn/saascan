import type { Metadata } from "next";
import { DossierScreen } from "@/components/workspace/dossier-screen";
// Le lien du dossier ne doit jamais partir dans l’en-tête Referer.
export const metadata: Metadata = { title: "Votre dossier", referrer: "no-referrer" };
export default async function Page({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; return <DossierScreen token={token} />; }
