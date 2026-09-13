import { QuestionnaireScreen } from "@/components/workspace/workspace-client";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <QuestionnaireScreen id={id} />; }
