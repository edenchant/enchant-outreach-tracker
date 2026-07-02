import { NextResponse } from "next/server";
import { getLastScanSummary, runScanNow } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ summary: getLastScanSummary() });
}

export async function POST() {
  if (!process.env.NEWSDATA_API_KEY) {
    return NextResponse.json(
      { error: "News scanning isn't configured yet — add NEWSDATA_API_KEY to this deployment's environment variables." },
      { status: 503 }
    );
  }
  try {
    const result = await runScanNow();
    return NextResponse.json({ result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
