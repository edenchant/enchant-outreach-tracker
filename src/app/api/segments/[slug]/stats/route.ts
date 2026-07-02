import { NextResponse } from "next/server";
import { getSegmentBySlug, getStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const segment = getSegmentBySlug(slug);
  if (!segment) return NextResponse.json({ error: "Segment not found" }, { status: 404 });
  return NextResponse.json({ stats: getStats(segment.id) });
}
