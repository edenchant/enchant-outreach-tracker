import { listBrandHistories } from "@/lib/queries";
import { getLastScanSummary } from "@/lib/scheduler";
import BrandHistoriesView from "@/components/BrandHistoriesView";

export const dynamic = "force-dynamic";

export default function BrandHistoriesPage() {
  const entries = listBrandHistories();
  const summary = getLastScanSummary();

  return <BrandHistoriesView initialEntries={entries} initialSummary={summary} />;
}
