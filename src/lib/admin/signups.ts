export type SignupUser = { id?: string; email?: string | null; created_at: string; last_sign_in_at?: string | null; app_metadata?: { provider?: string; providers?: string[] } };
export type SignupDossier = {
  id?: string; user_id: string | null; created_at?: string; statut?: string | null;
  paid_at: string | null; refunded_at: string | null;
  formule?: string | null; membership_status?: string | null; cancel_at_period_end?: boolean | null;
};
export type SignupResponse = { dossier_id: string; question_id: string; value: unknown };
/** Questionnaire terminé et enregistré avant tout paiement. */
export type SignupCompletion = { user_id: string; answers: Record<string, unknown> | null; updated_at?: string | null; created_at?: string | null };
export type SignupSummary = {
  total: number; today: number; last7Days: number; last30Days: number;
  google: number; email: number; openedCheckout: number; paying: number;
  days: { day: string; count: number }[];
};
export type AccountRow = {
  id: string; email: string; providers: string; createdAt: string; lastSignInAt: string | null;
  opened: number; paid: number; formule: string | null; membershipStatus: string | null; cancelAtPeriodEnd: boolean;
};

// fr-CA écrit les dates en AAAA-MM-JJ : une clé de jour simple, à l’heure de Paris.
const parisDay = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
const dayMs = 86_400_000;
const providerLabels: Record<string, string> = { google: "Google", email: "Email" };

const providersOf = (user: SignupUser) => user.app_metadata?.providers ?? (user.app_metadata?.provider ? [user.app_metadata.provider] : []);

/** Chiffres de la page admin : inscrits par période et par méthode de connexion, et comptes arrivés jusqu’au paiement. */
export function summarizeSignups(users: SignupUser[], dossiers: SignupDossier[], now = Date.now(), dayCount = 14): SignupSummary {
  const dayOf = (time: number) => parisDay.format(time);
  const days = Array.from({ length: dayCount }, (_, index) => dayOf(now - (dayCount - 1 - index) * dayMs));
  const perDay = new Map(days.map((day) => [day, 0]));
  let google = 0;
  for (const user of users) {
    const day = dayOf(Date.parse(user.created_at));
    if (perDay.has(day)) perDay.set(day, perDay.get(day)! + 1);
    if (providersOf(user).includes("google")) google++;
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

/** Un compte par ligne, du plus récent au plus ancien, avec ses dossiers et son abonnement. */
export function accountRows(users: SignupUser[], dossiers: SignupDossier[]): AccountRow[] {
  return [...users]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map((user) => {
      const own = dossiers.filter((dossier) => dossier.user_id && dossier.user_id === user.id);
      const paid = own.filter((dossier) => dossier.paid_at && !dossier.refunded_at);
      const current = paid[0];
      return {
        id: user.id ?? "",
        email: user.email ?? "—",
        providers: providersOf(user).map((provider) => providerLabels[provider] ?? provider).join(" + ") || "—",
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
        opened: own.length,
        paid: paid.length,
        formule: current?.formule ?? null,
        membershipStatus: current?.membership_status ?? null,
        cancelAtPeriodEnd: !!current?.cancel_at_period_end,
      };
    });
}

export type AccountDossier = {
  id: string; createdAt: string | null; statut: string | null; paidAt: string | null; refundedAt: string | null;
  formule: string | null; membershipStatus: string | null; cancelAtPeriodEnd: boolean;
  answers: { question_id: string; value: unknown }[];
};
export type AccountDetail = AccountRow & { dossiers: AccountDossier[]; completedAt: string | null; completionAnswers: { question_id: string; value: unknown }[] };

/** Les comptes avec, sous chacun, ses dossiers du plus récent au plus ancien et les réponses données. */
export function accountDetails(users: SignupUser[], dossiers: SignupDossier[], responses: SignupResponse[], completions: SignupCompletion[] = []): AccountDetail[] {
  return accountRows(users, dossiers).map((account) => {
    const completion = completions.find((entry) => entry.user_id === account.id);
    return {
    ...account,
    completedAt: completion?.updated_at ?? completion?.created_at ?? null,
    completionAnswers: Object.entries(completion?.answers ?? {}).map(([question_id, value]) => ({ question_id, value })),
    dossiers: dossiers
      .filter((dossier) => dossier.user_id && dossier.user_id === account.id)
      .sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""))
      .map((dossier) => ({
        id: dossier.id ?? "",
        createdAt: dossier.created_at ?? null,
        statut: dossier.statut ?? null,
        paidAt: dossier.paid_at,
        refundedAt: dossier.refunded_at,
        formule: dossier.formule ?? null,
        membershipStatus: dossier.membership_status ?? null,
        cancelAtPeriodEnd: !!dossier.cancel_at_period_end,
        answers: responses.filter((response) => response.dossier_id === dossier.id).map(({ question_id, value }) => ({ question_id, value })),
      })),
    };
  });
}
