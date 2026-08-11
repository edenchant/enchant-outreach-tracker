import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { computePriority, relationshipMultiplier } from "./priority";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "app.db");

declare global {
  var __outreachDb: DatabaseSync | undefined;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  segment_id INTEGER NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  letter TEXT NOT NULL,
  label TEXT NOT NULL,
  weight REAL NOT NULL,
  sort_order INTEGER NOT NULL,
  UNIQUE(segment_id, letter)
);

CREATE TABLE IF NOT EXISTS stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  segment_id INTEGER NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  interval_days REAL NOT NULL,
  weight REAL NOT NULL,
  is_terminal INTEGER NOT NULL DEFAULT 0,
  UNIQUE(segment_id, name)
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  segment_id INTEGER NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  tier_id INTEGER REFERENCES tiers(id),
  stage_id INTEGER REFERENCES stages(id),
  brand TEXT,
  sub_brand TEXT,
  name TEXT NOT NULL,
  role TEXT,
  followers INTEGER,
  linkedin TEXT,
  email TEXT,
  last_contacted_at TEXT,
  due_at TEXT,
  priority_score REAL NOT NULL DEFAULT 0,
  prompt_context TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS outreach_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  from_stage_id INTEGER REFERENCES stages(id),
  to_stage_id INTEGER REFERENCES stages(id),
  prev_due_at TEXT,
  prev_last_contacted_at TEXT,
  prev_priority_score REAL,
  type TEXT NOT NULL DEFAULT 'contacted',
  contacted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brand_histories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  event_type TEXT NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  article_url TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_segment ON contacts(segment_id);
CREATE INDEX IF NOT EXISTS idx_contacts_due ON contacts(due_at);
CREATE INDEX IF NOT EXISTS idx_contacts_priority ON contacts(priority_score);
CREATE INDEX IF NOT EXISTS idx_events_contact ON outreach_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_brand_histories_brand ON brand_histories(brand);
CREATE INDEX IF NOT EXISTS idx_brand_histories_date ON brand_histories(date);
`;

function migrate(db: DatabaseSync) {
  const contactColumns = db.prepare("PRAGMA table_info(contacts)").all() as Array<{ name: string }>;
  const hasPromptContext = contactColumns.some((c) => c.name === "prompt_context");
  if (!hasPromptContext) {
    db.exec("ALTER TABLE contacts ADD COLUMN prompt_context TEXT;");
  }
  const hasInTouch = contactColumns.some((c) => c.name === "in_touch");
  if (!hasInTouch) {
    db.exec("ALTER TABLE contacts ADD COLUMN in_touch INTEGER NOT NULL DEFAULT 0;");
  }
  const hasMetInPerson = contactColumns.some((c) => c.name === "met_in_person");
  if (!hasMetInPerson) {
    db.exec("ALTER TABLE contacts ADD COLUMN met_in_person INTEGER NOT NULL DEFAULT 0;");
  }
  const hasConverted = contactColumns.some((c) => c.name === "converted");
  if (!hasConverted) {
    db.exec("ALTER TABLE contacts ADD COLUMN converted INTEGER NOT NULL DEFAULT 0;");
  }
  const eventColumns = db.prepare("PRAGMA table_info(outreach_events)").all() as Array<{ name: string }>;
  const hasType = eventColumns.some((c) => c.name === "type");
  if (!hasType) {
    db.exec("ALTER TABLE outreach_events ADD COLUMN type TEXT NOT NULL DEFAULT 'contacted';");
  }

  backfillNullFollowerPriorities(db);
}

// Contacts with no recorded follower count previously scored exactly 0
// (regardless of tier/stage) and never surfaced in any priority-ordered
// view. computePriority() now defaults missing followers to a typical
// LinkedIn user's count instead of 0 — this brings existing rows in line
// with that, every startup. Scoped to followers IS NULL and cheap even for
// thousands of rows, so it's safe to just re-run rather than track whether
// it's "already happened" with a separate flag.
function backfillNullFollowerPriorities(db: DatabaseSync) {
  const rows = db
    .prepare(
      `SELECT c.id, c.followers, c.in_touch, c.converted,
        COALESCE(t.weight, 0) as tier_weight, COALESCE(s.weight, 0) as stage_weight
       FROM contacts c
       LEFT JOIN tiers t ON t.id = c.tier_id
       LEFT JOIN stages s ON s.id = c.stage_id
       WHERE c.followers IS NULL`
    )
    .all() as Array<{ id: number; followers: number | null; in_touch: number; converted: number; tier_weight: number; stage_weight: number }>;
  if (rows.length === 0) return;
  const update = db.prepare("UPDATE contacts SET priority_score = ? WHERE id = ?");
  for (const row of rows) {
    const mult = relationshipMultiplier(!!row.in_touch, !!row.converted);
    const priority = computePriority(row.followers, row.tier_weight, row.stage_weight, mult);
    update.run(priority, row.id);
  }
}

function createDb(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

export function getDb(): DatabaseSync {
  if (!global.__outreachDb) {
    global.__outreachDb = createDb();
  }
  return global.__outreachDb;
}
