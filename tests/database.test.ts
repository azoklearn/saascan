import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

describe("Migrations PostgreSQL et droits RLS", () => {
  it("applique les migrations puis vérifie l’accès serveur, l’abonnement, les bonus et le remboursement", async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        create role anon nologin;
        create role authenticated nologin;
        create role service_role nologin bypassrls;
        create schema auth;
        create table auth.users (id uuid primary key, email text);
        create function auth.uid() returns uuid language sql stable as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
        $$;
        grant usage on schema public, auth to anon, authenticated, service_role;
        grant execute on function auth.uid() to anon, authenticated, service_role;
      `);
      for (const file of ["202609120001_initial_schema.sql", "202609120002_server_transactions.sql", "202609130001_parcours_sans_compte.sql", "202609130002_abonnements_whop.sql", "202609130003_contenus_rediges.sql"]) {
        await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
      }
      const tables = await db.query<{ count: number }>("select count(*)::int as count from pg_tables where schemaname = 'public' and rowsecurity = true");
      expect(tables.rows[0].count).toBe(11);
      await db.exec(await readFile("supabase/tests/rls.sql", "utf8"));
    } finally { await db.close(); }
  }, 30000);
});
