import { NextResponse } from "next/server";
import { snoozeContact } from "@/lib/queries";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const contact = snoozeContact(Number(id));
    return NextResponse.json({ contact });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
