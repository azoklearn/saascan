import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DossierContent, DossierRecord, DossierState, RoadmapPhase, VideoIdea } from "@/types/domain";
import { findPlan } from "@/config/pricing";
import { ApiError } from "@/lib/security/config";
import { databaseError } from "@/lib/security/http";
import { getWhop, membershipSnapshot } from "@/lib/whop/client";

export type DossierRow = DossierState & { id: string; membership_id: string | null; membership_synced_at: string | null };

const columns = "id,statut,paid_at,refunded_at,generation_attempts,generation_started_at,formule,membership_id,membership_status,cancel_at_period_end,current_period_end,membership_synced_at,extras_attempts,extras_started_at";
const validMembershipStates = ["active", "trialing", "past_due", "canceling"];
const membershipRefreshMs = 10 * 60_000;

/** Payé, non remboursé, et abonnement valide ou pas encore relu juste après le paiement. */
export function hasAccess(dossier: DossierState) {
  return !!dossier.paid_at && !dossier.refunded_at && (dossier.membership_status === null || validMembershipStates.includes(dossier.membership_status));
}

export async function findDossier(admin: SupabaseClient, token: string): Promise<DossierRow> {
  const { data, error } = await admin.from("dossiers").select(columns).eq("access_token", token).maybeSingle();
  databaseError(error);
  if (!data) throw new ApiError("Ce dossier est introuvable. Vérifiez le lien reçu par email.", 404, "NOT_FOUND");
  return data as unknown as DossierRow;
}

export function assertContentAccess(dossier: DossierRow) {
  if (dossier.statut !== "pret" || !hasAccess(dossier)) throw new ApiError("Ce dossier n’est pas accessible.", 403, "FORBIDDEN");
}

/** Relit l’abonnement chez Whop quand l’état connu est ancien, au cas où un webhook manquerait. */
async function refreshMembership(admin: SupabaseClient, token: string, row: DossierRow): Promise<DossierRow> {
  if (!row.membership_id || !row.paid_at || row.refunded_at) return row;
  const periodOver = !!row.current_period_end && Date.parse(row.current_period_end) < Date.now();
  const stale = Date.now() - Date.parse(row.membership_synced_at ?? "1970-01-01") > membershipRefreshMs;
  if (!stale && !(periodOver && validMembershipStates.includes(row.membership_status ?? ""))) return row;
  try {
    const membership = await getWhop().memberships.retrieve({ id: row.membership_id });
    const { error } = await admin.rpc("sync_membership", { p_dossier_id: row.id, p_membership: membershipSnapshot(membership) });
    databaseError(error);
    return await findDossier(admin, token);
  } catch {
    // Whop indisponible : le dernier état connu reste la référence.
    return row;
  }
}

export async function getDossierRecord(admin: SupabaseClient, token: string): Promise<DossierRecord> {
  const row = await refreshMembership(admin, token, await findDossier(admin, token));
  const { id, membership_id: _membership, membership_synced_at: _synced, ...dossier } = row;
  const record: DossierRecord = { dossier, access: hasAccess(dossier) };
  if (dossier.statut !== "pret" || !record.access) return record;
  const plan = findPlan(dossier.formule);
  const [selections, prompt, tasks, videos, roadmap] = await Promise.all([
    admin.from("selections").select("id,idea_id,idea_snapshot,rang,justification,adaptation,canal_acquisition,risque,reponses_citees").eq("dossier_id", id).order("rang"),
    admin.from("build_prompts").select("contenu_md").eq("dossier_id", id).maybeSingle(),
    admin.from("plan_tasks").select("id,semaine,position,libelle,done").eq("dossier_id", id).order("semaine").order("position"),
    // Après un passage de 12 à 3 mois, seules les idées de la formule actuelle restent visibles.
    plan?.videoIdeas ? admin.from("marketing_videos").select("id,lot,position,plateforme,format,accroche,deroule,appel_action").eq("dossier_id", id).lte("position", plan.videoIdeas).order("position") : null,
    plan?.roadmap ? admin.from("launch_roadmaps").select("phases").eq("dossier_id", id).maybeSingle() : null,
  ]);
  databaseError(selections.error); databaseError(prompt.error); databaseError(tasks.error);
  databaseError(videos?.error ?? null); databaseError(roadmap?.error ?? null);
  if (selections.data?.length !== 3 || !prompt.data || !tasks.data?.length) return record;
  const content: DossierContent = { selections: selections.data, build_prompt: prompt.data.contenu_md, tasks: tasks.data } as DossierContent;
  if (videos?.data?.length) content.videos = videos.data as VideoIdea[];
  if (roadmap?.data) content.roadmap = roadmap.data.phases as RoadmapPhase[];
  record.content = content;
  return record;
}
