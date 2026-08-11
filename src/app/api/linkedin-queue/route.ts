import { NextResponse } from "next/server";
import { getLinkedInAddsThisWeek, getSuggestedLinkedInAdds, WEEKLY_LINKEDIN_ADD_LIMIT } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const addedThisWeek = getLinkedInAddsThisWeek();
  const remaining = Math.max(WEEKLY_LINKEDIN_ADD_LIMIT - addedThisWeek, 0);
  const suggestions = getSuggestedLinkedInAdds(remaining);
  return NextResponse.json({ suggestions, addedThisWeek, weeklyLimit: WEEKLY_LINKEDIN_ADD_LIMIT });
}
