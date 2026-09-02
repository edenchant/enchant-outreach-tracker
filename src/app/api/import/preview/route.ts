import { NextRequest, NextResponse } from "next/server";
import { computeImportDiff } from "@/lib/import-export";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const scope: string | null = body.scope || null;
  const csv: string = body.csv ?? "";
  try {
    const diff = computeImportDiff(csv, scope);
    return NextResponse.json(diff);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
