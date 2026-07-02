/* eslint-disable @typescript-eslint/no-explicit-any -- raw sqlite rows are untyped */
import { getDb } from "./db";
import { classify, computePriority } from "./priority";
import type { Contact, OutreachEvent, Segment, Stage, Tier } from "./types";

function toSegment(row: any): Segment {
  return { id: row.id, name: row.name, slug: row.slug, createdAt: row.created_at };
}

function toTier(row: any): Tier {
  return {
    id: row.id,
    segmentId: row.segment_id,
    letter: row.letter,
    label: row.label,
    weight: row.weight,
    sortOrder: row.sort_order,
  };
}

function toStage(row: any): Stage {
  return {
    id: row.id,
    segmentId: row.segment_id,
    name: row.name,
    sortOrder: row.sort_order,
    intervalDays: row.interval_days,
    weight: row.weight,
    isTerminal: !!row.is_terminal,
  };
}

function toContact(row: any, now: Date): Contact {
  return {
    id: row.id,
    segmentId: row.segment_id,
    tierId: row.tier_id,
    stageId: row.stage_id,
    brand: row.brand,
    subBrand: row.sub_brand,
    name: row.name,
    role: row.role,
    followers: row.followers,
    linkedin: row.linkedin,
    email: row.email,
    lastContactedAt: row.last_contacted_at,
    dueAt: row.due_at,
    priorityScore: row.priority_score,
    archived: !!row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tier: row.tier_id_j ? toTier({ id: row.tier_id_j, segment_id: row.segment_id, letter: row.tier_letter, label: row.tier_label, weight: row.tier_weight, sort_order: row.tier_sort_order }) : null,
    stage: row.stage_id_j ? toStage({ id: row.stage_id_j, segment_id: row.segment_id, name: row.stage_name, sort_order: row.stage_sort_order, interval_days: row.stage_interval_days, weight: row.stage_weight, is_terminal: row.stage_is_terminal }) : null,
    status: classify(row.due_at, now),
  };
}

const CONTACT_SELECT = `
  SELECT c.*,
    t.id as tier_id_j, t.letter as tier_letter, t.label as tier_label, t.weight as tier_weight, t.sort_order as tier_sort_order,
    s.id as stage_id_j, s.name as stage_name, s.sort_order as stage_sort_order, s.interval_days as stage_interval_days, s.weight as stage_weight, s.is_terminal as stage_is_terminal
  FROM contacts c
  LEFT JOIN tiers t ON t.id = c.tier_id
  LEFT JOIN stages s ON s.id = c.stage_id
`;

export function listSegments(): Segment[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM segments ORDER BY id ASC").all();
  return rows.map(toSegment);
}

export function getSegmentBySlug(slug: string): Segment | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM segments WHERE slug = ?").get(slug);
  return row ? toSegment(row) : null;
}

export function createSegment(name: string, slug: string): Segment {
  const db = getDb();
  const info = db.prepare("INSERT INTO segments (name, slug) VALUES (?, ?)").run(name, slug);
  const id = Number(info.lastInsertRowid);

  const defaultTiers = [
    { letter: "A", label: "A Tier", weight: 1.0 },
    { letter: "B", label: "B Tier", weight: 0.75 },
    { letter: "C", label: "C Tier", weight: 0.5 },
    { letter: "D", label: "D Tier", weight: 0.35 },
  ];
  const tierStmt = db.prepare("INSERT INTO tiers (segment_id, letter, label, weight, sort_order) VALUES (?, ?, ?, ?, ?)");
  defaultTiers.forEach((t, i) => tierStmt.run(id, t.letter, t.label, t.weight, i));

  const defaultStages = [
    { name: "LinkedIn Add", intervalDays: 0, weight: 0.0035, isTerminal: false },
    { name: "First Reach", intervalDays: 8, weight: 0.009, isTerminal: false },
    { name: "Second Reach", intervalDays: 16, weight: 0.013, isTerminal: false },
    { name: "Third Reach", intervalDays: 34, weight: 0.019, isTerminal: true },
  ];
  const stageStmt = db.prepare("INSERT INTO stages (segment_id, name, sort_order, interval_days, weight, is_terminal) VALUES (?, ?, ?, ?, ?, ?)");
  defaultStages.forEach((s, i) => stageStmt.run(id, s.name, i, s.intervalDays, s.weight, s.isTerminal ? 1 : 0));

  return getSegmentBySlug(slug)!;
}

