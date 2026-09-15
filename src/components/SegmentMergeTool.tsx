"use client";

import { useState } from "react";
import type { Segment, SegmentMergePreview } from "@/lib/types";
import { applySegmentMerge, previewSegmentMerge } from "@/lib/api-client";

export default function SegmentMergeTool({ segments, onMerged }: { segments: Segment[]; onMerged: (deletedSlug: string) => void }) {
  const [fromSlug, setFromSlug] = useState("");
  const [toSlug, setToSlug] = useState("");
  const [preview, setPreview] = useState<SegmentMergePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<{ movedContacts: number; deletedSegment: string } | null>(null);

  function resetOutcome() {
    setPreview(null);
    setResult(null);
    setConfirmText("");
    setError(null);
  }

  async function handlePreview() {
    if (!fromSlug || !toSlug) return;
    resetOutcome();
    setPreviewing(true);
    try {
      const p = await previewSegmentMerge(fromSlug, toSlug);
      setPreview(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleApply() {
    if (!preview) return;
    setApplying(true);
    setError(null);
    try {
      const r = await applySegmentMerge(fromSlug, toSlug);
      setResult(r);
      setPreview(null);
      setConfirmText("");
      onMerged(fromSlug);
      setFromSlug("");
      setToSlug("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  }

  const confirmOk = confirmText.trim().toUpperCase() === "DELETE";

  return (
    <div className="data-tools-section">
      <h2>Merge segments</h2>
      <p className="top-ten-sub">
        Move every contact from one segment into another, then permanently delete the source segment (and its own
        tiers/stages). Tiers match up automatically — S/A/B/C/D are the same in every segment. Stages match by name;
        any contact on a stage with no matching name in the destination keeps everything else about it but loses its
        stage assignment.
      </p>
      <div className="controls">
        <select
          value={fromSlug}
          onChange={(e) => {
            setFromSlug(e.target.value);
            resetOutcome();
          }}
        >
          <option value="">Move contacts from…</option>
          {segments.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={toSlug}
          onChange={(e) => {
            setToSlug(e.target.value);
            resetOutcome();
          }}
        >
          <option value="">…into</option>
          {segments.map((s) => (
            <option key={s.id} value={s.slug} disabled={s.slug === fromSlug}>
              {s.name}
            </option>
          ))}
        </select>
        <button className="btn" disabled={!fromSlug || !toSlug || fromSlug === toSlug || previewing} onClick={handlePreview}>
          {previewing ? "Checking…" : "Preview merge"}
        </button>
      </div>

      {error && (
        <div className="error-text" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {result && (
        <div className="history-panel" style={{ marginTop: 14 }}>
          Moved {result.movedContacts} contact{result.movedContacts === 1 ? "" : "s"}{" "}
          and deleted &quot;{result.deletedSegment}&quot;.
        </div>
      )}

      {preview && (
        <div className="data-tools-preview">
          <div className="data-tools-scope-line">
            <b>{preview.contactCount}</b> contact{preview.contactCount === 1 ? "" : "s"} will move from{" "}
            <b>{preview.fromName}</b> to <b>{preview.toName}</b>.
          </div>

          {preview.unmatchedStages.length > 0 && (
            <div className="data-tools-warning">
              These stages in {preview.fromName} have no matching stage (by name) in {preview.toName} — contacts on
              them will lose their stage assignment (everything else about them is unchanged):
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {preview.unmatchedStages.map((s) => (
                  <li key={s.stageName}>
                    {s.stageName} ({s.contactCount} contact{s.contactCount === 1 ? "" : "s"})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="data-tools-warning" style={{ marginTop: preview.unmatchedStages.length > 0 ? 10 : 0 }}>
            The &quot;{preview.fromName}&quot; segment — and its own tiers and stages — will be permanently deleted
            once this runs. This cannot be undone.
          </div>

          <div className="data-tools-apply">
            <label className="data-tools-confirm-label">
              Type <code>DELETE</code> to confirm merging and deleting &quot;{preview.fromName}&quot;:
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="data-tools-confirm-input"
              />
            </label>
            <button className="btn primary" disabled={applying || !confirmOk} onClick={handleApply}>
              {applying ? "Applying…" : "Apply merge"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
