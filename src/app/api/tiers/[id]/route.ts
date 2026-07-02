import { NextRequest, NextResponse } from "next/server";
import { updateTier } from "@/lib/queries";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const tier = updateTier(Number(id), {
      label: body.label,
      weight: body.weight !== undefined ? Number(body.weight) : undefined,
      sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
    });
    return NextResponse.json({ tier });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
