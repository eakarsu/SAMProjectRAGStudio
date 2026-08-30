export type SamAlertSubscription = {
  id: string;
  keywords?: string[];
  agencies?: string[];
  naics?: string[];
  minimumValue?: number;
  daysBeforeDeadline?: number;
};

export type SamAlertNotice = {
  noticeId: string;
  title: string;
  agency: string;
  naics?: string | null;
  estimatedValue?: number;
  responseDeadline: string;
};

export function evaluateSamAlerts(input: {
  asOf: string;
  subscriptions: SamAlertSubscription[];
  notices: SamAlertNotice[];
}) {
  const asOf = new Date(input.asOf);
  if (!Number.isFinite(asOf.getTime())) throw new Error("asOf is invalid");
  if (!Array.isArray(input.subscriptions) || !Array.isArray(input.notices))
    throw new Error("subscriptions and notices are required");
  if (input.subscriptions.length > 1000 || input.notices.length > 10000)
    throw new Error("alert evaluation batch is too large");
  const alerts = input.subscriptions.flatMap((subscription) => {
    if (!subscription.id?.trim()) throw new Error("subscription id is required");
    const keywords = (subscription.keywords ?? []).map((value) => value.toLowerCase());
    const agencies = new Set((subscription.agencies ?? []).map((value) => value.toLowerCase()));
    const naics = new Set(subscription.naics ?? []);
    const windowDays = subscription.daysBeforeDeadline ?? 30;
    return input.notices.flatMap((notice) => {
      const deadline = new Date(notice.responseDeadline);
      if (!notice.noticeId || !Number.isFinite(deadline.getTime())) return [];
      const daysRemaining = Math.ceil((deadline.getTime() - asOf.getTime()) / 86_400_000);
      const title = notice.title.toLowerCase();
      const matchedKeywords = keywords.filter((keyword) => title.includes(keyword));
      const keywordMatch = keywords.length === 0 || matchedKeywords.length > 0;
      const agencyMatch = agencies.size === 0 || agencies.has(notice.agency.toLowerCase());
      const naicsMatch = naics.size === 0 || (!!notice.naics && naics.has(notice.naics));
      const valueMatch = (notice.estimatedValue ?? 0) >= (subscription.minimumValue ?? 0);
      if (!keywordMatch || !agencyMatch || !naicsMatch || !valueMatch || daysRemaining < 0 || daysRemaining > windowDays) return [];
      return [{ id: `${subscription.id}:${notice.noticeId}`, subscriptionId: subscription.id, noticeId: notice.noticeId, title: notice.title, agency: notice.agency, responseDeadline: deadline.toISOString(), daysRemaining, matchedKeywords, deliveryState: "queued" as const }];
    });
  }).sort((a, b) => a.daysRemaining - b.daysRemaining || a.id.localeCompare(b.id));
  return { schemaVersion: 1, asOf: asOf.toISOString(), alerts, summary: { subscriptions: input.subscriptions.length, notices: input.notices.length, matches: alerts.length }, automaticBidDecision: false };
}
