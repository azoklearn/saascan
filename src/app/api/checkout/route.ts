import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createCheckout } from "@/lib/stripe/checkout";
import { errorResponse, json, readJson } from "@/lib/security/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try { const body = z.object({ dossier_id: z.string().uuid() }).parse(await readJson(request)); const { user } = await requireUser(); return json({ url: await createCheckout(body.dossier_id, user.id) }); }
  catch (error) { return errorResponse(error); }
}
