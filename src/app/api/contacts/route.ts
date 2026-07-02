import { NextRequest, NextResponse } from "next/server";
import { createContact, listContacts, getSegmentBySlug } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const slug = sp.get("segment");
  if (!slug) return NextResponse.json({ error: "segment is required" }, { status: 400 });
  const segment = getSegmentBySlug(slug);
  if (!segment) return NextResponse.json({ error: "Segment not found" }, { status: 404 });

  const status = sp.get("status") as "overdue" | "today" | "upcoming" | null;

  const contacts = listContacts({
    segmentId: segment.id,
    search: sp.get("search") ?? undefined,
    tierId: sp.get("tier") ? Number(sp.get("tier")) : undefined,
    stageId: sp.get("stage") ? Number(sp.get("stage")) : undefined,
    status: status ?? undefined,
  });

  return NextResponse.json({ contacts });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const slug = body?.segmentSlug;
  if (!slug) return NextResponse.json({ error: "segmentSlug is required" }, { status: 400 });
  const segment = getSegmentBySlug(slug);
  if (!segment) return NextResponse.json({ error: "Segment not found" }, { status: 404 });
  if (!body?.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const contact = createContact({
    segmentId: segment.id,
    tierId: body.tierId ?? null,
    stageId: body.stageId ?? null,
    brand: body.brand ?? null,
    subBrand: body.subBrand ?? null,
    name: body.name.trim(),
    role: body.role ?? null,
    followers: body.followers ?? null,
    linkedin: body.linkedin ?? null,
    email: body.email ?? null,
    lastContactedAt: body.lastContactedAt ?? null,
    dueAt: body.dueAt ?? null,
  });

  return NextResponse.json({ contact }, { status: 201 });
}
