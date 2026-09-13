import { timingSafeEqual } from "node:crypto";
import { retryEmails } from "@/lib/email/service";
import { ApiError, requireEnv } from "@/lib/security/config";
import { errorResponse, json } from "@/lib/security/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
async function run(request: Request) {
  try {
    const expected = Buffer.from(`Bearer ${requireEnv("CRON_SECRET")}`);
    const received = Buffer.from(request.headers.get("authorization") ?? "");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new ApiError("Accès interdit.", 401);
    return json(await retryEmails());
  } catch (error) { return errorResponse(error); }
}
export const GET = run;
export const POST = run;
