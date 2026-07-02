import { NextRequest, NextResponse } from "next/server";
import { deleteContact, getContact, updateContact } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contact = getContact(Number(id));
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  return NextResponse.json({ contact });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const contact = updateContact(Number(id), body);
    return NextResponse.json({ contact });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteContact(Number(id));
  return NextResponse.json({ ok: true });
}
