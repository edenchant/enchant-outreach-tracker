import { NextRequest, NextResponse } from "next/server";
import { buildExportCsv } from "@/lib/import-export";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const segment = searchParams.get("segment") || undefined;
  const csv = buildExportCsv(segment);
  const scopeLabel = segment ?? "all";
  const filename = `contacts-${scopeLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
