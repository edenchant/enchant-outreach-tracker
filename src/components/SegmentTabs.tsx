import Link from "next/link";
import type { Segment } from "@/lib/types";

export default function SegmentTabs({ segments, activeSlug }: { segments: Segment[]; activeSlug: string }) {
  return (
    <div className="segment-tabs">
      <Link href="/" className={activeSlug === "" ? "active" : ""}>
        All
      </Link>
      {segments.map((s) => (
        <Link key={s.id} href={`/segments/${s.slug}`} className={s.slug === activeSlug ? "active" : ""}>
          {s.name}
        </Link>
      ))}
      <Link href="/segments/new" className="add-segment">
        + New segment
      </Link>
    </div>
  );
}