export function getTiers(segmentId: number): Tier[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM tiers WHERE segment_id = ? ORDER BY sort_order ASC").all(segmentId);
  return rows.map(toTier);
}

export function getStages(segmentId: number): Stage[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM stages WHERE segment_id = ? ORDER BY sort_order ASC").all(segmentId);
  return rows.map(toStage);
}

export function updateTier(id: number, fields: Partial<Pick<Tier, "label" | "weight" | "sortOrder">>): Tier {
  const db = getDb();
  const current = db.prepare("SELECT * FROM tiers WHERE id = ?").get(id) as any;
  if (!current) throw new Error("Tier not found");
  const label = fields.label ?? current.label;
  const weight = fields.weight ?? current.weight;
  const sortOrder = fields.sortOrder ?? current.sort_order;
  db.prepare("UPDATE tiers SET label = ?, weight = ?, sort_order = ? WHERE id = ?").run(label, weight, sortOrder, id);
  recomputeContactsForTier(id);
  return toTier(db.prepare("SELECT * FROM tiers WHERE id = ?").get(id));
}

export function updateStage(id: number, fields: Partial<Pick<Stage, "name" | "intervalDays" | "weight" | "sortOrder" | "isTerminal">>): Stage {
  const db = getDb();
  const current = db.prepare("SELECT * FROM stages WHERE id = ?").get(id) as any;
  if (!current) throw new Error("Stage not found");
  const name = fields.name ?? current.name;
  const intervalDays = fields.intervalDays ?? current.interval_days;
  const weight = fields.weight ?? current.weight;
  const sortOrder = fields.sortOrder ?? current.sort_order;
  const isTerminal = fields.isTerminal ?? !!current.is_terminal;
  db.prepare("UPDATE stages SET name = ?, interval_days = ?, weight = ?, sort_order = ?, is_terminal = ? WHERE id = ?").run(
    name, intervalDays, weight, sortOrder, isTerminal ? 1 : 0, id
  );
  recomputeContactsForStage(id);
  return toStage(db.prepare("SELECT * FROM stages WHERE id = ?").get(id));
}

function recomputeContactsForTier(tierId: number) {
  const db = getDb();
  const contacts = db.prepare(`${CONTACT_SELECT} WHERE c.tier_id = ?`).all(tierId);
  const now = new Date();
  for (const row of contacts) {
    const c = toContact(row, now);
    const tierWeight = c.tier?.weight ?? 0;
    const stageWeight = c.stage?.weight ?? 0;
    const priority = computePriority(c.followers, tierWeight, stageWeight);
    db.prepare("UPDATE contacts SET priority_score = ? WHERE id = ?").run(priority, c.id);
  }
}

function recomputeContactsForStage(stageId: number) {
  const db = getDb();
  const contacts = db.prepare(`${CONTACT_SELECT} WHERE c.stage_id = ?`).all(stageId);
  const now = new Date();
  for (const row of contacts) {
    const c = toContact(row, now);
    const tierWeight = c.tier?.weight ?? 0;
    const stageWeight = c.stage?.weight ?? 0;
    const priority = computePriority(c.followers, tierWeight, stageWeight);
    db.prepare("UPDATE contacts SET priority_score = ? WHERE id = ?").run(priority, c.id);
  }
}

export interface ContactFilters {
  segmentId: number;
  search?: string;
  tierId?: number;
  stageId?: number;
  status?: "overdue" | "today" | "upcoming";
  includeArchived?: boolean;
}

