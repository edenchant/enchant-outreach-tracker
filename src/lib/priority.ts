// Contacts without a recorded LinkedIn follower count would otherwise score
// exactly 0 and never surface in any priority-ordered view, regardless of
// tier or stage — treating them as a typical/average LinkedIn user (~500
// followers) instead means missing data no longer silently zeroes them out.
export const DEFAULT_FOLLOWERS = 500;

export function computePriority(followers: number | null, tierWeight: number, stageWeight: number, relationshipMultiplier = 1): number {
  return Math.round((followers ?? DEFAULT_FOLLOWERS) * tierWeight * stageWeight * relationshipMultiplier * 1000) / 1000;
}

// A contact Ed has established contact with, or converted into a strong
// relationship, gets a small, permanent priority bump — not time-decaying
// like the brand-history bonus, so it's baked straight into the stored
// priority_score rather than applied at read time. Converted (a stronger
// relationship) outranks merely being in touch, so these don't stack.
export const IN_TOUCH_PRIORITY_MULTIPLIER = 1.02;
export const CONVERTED_PRIORITY_MULTIPLIER = 1.05;

export function relationshipMultiplier(inTouch: boolean, converted: boolean): number {
  if (converted) return CONVERTED_PRIORITY_MULTIPLIER;
  if (inTouch) return IN_TOUCH_PRIORITY_MULTIPLIER;
  return 1;
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
