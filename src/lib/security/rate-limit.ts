import "server-only";
import { createHash } from "node:crypto";
import { ApiError } from "./config";

// Protection supplémentaire par instance. Supabase Auth applique également
// ses limites persistantes ; les quotas de génération sont en PostgreSQL.
const buckets = new Map<string, { count: number; until: number }>();
export function rateLimit(request: Request, scope: string, limit: number, durationMs: number) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = createHash("sha256").update(`${scope}:${address}`).digest("hex");
  const now = Date.now();
  if (buckets.size > 5000) for (const [id, bucket] of buckets) if (bucket.until <= now) buckets.delete(id);
  const bucket = buckets.get(key);
  if (bucket && bucket.until > now) {
    if (bucket.count >= limit) throw new ApiError("Trop de demandes. Réessaie dans quelques minutes.", 429, "RATE_LIMITED");
    bucket.count += 1;
  } else buckets.set(key, { count: 1, until: now + durationMs });
}
