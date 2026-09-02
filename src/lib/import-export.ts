/* eslint-disable @typescript-eslint/no-explicit-any -- raw sqlite rows are untyped */
import Papa from "papaparse";
import { getDb } from "./db";
import { createContact, deleteContact, getStages, getTiers, listSegments, updateContact } from "./queries";

export const IMPORT_EXPORT_COLUMNS = [
  "id",
  "segment",
  "tier",
  "stage",
  "brand",
  "subBrand",
  "name",
  "role",
  "followers",
  "linkedin",
  "email",
  "lastContactedAt",
  "dueAt",
  "inTouch",
  "metInPerson",
  "converted",
  "promptContext",
] as const;

function dateOnly(v: string | null | undefined): string {
  return v ? v.slice(0, 10) : "";
}

// Builds the exportable CSV. The leading "# " line is a human-readable
// record of what scope this file covers — it's skipped on re-import
// (Papa.parse comments: "#") and isn't relied on for anything functional;
// the scope used on import is always whatever the user explicitly picks.
export function buildExportCsv(segmentSlug?: string): string {
  const db = getDb();
  const params: any[] = [];
  let clause = "c.archived = 0";
  if (segmentSlug) {
    clause += " AND seg.slug = ?";
    params.push(segmentSlug);
  }
  const rows = db
    .prepare(
      `SELECT c.id, seg.slug as segment, t.letter as tier, s.name as stage,
              c.brand, c.sub_brand as subBrand, c.name, c.role, c.followers, c.linkedin, c.email,
              c.last_contacted_at as lastContactedAt, c.due_at as dueAt,
              c.in_touch as inTouch, c.met_in_person as metInPerson, c.converted as converted,
              c.prompt_context as promptContext
       FROM contacts c
       JOIN segments seg ON seg.id = c.segment_id
       LEFT JOIN tiers t ON t.id = c.tier_id
       LEFT JOIN stages s ON s.id = c.stage_id
       WHERE ${clause}
       ORDER BY seg.slug, c.brand, c.name`
    )
    .all(...params) as any[];

  const data = rows.map((r) => ({
    id: r.id,
    segment: r.segment,
    tier: r.tier ?? "",
    stage: r.stage ?? "",
    brand: r.brand ?? "",
    subBrand: r.subBrand ?? "",
    name: r.name,
    role: r.role ?? "",
    followers: r.followers ?? "",
    linkedin: r.linkedin ?? "",
    email: r.email ?? "",
    lastContactedAt: dateOnly(r.lastContactedAt),
    dueAt: dateOnly(r.dueAt),
    inTouch: r.inTouch ? "TRUE" : "FALSE",
    metInPerson: r.metInPerson ? "TRUE" : "FALSE",
    converted: r.converted ? "TRUE" : "FALSE",
    promptContext: r.promptContext ?? "",
  }));

  const csv = Papa.unparse({ fields: IMPORT_EXPORT_COLUMNS as unknown as string[], data }, { newline: "\n" });
  const scopeLabel = segmentSlug ? `segment:${segmentSlug}` : "all segments";
  return `# Enchant Outreach Tracker export — scope: ${scopeLabel} — generated ${new Date().toISOString()}\n${csv}\n`;
}

export interface ParsedRow {
  rowNumber: number;
  id: number | null;
  segmentSlug: string;
  segmentId: number;
  tierId: number | null;
  stageId: number | null;
  brand: string | null;
  subBrand: string | null;
  name: string;
  role: string | null;
  followers: number | null;
  linkedin: string | null;
  email: string | null;
  lastContactedAt: string | null;
  dueAt: string | null;
  inTouch: boolean;
  metInPerson: boolean;
  converted: boolean;
  promptContext: string | null;
}

export interface ImportError {
  rowNumber: number;
  message: string;
}

function parseBool(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
}

function emptyToNull(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
}

