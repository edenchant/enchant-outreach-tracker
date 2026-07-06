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

// A brand history entry (new CMO / rebrand / major campaign / etc.) gives a
// time-limited boost to that brand's contacts, sized by how significant the
// event type is. This only affects sort order at read time — the stored
// priority_score is never touched by it.
export const BRAND_HISTORY_RECENCY_DAYS = 60;

export const BRAND_HISTORY_BONUS_BY_TYPE: Record<string, number> = {
  "Brand Refresh / Rebrand": 0.5,
  "New Head of Brand": 0.3,
  "New CMO": 0.2,
  "Major ATL Campaign": 0.15,
};
// Used for event types with no specific weighting above (currently just "Other").
export const BRAND_HISTORY_DEFAULT_BONUS = 0.15;

function maxBonusForEventType(eventType: string | null): number {
  if (!eventType) return 0;
  return BRAND_HISTORY_BONUS_BY_TYPE[eventType] ?? BRAND_HISTORY_DEFAULT_BONUS;
}

export function brandBonusMultiplier(eventType: string | null, daysSinceEvent: number | null): number {
  if (daysSinceEvent === null || daysSinceEvent < 0 || daysSinceEvent > BRAND_HISTORY_RECENCY_DAYS) return 1;
  const decay = 1 - daysSinceEvent / BRAND_HISTORY_RECENCY_DAYS;
  return 1 + maxBonusForEventType(eventType) * decay;
}

// SQL equivalent of brandBonusMultiplier(), for the one read path (the paginated
// data grid) that needs the bonus applied inside the database's own ORDER BY
// rather than in JS after fetching. Sourced from the same constants above so
// the window/bonus sizes are only ever defined in one place.
export function brandBonusSqlExpression(priorityExpr: string, lastEventDateExpr: string, lastEventTypeExpr: string): string {
  const typeCase = Object.entries(BRAND_HISTORY_BONUS_BY_TYPE)
    .map(([type, bonus]) => `WHEN ${lastEventTypeExpr} = '${type}' THEN ${bonus}`)
    .join("\n      ");
  return `(CASE
    WHEN ${lastEventDateExpr} IS NULL THEN ${priorityExpr}
    WHEN (julianday('now') - julianday(${lastEventDateExpr})) > ${BRAND_HISTORY_RECENCY_DAYS} THEN ${priorityExpr}
    WHEN (julianday('now') - julianday(${lastEventDateExpr})) < 0 THEN ${priorityExpr}
    ELSE ${priorityExpr} * (1 + (CASE
      ${typeCase}
      ELSE ${BRAND_HISTORY_DEFAULT_BONUS}
    END) * (1 - (julianday('now') - julianday(${lastEventDateExpr})) / ${BRAND_HISTORY_RECENCY_DAYS}))
  END)`;
}
