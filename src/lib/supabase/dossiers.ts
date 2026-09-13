import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnswerValue, DossierContent, DossierRecord, DossierSummary } from "@/types/domain";
import { ApiError } from "@/lib/security/config";
import { databaseError } from "@/lib/security/http";

const summaryColumns = "id,statut,created_at,updated_at,paid_at,refunded_at";

export async function listDossiers(client: SupabaseClient): Promise<DossierSummary[]> {
  const { data, error } = await client.from("dossiers").select(`${summaryColumns},responses(count)`).order("created_at", { ascending: false }).limit(100);
  databaseError(error);
  return (data ?? []).map((row) => {
    const { responses, ...dossier } = row;
    return { ...dossier, response_count: responses?.[0]?.count ?? 0 } as DossierSummary;
  });
}

export async function getDossier(client: SupabaseClient, id: string): Promise<DossierRecord> {
  const { data: dossier, error } = await client.from("dossiers").select(summaryColumns).eq("id", id).maybeSingle();
  databaseError(error);
  if (!dossier) throw new ApiError("Ce dossier est introuvable.", 404, "NOT_FOUND");
  const { data: responses, error: responseError } = await client.from("responses").select("question_id,value").eq("dossier_id", id);
  databaseError(responseError);
  const answers: Record<string, AnswerValue> = {};
  for (const row of responses ?? []) answers[row.question_id] = row.value as AnswerValue;
  const record: DossierRecord = { dossier: { ...dossier, response_count: Object.keys(answers).length } as DossierSummary, answers };
  if (dossier.statut === "pret" && dossier.paid_at && !dossier.refunded_at) {
    const [selections, prompt, tasks] = await Promise.all([
      client.from("selections").select("id,idea_id,idea_snapshot,rang,justification,adaptation,canal_acquisition,risque,reponses_citees").eq("dossier_id", id).order("rang"),
      client.from("build_prompts").select("contenu_md").eq("dossier_id", id).maybeSingle(),
      client.from("plan_tasks").select("id,dossier_id,semaine,position,libelle,done").eq("dossier_id", id).order("semaine").order("position"),
    ]);
    databaseError(selections.error); databaseError(prompt.error); databaseError(tasks.error);
    // La RLS peut retirer l’accès entre la lecture du dossier et celle du contenu.
    if (selections.data?.length === 3 && prompt.data && tasks.data?.length) {
      record.content = { selections: selections.data, build_prompt: prompt.data.contenu_md, tasks: tasks.data } as DossierContent;
    }
  }
  return record;
}
