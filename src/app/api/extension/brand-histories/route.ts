import { NextRequest, NextResponse } from "next/server";
import { createBrandHistoryEntry, verifyApiToken } from "@/lib/queries";

export const dynamic = "force-dynamic";

const EVENT_TYPES = ["New CMO", "Brand Refresh / Rebrand", "Major ATL Campaign", "Other"];

// Capture endpoint for the Sales Navigator browser extension — the only
// route in the app gated by a bearer token, since it's the only one called
// from outside Ed's own browser session (a background service worker,
// see extension/README.md). Source and status are always set here, never
// trusted from the request body: extension captures are tagged
// 'sales_nav_feed' and land confirmed, since Ed has already reviewed the
// entry in the in-page popup before it's sent — the same bar as typing it
// into the manual add-entry form, not the "pending" bar used for
// unreviewed automated news-scan hits.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!verifyApiToken(token)) {
    return NextResponse.json({ error: "Missing or invalid API token" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (!body?.brand?.trim()) return NextResponse.json({ error: "Brand is required" }, { status: 400 });
  if (!EVENT_TYPES.includes(body?.eventType)) return NextResponse.json({ error: "A valid event type is required" }, { status: 400 });
  if (!body?.date) return NextResponse.json({ error: "Date is required" }, { status: 400 });

  const entry = createBrandHistoryEntry({
    brand: body.brand.trim(),
    eventType: body.eventType,
    date: body.date,
    note: body.note?.trim() || null,
    source: "sales_nav_feed",
    status: "confirmed",
  });

  return NextResponse.json({ entry }, { status: 201 });
}
