import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DossierContent, DossierRecord, DossierState } from "@/types/domain";
import { ApiError } from "@/lib/security/config";
import { databaseError } from "@/lib/security/http";

export async function findDossier(admin: SupabaseClient, token: string): Promise<DossierState & { id: string }> {
  const { data, error } = await admin.from("dossiers").select("id,statut,paid_at,refunded_at,generation_attempts,generation_started_at").eq("access_token", token).maybeSingle();
  databaseError(error);
  if (!data) throw new ApiError("Ce dossier est introuvable. Vérifiez le lien reçu par email.", 404, "NOT_FOUND");
  return data as DossierState & { id: string };
}

export async function getDossierRecord(admin: SupabaseClient, token: string): Promise<DossierRecord> {
  const { id, ...dossier } = await findDossier(admin, token);
  const record: DossierRecord = { dossier };
  if (dossier.statut !== "pret" || !dossier.paid_at || dossier.refunded_at) return record;
  const [selections, prompt, tasks] = await Promise.all([
    admin.from("selections").select("id,idea_id,idea_snapshot,rang,justification,adaptation,canal_acquisition,risque,reponses_citees").eq("dossier_id", id).order("rang"),
    admin.from("build_prompts").select("contenu_md").eq("dossier_id", id).maybeSingle(),
    admin.from("plan_tasks").select("id,semaine,position,libelle,done").eq("dossier_id", id).order("semaine").order("position"),
  ]);
  databaseError(selections.error); databaseError(prompt.error); databaseError(tasks.error);
  if (selections.data?.length === 3 && prompt.data && tasks.data?.length) {
    record.content = { selections: selections.data, build_prompt: prompt.data.contenu_md, tasks: tasks.data } as DossierContent;
  }
  return record;
}
