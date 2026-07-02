import { listSegments } from "@/lib/queries";
import NewSegmentForm from "@/components/NewSegmentForm";

export const dynamic = "force-dynamic";

export default function NewSegmentPage() {
  const segments = listSegments();
  return <NewSegmentForm existingSegments={segments} />;
}
