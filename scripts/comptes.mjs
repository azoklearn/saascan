// Liste les comptes SaaScan : email, date de création, dernière connexion, mode de
// connexion et dossiers rattachés. Lecture seule, avec la clé service_role ; aucun
// lien secret de dossier n’est affiché. La clé n’est jamais écrite dans la sortie.
// Usage : node scripts/comptes.mjs [--json] [--avec-dossier]
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Pas de fichier local : les variables viennent déjà de l’environnement.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) throw new Error("Renseignez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local.");

const asJson = process.argv.includes("--json");
const onlyWithDossier = process.argv.includes("--avec-dossier");
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const validMembershipStates = ["active", "trialing", "past_due", "canceling"];
const dateOnly = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" });

/** Même règle que src/lib/supabase/dossiers.ts : payé, non remboursé, abonnement valide. */
function hasAccess(dossier) {
  return !!dossier.paid_at && !dossier.refunded_at && (dossier.membership_status === null || validMembershipStates.includes(dossier.membership_status));
}

async function listUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    users.push(...data.users);
    if (data.users.length < 200) return users;
  }
}

try {
  const [users, dossiers] = await Promise.all([
    listUsers(),
    admin.from("dossiers").select("user_id,formule,statut,paid_at,refunded_at,membership_status,created_at").then(({ data, error }) => {
      if (error) throw new Error(error.message);
      return data ?? [];
    }),
  ]);

  const byUser = new Map();
  let orphelins = 0;
  for (const dossier of dossiers) {
    // Un dossier créé avant l’obligation de compte n’a qu’un lien secret.
    if (!dossier.user_id) { orphelins += 1; continue; }
    const list = byUser.get(dossier.user_id) ?? [];
    list.push(dossier);
    byUser.set(dossier.user_id, list);
  }

  const comptes = users
    .map((user) => {
      const list = byUser.get(user.id) ?? [];
      return {
        id: user.id,
        email: user.email ?? "",
        cree_le: user.created_at,
        derniere_connexion: user.last_sign_in_at ?? null,
        // Google ou email et mot de passe ; un compte peut avoir les deux.
        connexion: [...new Set((user.identities ?? []).map((identity) => identity.provider))].sort(),
        dossiers: list.length,
        dossiers_payes: list.filter((dossier) => dossier.paid_at && !dossier.refunded_at).length,
        abonnements_actifs: list.filter(hasAccess).length,
      };
    })
    .filter((compte) => !onlyWithDossier || compte.dossiers > 0)
    .sort((a, b) => Date.parse(b.cree_le) - Date.parse(a.cree_le));

  if (asJson) {
    console.log(JSON.stringify(comptes, null, 2));
  } else if (comptes.length === 0) {
    console.log("Aucun compte.");
  } else {
    const header = ["EMAIL", "CRÉÉ LE", "CONNEXION", "DOSSIERS", "PAYÉS", "ACTIFS", "DERNIÈRE CONNEXION"];
    const rows = comptes.map((compte) => [
      compte.email,
      dateOnly.format(new Date(compte.cree_le)),
      compte.connexion.join(" + ") || "—",
      String(compte.dossiers),
      String(compte.dossiers_payes),
      String(compte.abonnements_actifs),
      compte.derniere_connexion ? dateOnly.format(new Date(compte.derniere_connexion)) : "jamais",
    ]);
    const widths = header.map((titre, i) => Math.max(titre.length, ...rows.map((row) => row[i].length)));
    // Les trois colonnes de comptage sont alignées à droite.
    const line = (cells) => cells.map((cell, i) => (i >= 3 && i <= 5 ? cell.padStart(widths[i]) : cell.padEnd(widths[i]))).join("  ").trimEnd();
    console.log(line(header));
    for (const row of rows) console.log(line(row));
    const actifs = comptes.filter((compte) => compte.abonnements_actifs > 0).length;
    const sansCompte = orphelins ? ` · ${orphelins} dossier${orphelins > 1 ? "s" : ""} sans compte` : "";
    console.log(`\n${comptes.length} compte${comptes.length > 1 ? "s" : ""} · ${actifs} avec un abonnement actif${sansCompte}`);
  }
} catch (error) {
  // N’affiche que le message de l’API, jamais la requête et ses en-têtes.
  console.error("La lecture des comptes a échoué :", error?.message ?? "");
  process.exitCode = 1;
}
