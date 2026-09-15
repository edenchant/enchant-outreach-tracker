import { NextRequest, NextResponse } from "next/server";
import { applySegmentMerge } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const result = applySegmentMerge(body.from, body.to);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
