import { NextRequest, NextResponse } from "next/server";
import { updateStage } from "@/lib/queries";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const stage = updateStage(Number(id), {
      name: body.name,
      intervalDays: body.intervalDays !== undefined ? Number(body.intervalDays) : undefined,
      weight: body.weight !== undefined ? Number(body.weight) : undefined,
      sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
      isTerminal: body.isTerminal !== undefined ? Boolean(body.isTerminal) : undefined,
    });
    return NextResponse.json({ stage });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
