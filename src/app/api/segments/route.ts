import { NextRequest, NextResponse } from "next/server";
import { createSegment, listSegments } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ segments: listSegments() });
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = (body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const slug = slugify(name);
  if (!slug) {
    return NextResponse.json({ error: "Name must contain letters or numbers" }, { status: 400 });
  }
  try {
    const segment = createSegment(name, slug);
    return NextResponse.json({ segment }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A segment with that name already exists" }, { status: 409 });
  }
}
