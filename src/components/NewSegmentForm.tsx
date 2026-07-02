"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Segment } from "@/lib/types";
import { createSegment } from "@/lib/api-client";
import SegmentTabs from "./SegmentTabs";

export default function NewSegmentForm({ existingSegments }: { existingSegments: Segment[] }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { segment } = await createSegment(name.trim());
      router.push(`/segments/${segment.slug}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="wrap">
      {existingSegments.length > 0 && <SegmentTabs segments={existingSegments} activeSlug="" />}
      <header className="top">
        <div>
          <p className="eyebrow">Enchant · outreach tracker</p>
          <h1>New segment</h1>
        </div>
      </header>
      <div className="modal" style={{ maxWidth: 480 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-row full">
            <label htmlFor="segName">Segment name</label>
            <input
              id="segName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Agency, Press, Partnerships"
              autoFocus
            />
          </div>
          {error && <div className="error-text">{error}</div>}
          <p className="footnote" style={{ marginTop: 0, borderTop: "none", paddingTop: 0 }}>
            New segments start with a default four-tier (A–D) and four-stage (LinkedIn Add → First Reach → Second
            Reach → Third Reach) pipeline, which you can rename and retune from Settings afterwards.
          </p>
          <div className="modal-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? "Creating…" : "Create segment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
