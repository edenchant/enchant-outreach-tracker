import { NextRequest, NextResponse } from "next/server";
import { createBrandHistoryEntry, listBrandHistories } from "@/lib/queries";

export const dynamic = "force-dynamic";

const EVENT_TYPES = ["Brand Refresh / Rebrand", "New Head of Brand", "New CMO", "Major ATL Campaign", "Other"];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const entries = listBrandHistories({
    brand: sp.get("brand") ?? undefined,
    status: (sp.get("status") as "confirmed" | "pending" | null) ?? undefined,
  });
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body?.brand?.trim()) return NextResponse.json({ error: "Brand is required" }, { status: 400 });
  if (!EVENT_TYPES.includes(body?.eventType)) return NextResponse.json({ error: "A valid event type is required" }, { status: 400 });
  if (!body?.date) return NextResponse.json({ error: "Date is required" }, { status: 400 });

  const entry = createBrandHistoryEntry({
    brand: body.brand.trim(),
    eventType: body.eventType,
    date: body.date,
    note: body.note?.trim() || null,
    source: "manual",
  });

  return NextResponse.json({ entry }, { status: 201 });
}
