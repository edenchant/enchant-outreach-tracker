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
