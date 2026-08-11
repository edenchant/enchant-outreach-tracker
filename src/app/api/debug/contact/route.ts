import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Temporary read-only diagnostic endpoint for tracking down why contacts
// reappear in the LinkedIn queue after being marked. Returns nothing that
// isn't already visible elsewhere in the app. Safe to remove once the bug
// is confirmed fixed.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  const id = searchParams.get("id");

  const db = getDb();
  let rows;
  if (id) {
    rows = db
      .prepare(
        `SELECT c.id, c.name, c.segment_id, seg.slug as segment_slug, c.stage_id, s.name as stage_name, s.sort_order as stage_sort_order, s.is_terminal,
                c.due_at, c.last_contacted_at, c.updated_at, c.archived
         FROM contacts c
         JOIN segments seg ON seg.id = c.segment_id
         LEFT JOIN stages s ON s.id = c.stage_id
         WHERE c.id = ?`
      )
      .all(Number(id));
  } else if (name) {
    rows = db
      .prepare(
        `SELECT c.id, c.name, c.segment_id, seg.slug as segment_slug, c.stage_id, s.name as stage_name, s.sort_order as stage_sort_order, s.is_terminal,
                c.due_at, c.last_contacted_at, c.updated_at, c.archived
         FROM contacts c
         JOIN segments seg ON seg.id = c.segment_id
         LEFT JOIN stages s ON s.id = c.stage_id
         WHERE c.name LIKE ?`
      )
      .all(`%${name}%`);
  } else {
    return NextResponse.json({ error: "Pass ?name= or ?id=" }, { status: 400 });
  }

  return NextResponse.json({ now: new Date().toISOString(), rows });
}
