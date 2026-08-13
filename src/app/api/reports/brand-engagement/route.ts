import { NextRequest, NextResponse } from "next/server";
import { getBrandEngagementReport } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const segment = searchParams.get("segment") || undefined;
  const { top, bottom } = getBrandEngagementReport(segment);
  return NextResponse.json({ top, bottom });
}
