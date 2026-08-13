import { getWeeklyOutreachReport, listSegments } from "@/lib/queries";
import ReportsView from "@/components/ReportsView";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  const segments = listSegments();
  const weeks = getWeeklyOutreachReport();

  return <ReportsView segments={segments} weeks={weeks} />;
}
