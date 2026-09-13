import { DossierScreen } from "@/components/workspace/dossier-screen";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <DossierScreen id={id} />; }
