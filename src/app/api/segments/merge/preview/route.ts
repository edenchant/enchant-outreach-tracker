import { NextRequest, NextResponse } from "next/server";
import { previewSegmentMerge } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const preview = previewSegmentMerge(body.from, body.to);
    return NextResponse.json(preview);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
