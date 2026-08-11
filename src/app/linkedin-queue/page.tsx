import { getLinkedInAddsThisWeek, getSuggestedLinkedInAdds, listSegments, WEEKLY_LINKEDIN_ADD_LIMIT } from "@/lib/queries";
import LinkedInQueueView from "@/components/LinkedInQueueView";

export const dynamic = "force-dynamic";

export default function LinkedInQueuePage() {
  const segments = listSegments();
  const addedThisWeek = getLinkedInAddsThisWeek();
  const remaining = Math.max(WEEKLY_LINKEDIN_ADD_LIMIT - addedThisWeek, 0);
  const suggestions = getSuggestedLinkedInAdds(remaining);

  return (
    <LinkedInQueueView
      segments={segments}
      initialSuggestions={suggestions}
      initialAddedThisWeek={addedThisWeek}
      weeklyLimit={WEEKLY_LINKEDIN_ADD_LIMIT}
    />
  );
}
