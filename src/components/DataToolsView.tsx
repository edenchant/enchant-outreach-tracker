"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Segment } from "@/lib/types";
import type { ImportDiff } from "@/lib/import-export";
import { detectScopeFromCsv, type DetectedScope } from "@/lib/csv-scope";
import { applyImport, previewImport } from "@/lib/api-client";
import SegmentTabs from "./SegmentTabs";
import Waveform from "./Waveform";

const FIELD_LABELS: Record<string, string> = {
  tier: "Tier",
  stage: "Stage",
  brand: "Brand",
  subBrand: "Sub-brand",
  name: "Name",
  role: "Role",
  followers: "Followers",
  linkedin: "LinkedIn",
  email: "Email",
  lastContactedAt: "Last contacted",
  dueAt: "Due date",
  inTouch: "In touch",
  metInPerson: "Met in person",
  converted: "Converted",
  promptContext: "Prompt context",
};

// Large or near-total deletions get the typed-confirmation treatment
// instead of a plain confirm() dialog, which is trivially dismissed
// without reading. Small, low-risk applies (a handful of edits) don't
// need it.
const TYPED_CONFIRM_THRESHOLD = 5;

export default function DataToolsView({ segments }: { segments: Segment[] }) {
  const [exportScope, setExportScope] = useState("");
  const [importScope, setImportScope] = useState("");
  const [detectedScope, setDetectedScope] = useState<DetectedScope | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [diff, setDiff] = useState<ImportDiff | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [appliedSummary, setAppliedSummary] = useState<{ created: number; updated: number; deleted: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function scopeName(slug: string): string {
    return slug ? segments.find((s) => s.slug === slug)?.name ?? slug : "All segments";
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setDiff(null);
    setConfirmText("");
    setAppliedSummary(null);
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    const detected = detectScopeFromCsv(text);
    setDetectedScope(detected);
    if (detected.detected) setImportScope(detected.scope ?? "");
  }

  async function handlePreview() {
    if (!csvText) return;
    setError(null);
    setDiff(null);
    setConfirmText("");
    setAppliedSummary(null);
    setPreviewing(true);
    try {
      const result = await previewImport(importScope || null, csvText);
      setDiff(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleApply() {
    if (!csvText || !diff) return;
    setApplying(true);
    setError(null);
    try {
      const result = await applyImport(importScope || null, csvText);
      setAppliedSummary({ created: result.toCreate.length, updated: result.toUpdate.length, deleted: result.toDelete.length });
      setDiff(null);
      setCsvText(null);
      setFileName(null);
      setDetectedScope(null);
      setConfirmText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  }

  const hasErrors = !!diff && diff.errors.length > 0;
  const canApply = !!diff && !hasErrors && (diff.toCreate.length > 0 || diff.toUpdate.length > 0 || diff.toDelete.length > 0);
  const needsTypedConfirm = !!diff && diff.toDelete.length >= TYPED_CONFIRM_THRESHOLD;
  const typedConfirmOk = !needsTypedConfirm || confirmText.trim().toUpperCase() === "DELETE";
  const scopeMismatch = !!detectedScope && detectedScope.detected && (detectedScope.scope ?? "") !== importScope;

  return (
    <div className="wrap">
      <SegmentTabs segments={segments} activeSlug="" />

      <header className="top">
        <div>
          <p className="eyebrow">Enchant · data tools</p>
          <h1>Bulk Export / Import</h1>
        </div>
        <div className="top-actions">
          <Link href="/reports" className="btn">
            Reports
          </Link>
          <Link href="/" className="btn">
            ← Back to queue
          </Link>
        </div>
        <Waveform />
      </header>

      <div className="data-tools-section">
        <h2>Export</h2>
        <p className="top-ten-sub">
          Download contacts as a CSV. Edit rows in Excel or Sheets, delete rows you don&apos;t want to keep, then
          re-import the file below to apply your changes.
        </p>
        <div className="controls">
          <select value={exportScope} onChange={(e) => setExportScope(e.target.value)}>
            <option value="">All segments</option>
            {segments.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
          <a className="btn primary" href={`/api/export${exportScope ? `?segment=${exportScope}` : ""}`}>
            Download CSV ↓
          </a>
        </div>
      </div>

      <div className="data-tools-section">
        <h2>Import</h2>
        <p className="top-ten-sub">
          Upload an edited CSV. Choose the scope it covers — any active contact in that scope whose row you removed
          from the file will be <b>deleted</b>. Rows with a blank <code>id</code> are created as new contacts. The{" "}
          <code>segment</code> column can&apos;t be changed for existing contacts via import.
        </p>
        <div className="controls">
          <select value={importScope} onChange={(e) => setImportScope(e.target.value)}>
            <option value="">All segments</option>
            {segments.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} />
          <button className="btn" disabled={!csvText || previewing} onClick={handlePreview}>
            {previewing ? "Checking…" : "Preview changes"}
          </button>
        </div>
        {fileName && <div className="grid-count">{fileName}</div>}

        {fileName && detectedScope && !detectedScope.detected && (
          <div className="data-tools-warning">
            Couldn&apos;t detect a scope from this file (no export header found) — double-check the scope above is
            right before applying.
          </div>
        )}

        {scopeMismatch && (
          <div className="data-tools-warning">
            This file was exported for <b>{scopeName(detectedScope && detectedScope.detected ? detectedScope.scope ?? "" : "")}</b>,
            but <b>{scopeName(importScope)}</b> is selected above. A mismatch here can delete contacts outside the
            file entirely — only continue if you meant to change the scope.
          </div>
        )}

        {error && (
          <div className="error-text" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}

        {appliedSummary && (
          <div className="history-panel" style={{ marginTop: 14 }}>
            Applied: {appliedSummary.created} created, {appliedSummary.updated} updated, {appliedSummary.deleted}{" "}
            deleted.
          </div>
        )}

        {diff && hasErrors && (
          <div className="data-tools-preview">
            <div className="error-text">
              {diff.errors.length} problem{diff.errors.length === 1 ? "" : "s"} — fix these in the file and re-upload
              before anything can be applied.
            </div>
            <ul className="data-tools-error-list">
              {diff.errors.map((err, i) => (
                <li key={i}>
                  Row {err.rowNumber}: {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {diff && !hasErrors && (
          <div className="data-tools-preview">
            <div className="data-tools-scope-line">
              {scopeName(importScope)} currently has <b>{diff.existingInScope}</b> active contact
              {diff.existingInScope === 1 ? "" : "s"}. This file would leave{" "}
              <b>{diff.existingInScope - diff.toDelete.length + diff.toCreate.length}</b>.
            </div>
            <div className="data-tools-summary">
              <span className="data-tools-count pos">+{diff.toCreate.length} create</span>
              <span className="data-tools-count neutral">{diff.toUpdate.length} update</span>
              <span className="data-tools-count neg">−{diff.toDelete.length} delete</span>
            </div>

            {diff.toDelete.length > 0 && (
              <details open>
                <summary>Contacts to delete ({diff.toDelete.length})</summary>
                <ul className="data-tools-row-list">
                  {diff.toDelete.map((d) => (
                    <li key={d.id}>
                      {d.name} — {d.brand ?? "no brand"} ({d.segmentSlug})
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {diff.toUpdate.length > 0 && (
              <details>
                <summary>Contacts to update ({diff.toUpdate.length})</summary>
                <ul className="data-tools-row-list">
                  {diff.toUpdate.map((u) => (
                    <li key={u.row.id}>
                      {u.row.name} — {u.changedFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {diff.toCreate.length > 0 && (
              <details>
                <summary>Contacts to create ({diff.toCreate.length})</summary>
                <ul className="data-tools-row-list">
                  {diff.toCreate.map((r, i) => (
                    <li key={i}>
                      {r.name} — {r.brand ?? "no brand"} ({r.segmentSlug})
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {!canApply && <div className="empty">No changes detected — this file matches the current database.</div>}

            {canApply && (
              <div className="data-tools-apply">
                {needsTypedConfirm && (
                  <label className="data-tools-confirm-label">
                    Type <code>DELETE</code> to confirm removing {diff.toDelete.length} contact
                    {diff.toDelete.length === 1 ? "" : "s"}:
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="data-tools-confirm-input"
                    />
                  </label>
                )}
                <button
                  className="btn primary"
                  disabled={applying || !typedConfirmOk}
                  onClick={() => {
                    if (
                      !needsTypedConfirm &&
                      !confirm(
                        `Apply these changes to ${scopeName(importScope)}?\n\n${diff.toCreate.length} to create\n${diff.toUpdate.length} to update\n${diff.toDelete.length} to delete\n\nThis cannot be undone.`
                      )
                    ) {
                      return;
                    }
                    handleApply();
                  }}
                >
                  {applying ? "Applying…" : "Apply changes"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
