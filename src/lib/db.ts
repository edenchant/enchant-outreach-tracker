import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

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
  const eventColumns = db.prepare("PRAGMA table_info(outreach_events)").all() as Array<{ name: string }>;
  const hasType = eventColumns.some((c) => c.name === "type");
  if (!hasType) {
    db.exec("ALTER TABLE outreach_events ADD COLUMN type TEXT NOT NULL DEFAULT 'contacted';");
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
