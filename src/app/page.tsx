import { redirect } from "next/navigation";
import { getGlobalStats, getGlobalTopToday, listSegments } from "@/lib/queries";
import GlobalHome from "@/components/GlobalHome";

export const dynamic = "force-dynamic";

export default function Home() {
  const segments = listSegments();
  if (segments.length === 0) {
    redirect("/segments/new");
  }

  const stats = getGlobalStats();
  const topToday = getGlobalTopToday(10);

  return <GlobalHome segments={segments} initialStats={stats} initialTopToday={topToday} />;
}
