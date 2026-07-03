"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Waveform from "./Waveform";
import type { BrandHistoryEntry } from "@/lib/types";
import {
  confirmBrandHistory,
  createBrandHistory,
  deleteBrandHistory,
  dismissBrandHistory,
  fetchBrandHistories,
  generateApiTokenApi,
  triggerBrandScan,
  updateBrandHistory,
  type ScanSummaryDTO,
} from "@/lib/api-client";

const EVENT_TYPES = ["New CMO", "Brand Refresh / Rebrand", "Major ATL Campaign", "Other"];
const SALES_NAV_URL = "https://www.linkedin.com/sales/home";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "manual",
  news_api: "news scan",
  sales_nav_feed: "Sales Navigator",
};

function fmtDateTime(d: string | null) {
  if (!d) return "never";
  return new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function BrandHistoriesView({
  initialEntries,
  initialSummary,
  initialTokenStatus,
}: {
  initialEntries: BrandHistoryEntry[];
  initialSummary: ScanSummaryDTO;
  initialTokenStatus: { exists: boolean; createdAt: string | null };
}) {
  const [entries, setEntries] = useState<BrandHistoryEntry[]>(initialEntries);
  const [brandFilter, setBrandFilter] = useState("");
  const [summary, setSummary] = useState<ScanSummaryDTO>(initialSummary);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ brand: "", eventType: EVENT_TYPES[0], date: new Date().toISOString().slice(0, 10), note: "" });
  const [tokenStatus, setTokenStatus] = useState(initialTokenStatus);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({ brand: "", eventType: "", date: "", note: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const brandOptions = useMemo(() => {
    const set = new Set(entries.map((e) => e.brand));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  async function refresh(brand?: string) {
    const list = await fetchBrandHistories({ brand: brand || undefined });
    setEntries(list);
  }

  async function handleFilterChange(brand: string) {
    setBrandFilter(brand);
    await refresh(brand);
  }

  async function handleConfirm(id: number) {
    await confirmBrandHistory(id);
    await refresh(brandFilter);
  }

  async function handleDismiss(id: number) {
    await dismissBrandHistory(id);
    await refresh(brandFilter);
  }

  function startEdit(entry: BrandHistoryEntry) {
    setEditingId(entry.id);
    setEditError(null);
    setEditDraft({
      brand: entry.brand,
      eventType: entry.eventType,
      date: entry.date ? entry.date.slice(0, 10) : "",
      note: entry.note ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function handleEditSave(id: number) {
    if (!editDraft.brand.trim() || !editDraft.date) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await updateBrandHistory(id, {
        brand: editDraft.brand.trim(),
        eventType: editDraft.eventType,
        date: editDraft.date,
        note: editDraft.note.trim(),
      });
      setEditingId(null);
      await refresh(brandFilter);
    } catch (e) {
      setEditError((e as Error).message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this brand history entry? This can't be undone.")) return;
    await deleteBrandHistory(id);
    if (editingId === id) setEditingId(null);
    await refresh(brandFilter);
  }

  async function handleScan() {
    setScanning(true);
    setScanError(null);
    try {
      const result = await triggerBrandScan();
      setSummary({ ...result, lastRunAt: new Date().toISOString(), ok: true });
      await refresh(brandFilter);
    } catch (e) {
      setScanError((e as Error).message);
    } finally {
      setScanning(false);
    }
  }

  async function handleGenerateToken() {
    if (
      tokenStatus.exists &&
      !confirm("Generate a new token? The extension will stop working until you paste the new one in.")
    ) {
      return;
    }
    setTokenBusy(true);
    setTokenCopied(false);
    try {
      const token = await generateApiTokenApi();
      setNewToken(token);
      setTokenStatus({ exists: true, createdAt: new Date().toISOString() });
    } finally {
      setTokenBusy(false);
    }
  }

  async function handleCopyToken() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setTokenCopied(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.brand.trim() || !draft.date) return;
    setSaving(true);
    setFormError(null);
    try {
      await createBrandHistory({
        brand: draft.brand.trim(),
        eventType: draft.eventType,
        date: draft.date,
        note: draft.note.trim() || undefined,
      });
      setDraft({ brand: "", eventType: EVENT_TYPES[0], date: new Date().toISOString().slice(0, 10), note: "" });
      setShowForm(false);
      await refresh(brandFilter);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <p className="eyebrow">Enchant · brand histories</p>
          <h1>Brand Histories</h1>
        </div>
        <div className="top-actions">
          <a href={SALES_NAV_URL} target="_blank" rel="noreferrer" className="btn">
            Open Sales Navigator ↗
          </a>
          <Link href="/" className="btn">
            ← Back to queue
          </Link>
        </div>
        <Waveform />
      </header>

      <div className="brand-history-panel">
        <div className="brand-history-toolbar">
          <button className="btn primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ Add entry"}
          </button>
          <button className="btn" disabled={scanning} onClick={handleScan}>
            {scanning ? "Scanning (~a few minutes)…" : "Spot-check 10 brands now"}
          </button>
          <span className="last-scanned">
            Last scanned: {fmtDateTime(summary.lastRunAt)}
            {typeof summary.newEntries === "number" ? ` · ${summary.newEntries} new entr${summary.newEntries === 1 ? "y" : "ies"} found` : ""}
            {typeof summary.brandsScanned === "number" && typeof summary.totalBrands === "number"
              ? ` · ${summary.brandsScanned} of ${summary.totalBrands} brands checked this run`
              : ""}
            {summary.ok === false && summary.error ? ` · scan failed: ${summary.error}` : ""}
          </span>
        </div>
        <div className="last-scanned" style={{ marginBottom: 14 }}>
          The full brand list is large (
          {summary.totalBrands ?? "600+"} brands), so a daily background scan works through it in rotating batches —
          each brand gets checked every few days, not necessarily every day. The button above checks a small batch
          immediately as a quick spot-check; it advances the same rotation.
        </div>
        {scanError && <div className="error-text">{scanError}</div>}
        {summary.errors && summary.errors.length > 0 && (
          <div className="error-text" style={{ marginBottom: 14 }}>
            {summary.errors.length} of {summary.brandsScanned ?? "?"} brand{summary.brandsScanned === 1 ? "" : "s"} failed
            during the last scan:
            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
              {summary.errors.slice(0, 6).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
            {summary.errors.length > 6 && <div>…and {summary.errors.length - 6} more.</div>}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="form-grid" style={{ marginBottom: 16 }}>
            <div className="form-row">
              <label>Brand</label>
              <input value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} required />
            </div>
            <div className="form-row">
              <label>Event type</label>
              <select value={draft.eventType} onChange={(e) => setDraft({ ...draft, eventType: e.target.value })}>
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Date</label>
              <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />
            </div>
            <div className="form-row">
              <label>Note (optional)</label>
              <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="Source link or brief detail" />
            </div>
            {formError && (
              <div className="form-row full">
                <div className="error-text">{formError}</div>
              </div>
            )}
            <div className="form-row full">
              <button className="btn primary" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save entry"}
              </button>
            </div>
          </form>
        )}

        <div className="controls" style={{ marginBottom: 0 }}>
          <select value={brandFilter} onChange={(e) => handleFilterChange(e.target.value)}>
            <option value="">All brands</option>
            {brandOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="brand-history-panel">
        <h2>Sales Navigator capture</h2>
        <p className="last-scanned" style={{ marginBottom: 14 }}>
          Lets the browser extension send something you&apos;ve spotted in your Sales Navigator feed straight into
          this table — see <code>extension/README.md</code> in the repo for install steps. Every capture still goes
          through an in-page confirm/edit step before it&apos;s sent, so entries land here already confirmed.
        </p>
        <p className="last-scanned" style={{ marginBottom: 14 }}>
          {tokenStatus.exists
            ? `Token generated ${fmtDateTime(tokenStatus.createdAt)}.`
            : "No token generated yet — the extension needs one to authenticate."}
        </p>
        <button className="btn" disabled={tokenBusy} onClick={handleGenerateToken}>
          {tokenBusy ? "Generating…" : tokenStatus.exists ? "Generate new token" : "Generate token"}
        </button>
        {newToken && (
          <div className="history-panel" style={{ marginTop: 14 }}>
            <b>Copy this now — it won&apos;t be shown again.</b> Paste it into the extension&apos;s settings page.
            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
              <code style={{ wordBreak: "break-all" }}>{newToken}</code>
              <button className="btn" onClick={handleCopyToken}>
                {tokenCopied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="data-grid-scroll">
        <table className="settings-table data-grid-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Brand</th>
              <th>Event type</th>
              <th>Status</th>
              <th>Source</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) =>
              editingId === entry.id ? (
                <tr key={entry.id}>
                  <td>
                    <input type="date" value={editDraft.date} onChange={(e) => setEditDraft({ ...editDraft, date: e.target.value })} />
                  </td>
                  <td>
                    <input value={editDraft.brand} onChange={(e) => setEditDraft({ ...editDraft, brand: e.target.value })} />
                  </td>
                  <td>
                    <select value={editDraft.eventType} onChange={(e) => setEditDraft({ ...editDraft, eventType: e.target.value })}>
                      {EVENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`status-pill ${entry.status}`}>{entry.status}</span>
                  </td>
                  <td>
                    <span className="source-tag">{SOURCE_LABELS[entry.source] ?? entry.source}</span>
                  </td>
                  <td>
                    <input value={editDraft.note} onChange={(e) => setEditDraft({ ...editDraft, note: e.target.value })} />
                  </td>
                  <td className="data-grid-actions">
                    <button className="btn primary" disabled={editSaving} onClick={() => handleEditSave(entry.id)}>
                      {editSaving ? "Saving…" : "Save"}
                    </button>
                    <button className="btn" disabled={editSaving} onClick={cancelEdit}>
                      Cancel
                    </button>
                    {editError && <div className="error-text">{editError}</div>}
                  </td>
                </tr>
              ) : (
                <tr key={entry.id}>
                  <td>{fmtDate(entry.date)}</td>
                  <td>{entry.brand}</td>
                  <td>{entry.eventType}</td>
                  <td>
                    <span className={`status-pill ${entry.status}`}>{entry.status}</span>
                  </td>
                  <td>
                    <span className="source-tag">{SOURCE_LABELS[entry.source] ?? entry.source}</span>
                  </td>
                  <td>
                    {entry.articleUrl ? (
                      <a href={entry.articleUrl} target="_blank" rel="noreferrer">
                        {entry.note || "article"}
                      </a>
                    ) : (
                      entry.note ?? ""
                    )}
                  </td>
                  <td className="data-grid-actions">
                    {entry.status === "pending" && (
                      <>
                        <button className="btn" onClick={() => handleConfirm(entry.id)}>
                          Confirm
                        </button>
                        <button className="btn" onClick={() => handleDismiss(entry.id)}>
                          Dismiss
                        </button>
                      </>
                    )}
                    <button className="btn" onClick={() => startEdit(entry)}>
                      Edit
                    </button>
                    <button className="btn" onClick={() => handleDelete(entry.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      {entries.length === 0 && <div className="empty">No brand history entries yet.</div>}

      <div className="footnote">
        Entries dated within the last 60 days give that brand&apos;s contacts a decaying priority boost (up to +50% on
        the day of the event). Pending entries from the automated news scan don&apos;t affect priority until
        confirmed.
      </div>
    </div>
  );
}
