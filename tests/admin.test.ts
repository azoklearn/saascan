import { describe, expect, it } from "vitest";
import { summarizeSignups } from "@/lib/admin/signups";

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
});