function parseImportCsv(csvText: string): { rows: ParsedRow[]; errors: ImportError[] } {
  const segments = listSegments();
  const segmentBySlug = new Map(segments.map((s) => [s.slug, s]));
  const tiersBySegment = new Map(segments.map((s) => [s.id, getTiers(s.id)]));
  const stagesBySegment = new Map(segments.map((s) => [s.id, getStages(s.id)]));

  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true, comments: "#" });
  const errors: ImportError[] = [];
  const rows: ParsedRow[] = [];

  parsed.data.forEach((raw, idx) => {
    const rowNumber = idx + 2; // header is line 1 (comment lines don't count towards data rows)

    const idStr = emptyToNull(raw.id);
    let id: number | null = null;
    if (idStr !== null) {
      const n = Number(idStr);
      if (!Number.isInteger(n) || n <= 0) {
        errors.push({ rowNumber, message: `Invalid id "${raw.id}"` });
        return;
      }
      id = n;
    }

    const segmentSlug = emptyToNull(raw.segment);
    if (!segmentSlug) {
      errors.push({ rowNumber, message: "Missing segment" });
      return;
    }
    const segment = segmentBySlug.get(segmentSlug);
    if (!segment) {
      errors.push({ rowNumber, message: `Unknown segment "${segmentSlug}"` });
      return;
    }

    const name = emptyToNull(raw.name);
    if (!name) {
      errors.push({ rowNumber, message: "Missing name" });
      return;
    }

    let tierId: number | null = null;
    const tierLetter = emptyToNull(raw.tier);
    if (tierLetter) {
      const tier = (tiersBySegment.get(segment.id) ?? []).find((t) => t.letter.toUpperCase() === tierLetter.toUpperCase());
      if (!tier) {
        errors.push({ rowNumber, message: `Unknown tier "${tierLetter}" for segment "${segmentSlug}"` });
        return;
      }
      tierId = tier.id;
    }

    let stageId: number | null = null;
    const stageName = emptyToNull(raw.stage);
    if (stageName) {
      const stage = (stagesBySegment.get(segment.id) ?? []).find((s) => s.name.toLowerCase() === stageName.toLowerCase());
      if (!stage) {
        errors.push({ rowNumber, message: `Unknown stage "${stageName}" for segment "${segmentSlug}"` });
        return;
      }
      stageId = stage.id;
    }

    let followers: number | null = null;
    const followersStr = emptyToNull(raw.followers);
    if (followersStr) {
      const n = Number(followersStr.replace(/,/g, ""));
      if (!Number.isFinite(n) || n < 0) {
        errors.push({ rowNumber, message: `Invalid followers "${raw.followers}"` });
        return;
      }
      followers = Math.round(n);
    }

    const lastContactedAt = emptyToNull(raw.lastContactedAt);
    if (lastContactedAt && Number.isNaN(Date.parse(lastContactedAt))) {
      errors.push({ rowNumber, message: `Invalid lastContactedAt date "${raw.lastContactedAt}"` });
      return;
    }
    const dueAt = emptyToNull(raw.dueAt);
    if (dueAt && Number.isNaN(Date.parse(dueAt))) {
      errors.push({ rowNumber, message: `Invalid dueAt date "${raw.dueAt}"` });
      return;
    }

    rows.push({
      rowNumber,
      id,
      segmentSlug,
      segmentId: segment.id,
      tierId,
      stageId,
      brand: emptyToNull(raw.brand),
      subBrand: emptyToNull(raw.subBrand),
      name,
      role: emptyToNull(raw.role),
      followers,
      linkedin: emptyToNull(raw.linkedin),
      email: emptyToNull(raw.email),
      lastContactedAt,
      dueAt,
      inTouch: parseBool(raw.inTouch),
      metInPerson: parseBool(raw.metInPerson),
      converted: parseBool(raw.converted),
      promptContext: emptyToNull(raw.promptContext),
    });
  });

  const seenAt = new Map<number, number>();
  for (const r of rows) {
    if (r.id != null) {
      if (seenAt.has(r.id)) {
        errors.push({ rowNumber: r.rowNumber, message: `Duplicate id ${r.id} (also on row ${seenAt.get(r.id)})` });
      } else {
        seenAt.set(r.id, r.rowNumber);
      }
    }
  }

  return { rows, errors };
}

function fieldsEqual(a: unknown, b: unknown): boolean {
  return (a ?? null) === (b ?? null);
}

function changedFields(cur: any, r: ParsedRow): string[] {
  const changed: string[] = [];
  if (!fieldsEqual(cur.tier_id, r.tierId)) changed.push("tier");
  if (!fieldsEqual(cur.stage_id, r.stageId)) changed.push("stage");
  if (!fieldsEqual(cur.brand, r.brand)) changed.push("brand");
  if (!fieldsEqual(cur.sub_brand, r.subBrand)) changed.push("subBrand");
  if (!fieldsEqual(cur.name, r.name)) changed.push("name");
  if (!fieldsEqual(cur.role, r.role)) changed.push("role");
  if (!fieldsEqual(cur.followers, r.followers)) changed.push("followers");
  if (!fieldsEqual(cur.linkedin, r.linkedin)) changed.push("linkedin");
  if (!fieldsEqual(cur.email, r.email)) changed.push("email");
  if (!fieldsEqual(dateOnly(cur.last_contacted_at) || null, r.lastContactedAt)) changed.push("lastContactedAt");
  if (!fieldsEqual(dateOnly(cur.due_at) || null, r.dueAt)) changed.push("dueAt");
  if (!!cur.in_touch !== r.inTouch) changed.push("inTouch");
  if (!!cur.met_in_person !== r.metInPerson) changed.push("metInPerson");
  if (!!cur.converted !== r.converted) changed.push("converted");
  if (!fieldsEqual(cur.prompt_context, r.promptContext)) changed.push("promptContext");
  return changed;
}

