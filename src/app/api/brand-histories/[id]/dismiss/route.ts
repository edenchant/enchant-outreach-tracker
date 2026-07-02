import { NextResponse } from "next/server";
import { dismissBrandHistoryEntry } from "@/lib/queries";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  dismissBrandHistoryEntry(Number(id));
  return NextResponse.json({ ok: true });
}
