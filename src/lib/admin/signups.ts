export type SignupUser = { created_at: string; app_metadata?: { provider?: string; providers?: string[] } };
export type SignupDossier = { user_id: string | null; paid_at: string | null; refunded_at: string | null };
export type SignupSummary = {
  total: number; today: number; last7Days: number; last30Days: number;
  google: number; email: number; openedCheckout: number; paying: number;
  days: { day: string; count: number }[];
};

// fr-CA écrit les dates en AAAA-MM-JJ : une clé de jour simple, à l’heure de Paris.
const parisDay = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
const dayMs = 86_400_000;

/** Chiffres de la page admin : inscrits par période et par méthode de connexion, et comptes arrivés jusqu’au paiement. */
export function summarizeSignups(users: SignupUser[], dossiers: SignupDossier[], now = Date.now(), dayCount = 14): SignupSummary {
  const dayOf = (time: number) => parisDay.format(time);
  const days = Array.from({ length: dayCount }, (_, index) => dayOf(now - (dayCount - 1 - index) * dayMs));
  const perDay = new Map(days.map((day) => [day, 0]));
  let google = 0;
  for (const user of users) {
    const day = dayOf(Date.parse(user.created_at));
    if (perDay.has(day)) perDay.set(day, perDay.get(day)! + 1);
    const providers = user.app_metadata?.providers ?? (user.app_metadata?.provider ? [user.app_metadata.provider] : []);
    if (providers.includes("google")) google++;
  }
  const within = (ms: number) => users.filter((user) => now - Date.parse(user.created_at) < ms).length;
  const owners = (list: SignupDossier[]) => new Set(list.flatMap((dossier) => dossier.user_id ? [dossier.user_id] : [])).size;
  return {
    total: users.length,
    today: perDay.get(dayOf(now)) ?? 0,
    last7Days: within(7 * dayMs),
    last30Days: within(30 * dayMs),
    google,
    email: users.length - google,
    openedCheckout: owners(dossiers),
    paying: owners(dossiers.filter((dossier) => dossier.paid_at && !dossier.refunded_at)),
    days: days.map((day) => ({ day, count: perDay.get(day)! })),
  };
}
