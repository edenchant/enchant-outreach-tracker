import fs from "node:fs";
import path from "node:path";
import { getDb } from "../src/lib/db";
import { createSegment, getStages, getTiers } from "../src/lib/queries";
import { computePriority } from "../src/lib/priority";

interface RawContact {
  tier: string | null;
  brand: string | null;
  subBrand: string | null;
  name: string;
  role: string | null;
  followers: number | null;
  linkedin: string | null;
  email: string | null;
  action: string | null;
  timeToNext: number | null;
  dayCheck: string | null;
  last: string | null;
  priority: number | null;
  due: string | null;
}

const STAGE_NAME_MAP: Record<string, string> = {
  "LinkedIn Add": "LinkedIn Add",
  "First Reach": "First Reach",
  "Second Reach": "Second Reach",
  "Third Reach": "Third Reach",
};

function main() {
  const db = getDb();

  const existing = db.prepare("SELECT * FROM segments WHERE slug = ?").get("in-house");
  if (existing) {
    console.log("In-House segment already seeded, skipping.");
    return;
  }

  const segment = createSegment("In-House", "in-house");
  const tiers = getTiers(segment.id);
  const stages = getStages(segment.id);
  const tierByLetter = new Map(tiers.map((t) => [t.letter, t]));
  const stageByName = new Map(stages.map((s) => [s.name, s]));

  const rawPath = path.join(__dirname, "seed-data", "in-house.json");
  const raw: RawContact[] = JSON.parse(fs.readFileSync(rawPath, "utf-8"));

  const insert = db.prepare(
    `INSERT INTO contacts (segment_id, tier_id, stage_id, brand, sub_brand, name, role, followers, linkedin, email, last_contacted_at, due_at, priority_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let count = 0;
  for (const c of raw) {
    const tierLetter = c.tier ? c.tier.charAt(0) : null;
    const tier = tierLetter ? tierByLetter.get(tierLetter) : null;
    const stageName = c.action ? STAGE_NAME_MAP[c.action] : null;
    const stage = stageName ? stageByName.get(stageName) : null;

    const priority = tier && stage ? computePriority(c.followers, tier.weight, stage.weight) : c.priority ?? 0;

    insert.run(
      segment.id,
      tier?.id ?? null,
      stage?.id ?? null,
      c.brand ?? null,
      c.subBrand ?? null,
      c.name,
      c.role ?? null,
      c.followers ?? null,
      c.linkedin ?? null,
      c.email ?? null,
      c.last ?? null,
      c.due ?? null,
      priority
    );
    count++;
  }

  console.log(`Seeded segment "In-House" with ${count} contacts.`);
}

main();
