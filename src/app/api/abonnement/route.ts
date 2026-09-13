import { z } from "zod";
import { parseAccessToken } from "@/lib/security/access-token";
import { ApiError } from "@/lib/security/config";
import { databaseError, errorResponse, json, readJson } from "@/lib/security/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { findDossier, hasAccess } from "@/lib/supabase/dossiers";
import { getWhop, membershipSnapshot } from "@/lib/whop/client";
export const runtime = "nodejs";

/** Résiliation en fin de période : le dossier reste accessible jusqu’à la date déjà payée. */
export async function POST(request: Request) {
  try {
    const body = z.object({ token: z.string() }).strict().parse(await readJson(request));
    const admin = createAdminClient();
    const dossier = await findDossier(admin, parseAccessToken(body.token));
    if (!dossier.membership_id || !hasAccess(dossier)) throw new ApiError("Aucun abonnement actif pour ce dossier.", 409, "INVALID_STATE");
    if (!dossier.cancel_at_period_end) {
      const membership = await getWhop().memberships.cancel({ id: dossier.membership_id, cancel_at_period_end: true, reason: "Résiliation depuis le dossier" });
      const { error } = await admin.rpc("sync_membership", { p_dossier_id: dossier.id, p_membership: membershipSnapshot(membership) });
      databaseError(error);
    }
    return json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
