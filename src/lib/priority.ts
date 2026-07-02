export function computePriority(followers: number | null, tierWeight: number, stageWeight: number): number {
  return Math.round((followers ?? 0) * tierWeight * stageWeight * 1000) / 1000;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function daysBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

export type QueueStatus = "overdue" | "today" | "upcoming" | "none";

export function classify(dueAt: string | null, now: Date): QueueStatus {
  if (!dueAt) return "none";
  const diffDays = daysBetween(new Date(dueAt), now);
  if (diffDays < 0) return "overdue";
  if (diffDays < 1) return "today";
  return "upcoming";
}

// A brand history entry (new CMO / rebrand / major campaign) gives a modest,
// time-limited boost to that brand's contacts. This only affects sort order
// at read time — the stored priority_score is never touched by it.
export const BRAND_HISTORY_RECENCY_DAYS = 60;
export const BRAND_HISTORY_MAX_BONUS = 0.15;

export function brandBonusMultiplier(daysSinceEvent: number | null): number {
  if (daysSinceEvent === null || daysSinceEvent < 0 || daysSinceEvent > BRAND_HISTORY_RECENCY_DAYS) return 1;
  const decay = 1 - daysSinceEvent / BRAND_HISTORY_RECENCY_DAYS;
  return 1 + BRAND_HISTORY_MAX_BONUS * decay;
}
