// Crée le webhook Whop du site et enregistre son secret dans .env.local.
// Le secret n’est jamais affiché : Whop ne le renvoie qu’à la création.
// Usage : node scripts/whop-webhook.mjs https://saascan.vercel.app
import { readFileSync, writeFileSync } from "node:fs";
import { WhopClient } from "@whop/sdk";

// Même liste que whopWebhookEvents dans src/lib/whop/webhook.ts.
const events = [
  "payment.succeeded",
  "membership.activated", "membership.deactivated", "membership.cancel_at_period_end_changed",
  "refund.created", "refund.updated",
];

const envPath = ".env.local";
const site = new URL(process.argv[2] ?? "");
if (site.protocol !== "https:") throw new Error("Indiquez l’adresse HTTPS du site, par exemple https://saascan.vercel.app");
const url = new URL("/api/webhooks/whop", site.origin).href;
process.loadEnvFile(envPath);
const token = process.env.WHOP_API_KEY?.trim();
if (!token) throw new Error("Renseignez WHOP_API_KEY dans .env.local.");
const baseUrl = process.env.WHOP_API_URL?.trim();
const whop = new WhopClient({ token, ...(baseUrl ? { baseUrl } : {}) });

function saveSecret(secret) {
  const env = readFileSync(envPath, "utf8");
  const line = `WHOP_WEBHOOK_SECRET=${secret}`;
  writeFileSync(envPath, /^WHOP_WEBHOOK_SECRET=.*$/m.test(env) ? env.replace(/^WHOP_WEBHOOK_SECRET=.*$/m, line) : `${env.replace(/\n?$/, "\n")}${line}\n`);
}

try {
  const { id: accountId } = await whop.accounts.me();
  const existing = [];
  for await (const webhook of await whop.webhooks.list({ account_id: accountId, first: 100 })) if (webhook.url === url) existing.push(webhook);
  if (existing.length) {
    const [webhook] = existing;
    const missing = events.filter((event) => !webhook.events.includes(event));
    console.log(`Webhook déjà présent : ${webhook.id} · ${webhook.enabled ? "actif" : "désactivé"} · événements manquants : ${missing.length ? missing.join(", ") : "aucun"}`);
    if (!process.env.WHOP_WEBHOOK_SECRET?.trim()) {
      console.log(webhook.webhook_secret ? (saveSecret(webhook.webhook_secret), "Secret enregistré dans .env.local.") : "Son secret n’est plus lisible : supprimez ce webhook sur Whop puis relancez le script.");
    }
  } else {
    const webhook = await whop.webhooks.create({ url, events, enabled: true });
    if (!webhook.webhook_secret) throw new Error("Whop n’a pas renvoyé de secret pour ce webhook.");
    saveSecret(webhook.webhook_secret);
    console.log(`Webhook créé : ${webhook.id} · ${webhook.url} · ${webhook.events.length} événements · secret enregistré dans ${envPath}`);
  }
} catch (error) {
  // N’affiche que la réponse de l’API, jamais la requête et ses en-têtes.
  console.error("Whop a refusé l’opération :", error?.statusCode ?? "", error?.message ?? "", error?.body ? JSON.stringify(error.body) : "");
  process.exitCode = 1;
}
