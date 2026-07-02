import { NextRequest, NextResponse } from "next/server";
import { getContact } from "@/lib/queries";
import { draftMessage, type DraftKind } from "@/lib/claude";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contact = getContact(Number(id));
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const kind: DraftKind = body.kind === "linkedin" ? "linkedin" : "email";

  try {
    const draft = await draftMessage({ contact, kind });
    return NextResponse.json({ draft });
  } catch (e) {
    const message = (e as Error).message;
    if (message.includes("ANTHROPIC_API_KEY")) {
      return NextResponse.json(
        { error: "AI drafting isn't configured yet — add ANTHROPIC_API_KEY to this deployment's environment variables." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