export function listContacts(filters: ContactFilters): Contact[] {
  const db = getDb();
  const now = new Date();
  const clauses = ["c.segment_id = ?"];
  const params: any[] = [filters.segmentId];

  if (!filters.includeArchived) clauses.push("c.archived = 0");
  if (filters.tierId) {
    clauses.push("c.tier_id = ?");
    params.push(filters.tierId);
  }
  if (filters.stageId) {
    clauses.push("c.stage_id = ?");
    params.push(filters.stageId);
  }
  if (filters.search) {
    clauses.push("(lower(c.name) LIKE ? OR lower(c.brand) LIKE ? OR lower(c.sub_brand) LIKE ? OR lower(c.role) LIKE ?)");
    const like = `%${filters.search.toLowerCase()}%`;
    params.push(like, like, like, like);
  }

  const rows = db.prepare(`${CONTACT_SELECT} WHERE ${clauses.join(" AND ")} ORDER BY c.priority_score DESC`).all(...params);
  let contacts = rows.map((r) => toContact(r, now));
  if (filters.status) {
    contacts = contacts.filter((c) => c.status === filters.status);
  }
  return contacts;
}

export function getContact(id: number): Contact | null {
  const db = getDb();
  const row = db.prepare(`${CONTACT_SELECT} WHERE c.id = ?`).get(id);
  return row ? toContact(row, new Date()) : null;
}

export interface ContactStats {
  overdue: number;
  today: number;
  upcoming: number;
  total: number;
}

