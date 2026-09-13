import { z } from "zod";
import { validateAnswers } from "@/lib/questionnaire/schemas";
import { createCheckout } from "@/lib/stripe/checkout";
import { rateLimit } from "@/lib/security/rate-limit";
import { errorResponse, json, readJson } from "@/lib/security/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    rateLimit(request, "checkout", 10, 10 * 60_000);
    const body = z.object({ answers: z.unknown() }).strict().parse(await readJson(request));
    return json({ url: await createCheckout(validateAnswers(body.answers)) });
  } catch (error) { return errorResponse(error); }
}
