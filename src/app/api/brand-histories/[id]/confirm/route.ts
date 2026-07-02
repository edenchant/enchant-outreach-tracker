import { NextResponse } from "next/server";
import { confirmBrandHistoryEntry } from "@/lib/queries";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const entry = confirmBrandHistoryEntry(Number(id));
    return NextResponse.json({ entry });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