export function getStats(segmentId: number): ContactStats {
  const db = getDb();
  const now = new Date();
  const rows = db.prepare(`${CONTACT_SELECT} WHERE c.segment_id = ? AND c.archived = 0`).all(segmentId);
  const contacts = rows.map((r) => toContact(r, now));
  return {
    overdue: contacts.filter((c) => c.status === "overdue").length,
    today: contacts.filter((c) => c.status === "today").length,
    upcoming: contacts.filter((c) => {
      if (!c.dueAt) return false;
      const diff = (new Date(c.dueAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 1 && diff <= 7;
    }).length,
    total: contacts.length,
  };
}

export interface NewContactInput {
  segmentId: number;
  tierId?: number | null;
  stageId?: number | null;
  brand?: string | null;
  subBrand?: string | null;
  name: string;
  role?: string | null;
  followers?: number | null;
  linkedin?: string | null;
  email?: string | null;
  lastContactedAt?: string | null;
  dueAt?: string | null;
}

function priorityForContact(db: ReturnType<typeof getDb>, tierId: number | null, stageId: number | null, followers: number | null): number {
  const tier = tierId ? (db.prepare("SELECT weight FROM tiers WHERE id = ?").get(tierId) as any) : null;
  const stage = stageId ? (db.prepare("SELECT weight FROM stages WHERE id = ?").get(stageId) as any) : null;
  return computePriority(followers, tier?.weight ?? 0, stage?.weight ?? 0);
}

export function createContact(input: NewContactInput): Contact {
  const db = getDb();
  const tierId = input.tierId ?? null;
  const stageId = input.stageId ?? null;
  const followers = input.followers ?? null;
  const dueAt = input.dueAt ?? new Date().toISOString();
  const priority = priorityForContact(db, tierId, stageId, followers);

  const info = db
    .prepare(
      `INSERT INTO contacts (segment_id, tier_id, stage_id, brand, sub_brand, name, role, followers, linkedin, email, last_contacted_at, due_at, priority_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.segmentId,
      tierId,
      stageId,
      input.brand ?? null,
      input.subBrand ?? null,
      input.name,
      input.role ?? null,
      followers,
      input.linkedin ?? null,
      input.email ?? null,
      input.lastContactedAt ?? null,
      dueAt,
      priority
    );
  return getContact(Number(info.lastInsertRowid))!;
}

export type UpdateContactInput = Partial<NewContactInput>;

export function updateContact(id: number, fields: UpdateContactInput): Contact {
  const db = getDb();
  const current = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id) as any;
  if (!current) throw new Error("Contact not found");

  const merged = {
    tierId: fields.tierId !== undefined ? fields.tierId : current.tier_id,
    stageId: fields.stageId !== undefined ? fields.stageId : current.stage_id,
    brand: fields.brand !== undefined ? fields.brand : current.brand,
    subBrand: fields.subBrand !== undefined ? fields.subBrand : current.sub_brand,
    name: fields.name !== undefined ? fields.name : current.name,
    role: fields.role !== undefined ? fields.role : current.role,
    followers: fields.followers !== undefined ? fields.followers : current.followers,
    linkedin: fields.linkedin !== undefined ? fields.linkedin : current.linkedin,
    email: fields.email !== undefined ? fields.email : current.email,
    lastContactedAt: fields.lastContactedAt !== undefined ? fields.lastContactedAt : current.last_contacted_at,
    dueAt: fields.dueAt !== undefined ? fields.dueAt : current.due_at,
  };
  const priority = priorityForContact(db, merged.tierId, merged.stageId, merged.followers);

  db.prepare(
    `UPDATE contacts SET tier_id = ?, stage_id = ?, brand = ?, sub_brand = ?, name = ?, role = ?, followers = ?, linkedin = ?, email = ?, last_contacted_at = ?, due_at = ?, priority_score = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    merged.tierId, merged.stageId, merged.brand, merged.subBrand, merged.name, merged.role, merged.followers,
    merged.linkedin, merged.email, merged.lastContactedAt, merged.dueAt, priority, id
  );
  return getContact(id)!;
}

export function deleteContact(id: number): void {
  const db = getDb();
  db.prepare("DELETE FROM contacts WHERE id = ?").run(id);
}

export function markContacted(id: number): Contact {
  const db = getDb();
  const current = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id) as any;
  if (!current) throw new Error("Contact not found");

  const fromStage = current.stage_id ? (db.prepare("SELECT * FROM stages WHERE id = ?").get(current.stage_id) as any) : null;
  let nextStage: any = null;
  if (fromStage && !fromStage.is_terminal) {
    nextStage = db
      .prepare("SELECT * FROM stages WHERE segment_id = ? AND sort_order = ? ")
      .get(fromStage.segment_id, fromStage.sort_order + 1);
  } else if (!fromStage) {
    nextStage = db.prepare("SELECT * FROM stages WHERE segment_id = ? ORDER BY sort_order ASC LIMIT 1").get(current.segment_id);
  }

  const now = new Date();
  const toStage = nextStage ?? fromStage;
  const newDueAt = nextStage ? new Date(now.getTime() + nextStage.interval_days * 24 * 60 * 60 * 1000).toISOString() : null;
  const tierWeight = current.tier_id ? ((db.prepare("SELECT weight FROM tiers WHERE id = ?").get(current.tier_id) as any)?.weight ?? 0) : 0;
  const newPriority = computePriority(current.followers, tierWeight, toStage?.weight ?? 0);

  db.prepare(
    "INSERT INTO outreach_events (contact_id, from_stage_id, to_stage_id, prev_due_at, prev_last_contacted_at, prev_priority_score) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, current.stage_id, toStage?.id ?? null, current.due_at, current.last_contacted_at, current.priority_score);

  db.prepare(
    "UPDATE contacts SET stage_id = ?, last_contacted_at = ?, due_at = ?, priority_score = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(toStage?.id ?? null, now.toISOString(), newDueAt, newPriority, id);

  return getContact(id)!;
}

export function undoLastContact(id: number): Contact {
  const db = getDb();
  const event = db
    .prepare("SELECT * FROM outreach_events WHERE contact_id = ? ORDER BY id DESC LIMIT 1")
    .get(id) as any;
  if (!event) throw new Error("Nothing to undo");

  db.prepare(
    "UPDATE contacts SET stage_id = ?, last_contacted_at = ?, due_at = ?, priority_score = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(event.from_stage_id, event.prev_last_contacted_at, event.prev_due_at, event.prev_priority_score, id);

  db.prepare("DELETE FROM outreach_events WHERE id = ?").run(event.id);

  return getContact(id)!;
}

export function getContactHistory(id: number): OutreachEvent[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM outreach_events WHERE contact_id = ? ORDER BY contacted_at DESC").all(id);
  return rows.map((r: any) => ({
    id: r.id,
    contactId: r.contact_id,
    fromStageId: r.from_stage_id,
    toStageId: r.to_stage_id,
    prevDueAt: r.prev_due_at,
    prevLastContactedAt: r.prev_last_contacted_at,
    prevPriorityScore: r.prev_priority_score,
    contactedAt: r.contacted_at,
  }));
}
