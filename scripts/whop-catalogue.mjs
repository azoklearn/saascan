// Crée ou retrouve le produit SaaScan et ses trois formules d’abonnement sur Whop,
// puis enregistre leurs identifiants dans .env.local. La clé API n’est jamais affichée.
// Usage : node scripts/whop-catalogue.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { WhopClient } from "@whop/sdk";
import plans from "../src/config/plans.json" with { type: "json" };

const envPath = ".env.local";
process.loadEnvFile(envPath);
const token = process.env.WHOP_API_KEY?.trim();
if (!token) throw new Error("Renseignez WHOP_API_KEY dans .env.local.");
const baseUrl = process.env.WHOP_API_URL?.trim();
const whop = new WhopClient({ token, ...(baseUrl ? { baseUrl } : {}) });

async function collect(page) {
  const items = [];
  for await (const item of page) items.push(item);
  return items;
}

try {
  const { id: accountId } = await whop.accounts.me();
  const products = await collect(await whop.products.list({ account_id: accountId, first: 100 }));
  const product = products.find((item) => item.metadata?.saascan === "abonnement") ?? await whop.products.create({
    account_id: accountId,
    title: "SaaScan",
    headline: "Votre idée de SaaS, le prompt et le plan pour la lancer.",
    description: "Trois idées de SaaS choisies pour votre profil, un prompt de construction et un plan d’action, consultables tant que l’abonnement est actif.",
    visibility: "hidden",
    send_welcome_message: false,
    metadata: { saascan: "abonnement" },
  });

  const ids = { WHOP_PRODUCT_ID: product.id };
  const existing = await collect(await whop.plans.list({ account_id: accountId, product_ids: product.id, first: 100 }));
  for (const plan of plans) {
    const name = `WHOP_PLAN_${plan.id.toUpperCase()}`;
    const price = plan.cents / 100;
    const found = existing.find((item) => item.metadata?.saascan_formule === plan.id);
    if (found && (found.renewal_price !== price || found.initial_price !== 0 || found.billing_period !== plan.periodDays || found.currency !== "eur")) {
      throw new Error(`La formule ${plan.id} existe déjà sur Whop avec un autre prix ou une autre période.`);
    }
    const saved = found ?? await whop.plans.create({
      account_id: accountId,
      product_id: product.id,
      plan_type: "renewal",
      billing_period: plan.periodDays,
      // Sur une formule renouvelée, initial_price s’ajoute au premier prélèvement : il reste à zéro.
      initial_price: 0,
      renewal_price: price,
      currency: "eur",
      adaptive_pricing_enabled: false,
      title: `SaaScan ${plan.label}`,
      description: `${price.toFixed(2).replace(".", ",")} € ${plan.renewal}, résiliable à tout moment.`,
      visibility: "hidden",
      release_method: "buy_now",
      unlimited_stock: true,
      metadata: { saascan_formule: plan.id },
    });
    ids[name] = saved.id;
    console.log(`${name}=${saved.id} · ${saved.formatted_price} · frais initiaux ${saved.initial_price} · ${found ? "existante" : "créée"}`);
  }

  let env = readFileSync(envPath, "utf8");
  for (const [name, value] of Object.entries(ids)) {
    const pattern = new RegExp(`^${name}=.*$`, "m");
    env = pattern.test(env) ? env.replace(pattern, `${name}=${value}`) : `${env.replace(/\n?$/, "\n")}${name}=${value}\n`;
  }
  writeFileSync(envPath, env);
  console.log(`WHOP_PRODUCT_ID=${product.id} · identifiants enregistrés dans ${envPath}`);
} catch (error) {
  // N’affiche que la réponse de l’API, jamais la requête et ses en-têtes.
  console.error("Whop a refusé l’opération :", error?.statusCode ?? "", error?.message ?? "", error?.body ? JSON.stringify(error.body) : "");
  process.exitCode = 1;
}
