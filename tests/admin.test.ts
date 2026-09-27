import { describe, expect, it } from "vitest";
import { accountDetails, accountRows, summarizeSignups } from "@/lib/admin/signups";

describe("Page admin", () => {
  it("compte les inscrits par période et par méthode, à l’heure de Paris, et les comptes arrivés au paiement", () => {
    const now = Date.parse("2026-09-16T12:00:00Z");
    const users = [
      { created_at: "2026-09-16T08:00:00Z", app_metadata: { providers: ["google"] } },
      // 01 h 30 le 16 septembre à Paris.
      { created_at: "2026-09-15T23:30:00Z", app_metadata: { provider: "email" } },
      { created_at: "2026-09-10T10:00:00Z", app_metadata: { providers: ["email", "google"] } },
      { created_at: "2026-08-01T10:00:00Z", app_metadata: { provider: "email" } },
    ];
    const dossiers = [
      { user_id: "a", paid_at: null, refunded_at: null },
      { user_id: "a", paid_at: "2026-09-16T09:00:00Z", refunded_at: null },
      { user_id: "b", paid_at: "2026-09-12T09:00:00Z", refunded_at: "2026-09-13T09:00:00Z" },
      { user_id: null, paid_at: "2026-09-01T09:00:00Z", refunded_at: null },
    ];
    const stats = summarizeSignups(users, dossiers, now);
    expect(stats).toMatchObject({ total: 4, today: 2, last7Days: 3, last30Days: 3, google: 2, email: 2, openedCheckout: 2, paying: 1 });
    expect(stats.days).toHaveLength(14);
    expect(stats.days[0].day).toBe("2026-09-03");
    expect(stats.days.at(-1)).toEqual({ day: "2026-09-16", count: 2 });
    expect(stats.days.reduce((sum, entry) => sum + entry.count, 0)).toBe(3);
  });

  it("liste les comptes du plus récent au plus ancien, avec leurs dossiers et leur abonnement", () => {
    const users = [
      { id: "ancien", email: "ancien@example.invalid", created_at: "2026-09-10T10:00:00Z", last_sign_in_at: "2026-09-11T08:00:00Z", app_metadata: { providers: ["email", "google"] } },
      { id: "recent", email: "recent@example.invalid", created_at: "2026-09-16T08:00:00Z", app_metadata: { providers: ["google"] } },
    ];
    const dossiers = [
      { user_id: "ancien", paid_at: "2026-09-11T09:00:00Z", refunded_at: null, formule: "trimestriel", membership_status: "active", cancel_at_period_end: true },
      { user_id: "ancien", paid_at: null, refunded_at: null },
      { user_id: "recent", paid_at: "2026-09-16T09:00:00Z", refunded_at: "2026-09-16T10:00:00Z", formule: "mensuel" },
      { user_id: null, paid_at: "2026-09-01T09:00:00Z", refunded_at: null },
    ];
    const [first, second] = accountRows(users, dossiers);
    expect(first).toMatchObject({ email: "recent@example.invalid", providers: "Google", opened: 1, paid: 0, formule: null, lastSignInAt: null });
    expect(second).toMatchObject({ email: "ancien@example.invalid", providers: "Email + Google", opened: 2, paid: 1, formule: "trimestriel", membershipStatus: "active", cancelAtPeriodEnd: true });
  });

  it("rattache à chaque compte ses dossiers et les réponses données", () => {
    const users = [{ id: "u1", email: "detail@example.invalid", created_at: "2026-09-20T10:00:00Z", app_metadata: { providers: ["google"] } }];
    const dossiers = [
      { id: "d-ancien", user_id: "u1", created_at: "2026-09-20T11:00:00Z", statut: "brouillon", paid_at: null, refunded_at: null, formule: "mensuel" },
      { id: "d-recent", user_id: "u1", created_at: "2026-09-21T11:00:00Z", statut: "pret", paid_at: "2026-09-21T11:05:00Z", refunded_at: null, formule: "annuel" },
      { id: "d-autre", user_id: "u2", created_at: "2026-09-21T12:00:00Z", statut: "pret", paid_at: null, refunded_at: null },
    ];
    const responses = [
      { dossier_id: "d-recent", question_id: "objectif_revenu", value: "2000" },
      { dossier_id: "d-recent", question_id: "temps_jour", value: "1h" },
      { dossier_id: "d-ancien", question_id: "competences", value: "aucune" },
      { dossier_id: "d-autre", question_id: "objectif_revenu", value: "5000" },
    ];
    const [account] = accountDetails(users, dossiers, responses);
    expect(account.dossiers.map((dossier) => dossier.id)).toEqual(["d-recent", "d-ancien"]);
    expect(account.dossiers[0].answers).toEqual([{ question_id: "objectif_revenu", value: "2000" }, { question_id: "temps_jour", value: "1h" }]);
    expect(account.dossiers[1].answers).toEqual([{ question_id: "competences", value: "aucune" }]);
  });
});
