import type { Contact, GridContact, Segment, Stage, Tier } from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export interface ContactQuery {
  segment: string;
  search?: string;
  tier?: number;
  stage?: number;
  status?: "overdue" | "today" | "upcoming";
}

export async function fetchContacts(q: ContactQuery): Promise<Contact[]> {
  const params = new URLSearchParams();
  params.set("segment", q.segment);
  if (q.search) params.set("search", q.search);
  if (q.tier) params.set("tier", String(q.tier));
  if (q.stage) params.set("stage", String(q.stage));
  if (q.status) params.set("status", q.status);
  const res = await fetch(`/api/contacts?${params.toString()}`);
  const data = await json<{ contacts: Contact[] }>(res);
  return data.contacts;
}

export async function fetchStats(slug: string) {
  const res = await fetch(`/api/segments/${slug}/stats`);
  const data = await json<{ stats: { overdue: number; today: number; upcoming: number; total: number } }>(res);
  return data.stats;
}

export async function fetchTopToday(slug: string): Promise<Contact[]> {
  const res = await fetch(`/api/segments/${slug}/top10`);
  const data = await json<{ contacts: Contact[] }>(res);
  return data.contacts;
}

export async function fetchGlobalStats() {
  const res = await fetch(`/api/stats`);
  const data = await json<{ stats: { overdue: number; today: number; upcoming: number; total: number } }>(res);
  return data.stats;
}

export async function fetchGlobalTopToday(): Promise<GridContact[]> {
  const res = await fetch(`/api/top10`);
  const data = await json<{ contacts: GridContact[] }>(res);
  return data.contacts;
}

export async function markContacted(id: number): Promise<Contact> {
  const res = await fetch(`/api/contacts/${id}/contact`, { method: "POST" });
  const data = await json<{ contact: Contact }>(res);
  return data.contact;
}

export async function snoozeContact(id: number): Promise<Contact> {
  const res = await fetch(`/api/contacts/${id}/snooze`, { method: "POST" });
  const data = await json<{ contact: Contact }>(res);
  return data.contact;
}

export async function undoContact(id: number): Promise<Contact> {
  const res = await fetch(`/api/contacts/${id}/undo`, { method: "POST" });
  const data = await json<{ contact: Contact }>(res);
  return data.contact;
}

export async function draftMessage(id: number, kind: "email" | "linkedin"): Promise<string> {
  const res = await fetch(`/api/contacts/${id}/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }),
  });
  const data = await json<{ draft: string }>(res);
  return data.draft;
}

export interface ContactPayload {
  segmentSlug?: string;
  tierId?: number | null;
  stageId?: number | null;
  brand?: string | null;
  subBrand?: string | null;
  name: string;
  role?: string | null;
  followers?: number | null;
  linkedin?: string | null;
  email?: string | null;
}

export async function createContact(payload: ContactPayload): Promise<Contact> {
  const res = await fetch(`/api/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await json<{ contact: Contact }>(res);
  return data.contact;
}

export async function updateContact(id: number, payload: Partial<ContactPayload>): Promise<Contact> {
  const res = await fetch(`/api/contacts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await json<{ contact: Contact }>(res);
  return data.contact;
}

export async function deleteContact(id: number): Promise<void> {
  const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
  await json(res);
}

export interface OutreachEventDTO {
  id: number;
  contactedAt: string;
  fromStageId: number | null;
  toStageId: number | null;
  type: "contacted" | "snoozed";
}

export async function fetchHistory(id: number): Promise<OutreachEventDTO[]> {
  const res = await fetch(`/api/contacts/${id}/history`);
  const data = await json<{ events: OutreachEventDTO[] }>(res);
  return data.events;
}

export interface GridQuery {
  segment?: string;
  tier?: string;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface GridResultDTO {
  rows: GridContact[];
  total: number;
}

export async function fetchGrid(q: GridQuery): Promise<GridResultDTO> {
  const params = new URLSearchParams();
  if (q.segment) params.set("segment", q.segment);
  if (q.tier) params.set("tier", q.tier);
  if (q.search) params.set("search", q.search);
  if (q.sortBy) params.set("sortBy", q.sortBy);
  if (q.sortDir) params.set("sortDir", q.sortDir);
  if (q.page) params.set("page", String(q.page));
  if (q.pageSize) params.set("pageSize", String(q.pageSize));
  const res = await fetch(`/api/data-grid?${params.toString()}`);
  return json<GridResultDTO>(res);
}

export async function fetchSegmentConfig(slug: string): Promise<{ segment: Segment; tiers: Tier[]; stages: Stage[] }> {
  const res = await fetch(`/api/segments/${slug}/config`);
  return json(res);
}

export async function createSegment(name: string) {
  const res = await fetch(`/api/segments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return json<{ segment: { id: number; name: string; slug: string } }>(res);
}

export async function updateTierApi(id: number, payload: Partial<Pick<Tier, "label" | "weight">>) {
  const res = await fetch(`/api/tiers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json<{ tier: Tier }>(res);
}

export async function updateStageApi(id: number, payload: Partial<Pick<Stage, "name" | "intervalDays" | "weight">>) {
  const res = await fetch(`/api/stages/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return json<{ stage: Stage }>(res);
}
