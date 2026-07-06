import { redirect } from "next/navigation";
import { getGlobalStats, getGlobalTopToday, listAllContacts, listSegments } from "@/lib/queries";
import GlobalHome from "@/components/GlobalHome";

export const dynamic = "force-dynamic";

export default function Home() {
  const segments = listSegments();
  if (segments.length === 0) {
    redirect("/segments/new");
  }

  const stats = getGlobalStats();
  const topToday = getGlobalTopToday(10);
  const grid = listAllContacts({ page: 1, pageSize: 100 });

  return (
    <GlobalHome
      segments={segments}
      initialStats={stats}
      initialTopToday={topToday}
      initialGridRows={grid.rows}
      initialGridTotal={grid.total}
    />
  );
}
