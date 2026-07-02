import { listAllContacts, listSegments } from "@/lib/queries";
import DataGrid from "@/components/DataGrid";

export const dynamic = "force-dynamic";

export default async function DataGridPage() {
  const segments = listSegments();
  const initial = listAllContacts({ page: 1, pageSize: 100 });

  return <DataGrid segments={segments} initialRows={initial.rows} initialTotal={initial.total} />;
}
