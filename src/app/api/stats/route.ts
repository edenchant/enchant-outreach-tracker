import { NextResponse } from "next/server";
import { getGlobalStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ stats: getGlobalStats() });
}
