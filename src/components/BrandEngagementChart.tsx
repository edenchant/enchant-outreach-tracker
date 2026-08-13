"use client";

import { useState } from "react";
import type { BrandEngagementRow, Segment } from "@/lib/types";
import { fetchBrandEngagement } from "@/lib/api-client";

function BarRow({ row, tone }: { row: BrandEngagementRow; tone: "pos" | "neg" }) {
  const pct = Math.round(row.rate * 100);
  return (
    <div className="brand-bar-row">
      <div className="brand-bar-label">
        <span className="brand-bar-name">{row.brand}</span>
        <span className="brand-bar-count">
          {row.engaged}/{row.total} · {pct}%
        </span>
      </div>
      <div className="brand-bar-track">
        <div className={`brand-bar-fill ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function BrandEngagementChart({
  segments,
  initialTop,
  initialBottom,
  minContacts,
}: {
  segments: Segment[];
  initialTop: BrandEngagementRow[];
  initialBottom: BrandEngagementRow[];
  minContacts: number;
}) {
  const [segmentFilter, setSegmentFilter] = useState("");
  const [top, setTop] = useState(initialTop);
  const [bottom, setBottom] = useState(initialBottom);
  const [loading, setLoading] = useState(false);

  async function handleSegmentChange(slug: string) {
    setSegmentFilter(slug);
    setLoading(true);
    try {
      const data = await fetchBrandEngagement(slug || undefined);
      setTop(data.top);
      setBottom(data.bottom);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="brand-engagement">
      <div className="brand-engagement-header">
        <h2>Brand Engagement</h2>
        <span className="top-ten-sub">
          % of contacts marked in touch or converted, per brand — brands with fewer than {minContacts} contacts are
          excluded
        </span>
      </div>

      <div className="controls">
        <select value={segmentFilter} onChange={(e) => handleSegmentChange(e.target.value)}>
          <option value="">All segments</option>
          {segments.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        {loading && <div className="history-panel">Loading…</div>}
      </div>

      <div className="brand-engagement-cols">
        <div>
          <h3 className="brand-bar-heading">Top 10</h3>
          {top.length > 0 ? (
            <div className="brand-bar-list">
              {top.map((row) => (
                <BarRow key={row.brand} row={row} tone="pos" />
              ))}
            </div>
          ) : (
            <div className="empty">No brands meet the minimum contact count.</div>
          )}
        </div>
        <div>
          <h3 className="brand-bar-heading">Bottom 10</h3>
          {bottom.length > 0 ? (
            <div className="brand-bar-list">
              {bottom.map((row) => (
                <BarRow key={row.brand} row={row} tone="neg" />
              ))}
            </div>
          ) : (
            <div className="empty">No brands meet the minimum contact count.</div>
          )}
        </div>
      </div>
    </div>
  );
}
