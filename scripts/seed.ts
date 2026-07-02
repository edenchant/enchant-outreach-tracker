import fs from "node:fs";
import path from "node:path";
import { getDb } from "../src/lib/db";
import { createSegment, deleteSegment, getSegmentBySlug, getStages, getTiers, DEFAULT_TIERS } from "../src/lib/queries";
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
  last: string | null;
  due: string | null;
  priority: number | null;
  promptContext: string | null;
}

const SEGMENTS: Array<{ name: string; slug: string; file: string }> = [
  { name: "In-House", slug: "in-house", file: "in-house.json" },
  { name: "Agency", slug: "agency", file: "agency.json" },
  { name: "Top 120", slug: "top-120", file: "top-120.json" },
  { name: "Non-120", slug: "non-120", file: "non-120.json" },
  { name: "Reactive", slug: "reactive", file: "reactive.json" },
  { name: "Other Brand", slug: "other-brand", file: "other-brand.json" },
];

function seedSegment(name: string, slug: string, file: string) {
  const db = getDb();

  const existing = getSegmentBySlug(slug);
  if (existing) {
    const tierCount = getTiers(existing.id).length;
    if (tierCount >= DEFAULT_TIERS.length) {
      console.log(`Segment "${name}" already seeded on the current pipeline, skipping.`);
      return;
    }
    console.log(`Segment "${name}" found on an old pipeline shape, rebuilding.`);
    deleteSegment(existing.id);
  }

  const segment = createSegment(name, slug);
  const tiers = getTiers(segment.id);
  const stages = getStages(segment.id);
  const tierByLetter = new Map(tiers.map((t) => [t.letter, t]));
  const stageByName = new Map(stages.map((s) => [s.name, s]));

  const rawPath = path.join(__dirname, "seed-data", file);
  const raw: RawContact[] = JSON.parse(fs.readFileSync(rawPath, "utf-8"));

  const insert = db.prepare(
    `INSERT INTO contacts (segment_id, tier_id, stage_id, brand, sub_brand, name, role, followers, linkedin, email, last_contacted_at, due_at, priority_score, prompt_context)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let count = 0;
  for (const c of raw) {
    const tierLetter = c.tier ? c.tier.charAt(0).toUpperCase() : null;
    const tier = tierLetter ? tierByLetter.get(tierLetter) : null;
    const stage = c.action ? stageByName.get(c.action) : null;

    const priority = computePriority(c.followers, tier?.weight ?? 0, stage?.weight ?? 0);

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
      priority,
      c.promptContext ?? null
    );
    count++;
  }

  console.log(`Seeded segment "${name}" with ${count} contacts.`);
}

function main() {
  for (const s of SEGMENTS) {
    seedSegment(s.name, s.slug, s.file);
  }
}

main();
