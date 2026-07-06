import { NextRequest, NextResponse } from "next/server";
import { dismissBrandHistoryEntry, updateBrandHistoryEntry } from "@/lib/queries";

export const dynamic = "force-dynamic";

const EVENT_TYPES = ["Brand Refresh / Rebrand", "New Head of Brand", "New CMO", "Major ATL Campaign", "Other"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.brand !== undefined && !body.brand?.trim()) {
    return NextResponse.json({ error: "Brand is required" }, { status: 400 });
  }
  if (body.eventType !== undefined && !EVENT_TYPES.includes(body.eventType)) {
    return NextResponse.json({ error: "A valid event type is required" }, { status: 400 });
  }
  if (body.date !== undefined && !body.date) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }

  try {
    const entry = updateBrandHistoryEntry(Number(id), {
      brand: body.brand?.trim(),
      eventType: body.eventType,
      date: body.date,
      note: body.note !== undefined ? body.note?.trim() || null : undefined,
    });
    return NextResponse.json({ entry });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  dismissBrandHistoryEntry(Number(id));
  return NextResponse.json({ ok: true });
}
