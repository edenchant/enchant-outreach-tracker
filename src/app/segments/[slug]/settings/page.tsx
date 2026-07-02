import { notFound } from "next/navigation";
import { getSegmentBySlug, getStages, getTiers } from "@/lib/queries";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const segment = getSegmentBySlug(slug);
  if (!segment) notFound();

  const tiers = getTiers(segment.id);
  const stages = getStages(segment.id);

  return <SettingsForm segment={segment} initialTiers={tiers} initialStages={stages} />;
}
