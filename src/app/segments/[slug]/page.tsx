import { notFound } from "next/navigation";
import { getSegmentBySlug, getStages, getStats, getTiers, listContacts, listSegments } from "@/lib/queries";
import QueueView from "@/components/QueueView";

export const dynamic = "force-dynamic";

export default async function SegmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const segment = getSegmentBySlug(slug);
  if (!segment) notFound();

  const tiers = getTiers(segment.id);
  const stages = getStages(segment.id);
  const contacts = listContacts({ segmentId: segment.id });
  const stats = getStats(segment.id);
  const allSegments = listSegments();

  return (
    <QueueView
      allSegments={allSegments}
      segment={segment}
      tiers={tiers}
      stages={stages}
      initialContacts={contacts}
      initialStats={stats}
    />
  );
}
