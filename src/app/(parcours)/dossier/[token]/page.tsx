import type { Metadata } from "next";
import { DossierScreen } from "@/components/workspace/dossier-screen";
import { findPlan } from "@/config/pricing";
import { buildDossierContent, buildExtras, demoAnswers, withVideoIds } from "@/lib/dossier/content";
import { ideaContent } from "@/lib/dossier/library";
// Le lien du dossier ne doit jamais partir dans l’en-tête Referer.
export const metadata: Metadata = { title: "Votre dossier", referrer: "no-referrer" };

/** Exemple fixe, formule 12 mois : les réponses du visiteur ne produisent jamais un dossier gratuit. */
function demoContent() {
  const content = buildDossierContent(demoAnswers, ideaContent);
  const extras = buildExtras(demoAnswers, content.selections[0].idea_id, { videos: findPlan("annuel")!.videoIdeas, roadmap: true }, ideaContent);
  return { ...content, videos: withVideoIds(extras.videos ?? [], "demo-video"), roadmap: extras.roadmap };
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <DossierScreen token={token} demoContent={token === "demo" ? demoContent() : undefined} />;
}
