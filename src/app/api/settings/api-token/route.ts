import { NextResponse } from "next/server";
import { generateApiToken, getApiTokenStatus } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getApiTokenStatus());
}

export async function POST() {
  const token = generateApiToken();
  return NextResponse.json({ token });
}