export interface DeleteSummary {
  id: number;
  name: string;
  segmentSlug: string;
  brand: string | null;
}

export interface UpdateSummary {
  row: ParsedRow;
  changedFields: string[];
}

export interface ImportDiff {
  toCreate: ParsedRow[];
  toUpdate: UpdateSummary[];
  toDelete: DeleteSummary[];
  errors: ImportError[];
  existingInScope: number;
}

// scope = null means "all segments"; otherwise a segment slug. Scope bounds
// which existing contacts are even candidates for deletion — a row missing
// from the file only deletes a contact that was in scope to begin with, so
// a segment-scoped import can never touch contacts in other segments.
export function computeImportDiff(csvText: string, scope: string | null): ImportDiff {
  const { rows, errors } = parseImportCsv(csvText);
  const db = getDb();

  const params: any[] = [];
  let scopeClause = "c.archived = 0";
  if (scope) {
    scopeClause += " AND seg.slug = ?";
    params.push(scope);
  }
  const existing = db
    .prepare(`SELECT c.*, seg.slug as segment_slug FROM contacts c JOIN segments seg ON seg.id = c.segment_id WHERE ${scopeClause}`)
    .all(...params) as any[];
  const existingById = new Map(existing.map((c) => [c.id, c]));

  for (const r of rows) {
    if (r.id == null) continue;
    if (!existingById.has(r.id)) {
      const anywhere = db.prepare("SELECT id FROM contacts WHERE id = ?").get(r.id);
      errors.push({
        rowNumber: r.rowNumber,
        message: anywhere ? `id ${r.id} is outside the selected scope` : `id ${r.id} does not exist`,
      });
      continue;
    }
    const cur = existingById.get(r.id);
    if (cur.segment_id !== r.segmentId) {
      errors.push({ rowNumber: r.rowNumber, message: `Row changes segment for id ${r.id} — moving segments via import isn't supported` });
    }
  }

  const fileIds = new Set(rows.filter((r) => r.id != null).map((r) => r.id as number));

  const toCreate = rows.filter((r) => r.id == null);
  const toUpdate: UpdateSummary[] = [];
  for (const r of rows) {
    if (r.id == null) continue;
    const cur = existingById.get(r.id);
    if (!cur || cur.segment_id !== r.segmentId) continue; // already an error above
    const changed = changedFields(cur, r);
    if (changed.length > 0) toUpdate.push({ row: r, changedFields: changed });
  }

  const toDelete: DeleteSummary[] = existing
    .filter((c) => !fileIds.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, segmentSlug: c.segment_slug, brand: c.brand }));

  return { toCreate, toUpdate, toDelete, errors, existingInScope: existing.length };
}

export function applyImportDiff(csvText: string, scope: string | null): ImportDiff {
  const diff = computeImportDiff(csvText, scope);
  if (diff.errors.length > 0) {
    throw new Error(`Cannot apply: ${diff.errors.length} error(s) in the file`);
  }

  const db = getDb();
  db.exec("BEGIN");
  try {
    for (const c of diff.toDelete) deleteContact(c.id);
    for (const { row } of diff.toUpdate) {
      updateContact(row.id as number, {
        tierId: row.tierId,
        stageId: row.stageId,
        brand: row.brand,
        subBrand: row.subBrand,
        name: row.name,
        role: row.role,
        followers: row.followers,
        linkedin: row.linkedin,
        email: row.email,
        lastContactedAt: row.lastContactedAt,
        dueAt: row.dueAt,
        inTouch: row.inTouch,
        metInPerson: row.metInPerson,
        converted: row.converted,
        promptContext: row.promptContext,
      });
    }
    for (const row of diff.toCreate) {
      createContact({
        segmentId: row.segmentId,
        tierId: row.tierId,
        stageId: row.stageId,
        brand: row.brand,
        subBrand: row.subBrand,
        name: row.name,
        role: row.role,
        followers: row.followers,
        linkedin: row.linkedin,
        email: row.email,
        lastContactedAt: row.lastContactedAt,
        dueAt: row.dueAt,
        inTouch: row.inTouch,
        metInPerson: row.metInPerson,
        converted: row.converted,
        promptContext: row.promptContext,
      });
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return diff;
}
