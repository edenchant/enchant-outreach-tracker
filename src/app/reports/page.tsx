import { BRAND_ENGAGEMENT_MIN_CONTACTS, getBrandEngagementReport, getWeeklyOutreachReport, listSegments } from "@/lib/queries";
import ReportsView from "@/components/ReportsView";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  const segments = listSegments();
  const weeks = getWeeklyOutreachReport();
  const brandEngagement = getBrandEngagementReport();

  return (
    <ReportsView
      segments={segments}
      weeks={weeks}
      brandEngagement={brandEngagement}
      minContacts={BRAND_ENGAGEMENT_MIN_CONTACTS}
    />
  );
}
