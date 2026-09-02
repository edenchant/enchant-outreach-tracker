import { listSegments } from "@/lib/queries";
import DataToolsView from "@/components/DataToolsView";

export const dynamic = "force-dynamic";

export default function DataToolsPage() {
  const segments = listSegments();
  return <DataToolsView segments={segments} />;
}
