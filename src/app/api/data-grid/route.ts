import { NextRequest, NextResponse } from "next/server";
import { listAllContacts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const result = listAllContacts({
    segmentSlug: sp.get("segment") ?? undefined,
    tierLetter: sp.get("tier") ?? undefined,
    search: sp.get("search") ?? undefined,
    sortBy: sp.get("sortBy") ?? undefined,
    sortDir: (sp.get("sortDir") as "asc" | "desc" | null) ?? undefined,
    page: sp.get("page") ? Number(sp.get("page")) : undefined,
    pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
  });
  return NextResponse.json(result);
}
