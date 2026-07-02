"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { GridContact } from "@/lib/types";
import type { ContactPayload } from "@/lib/api-client";
import type { Segment, Stage, Tier } from "@/lib/types";
import {
  deleteContact as apiDeleteContact,
  fetchGrid,
  fetchSegmentConfig,
  updateContact as apiUpdateContact,
} from "@/lib/api-client";

const TIER_LETTERS = ["S", "A", "B", "C", "D"];

export default function DataGrid({
  segments,
  initialRows,
  initialTotal,
}: {
  segments: Segment[];
  initialRows: GridContact[];
  initialTotal: number;
}) {
  const [rows, setRows] = useState<GridContact[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [sortBy, setSortBy] = useState("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [configCache, setConfigCache] = useState<Record<string, { tiers: Tier[]; stages: Stage[] }>>({});
  const [editMode, setEditMode] = useState(false);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function refresh() {
    const result = await fetchGrid({
      segment: segmentFilter || undefined,
      tier: tierFilter || undefined,
      search: search || undefined,
      sortBy,
      sortDir,
      page,
      pageSize,
    });
    setRows(result.rows);
    setTotal(result.total);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(refresh, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, segmentFilter, tierFilter, sortBy, sortDir, page]);

  // Tier/stage dropdowns differ per segment, so preload config for every
  // segment currently on screen (rather than fetching on demand per cell).
  useEffect(() => {
    const slugs = Array.from(new Set(rows.map((r) => r.segmentSlug)));
    const missing = slugs.filter((s) => !configCache[s]);
    if (missing.length === 0) return;
    (async () => {
      const entries = await Promise.all(missing.map(async (slug) => [slug, await fetchSegmentConfig(slug)] as const));
      setConfigCache((prev) => {
        const next = { ...prev };
        for (const [slug, cfg] of entries) next[slug] = { tiers: cfg.tiers, stages: cfg.stages };
        return next;
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  function toggleSort(col: string) {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  }

  async function saveField(row: GridContact, patch: Partial<ContactPayload>) {
    setPendingSaves((n) => n + 1);
    try {
      const updated = await apiUpdateContact(row.id, patch);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)));
    } catch (e) {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      setSaveError(`Couldn't save ${row.name}: ${(e as Error).message}`);
      errorTimeoutRef.current = setTimeout(() => setSaveError(null), 6000);
    } finally {
      setPendingSaves((n) => n - 1);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this contact? This cannot be undone.")) return;
    await apiDeleteContact(id);
    await refresh();
  }

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  function sortIndicator(col: string) {
    if (sortBy !== col) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <p className="eyebrow">Enchant · full database</p>
          <h1>Data Grid</h1>
        </div>
        <div className="top-actions">
          <Link href="/" className="btn">
            ← Back to queue
          </Link>
          <Link href="/brand-histories" className="btn">
            Brand histories
          </Link>
        </div>
      </header>

      <div className="controls">
        <input
          type="text"
          placeholder="Search name, brand, role, email…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <select
          value={segmentFilter}
          onChange={(e) => {
            setPage(1);
            setSegmentFilter(e.target.value);
          }}
        >
          <option value="">All segments</option>
          {segments.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={tierFilter}
          onChange={(e) => {
            setPage(1);
            setTierFilter(e.target.value);
          }}
        >
          <option value="">All tiers</option>
          {TIER_LETTERS.map((l) => (
            <option key={l} value={l}>
              {l} Tier
            </option>
          ))}
        </select>
        <div className="grid-count">{total.toLocaleString()} contacts</div>
        <button className={`btn ${editMode ? "primary" : ""}`} onClick={() => setEditMode((v) => !v)}>
          {editMode ? "Editing — click to lock" : "Enable editing"}
        </button>
        {pendingSaves > 0 && <div className="saving-indicator">Saving…</div>}
      </div>

      {saveError && <div className="error-text">{saveError}</div>}

      <div className="data-grid-scroll">
        <table className="settings-table data-grid-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => toggleSort("segment")}>
                Segment{sortIndicator("segment")}
              </th>
              <th className="sortable" onClick={() => toggleSort("tier")}>
                Tier{sortIndicator("tier")}
              </th>
              <th className="sortable" onClick={() => toggleSort("brand")}>
                Brand{sortIndicator("brand")}
              </th>
              <th>Sub-brand</th>
              <th className="sortable" onClick={() => toggleSort("name")}>
                Name{sortIndicator("name")}
              </th>
              <th className="sortable" onClick={() => toggleSort("role")}>
                Role{sortIndicator("role")}
              </th>
              <th className="sortable" onClick={() => toggleSort("followers")}>
                Followers{sortIndicator("followers")}
              </th>
              <th className="sortable" onClick={() => toggleSort("stage")}>
                Stage{sortIndicator("stage")}
              </th>
              <th className="sortable" onClick={() => toggleSort("due")}>
                Due{sortIndicator("due")}
              </th>
              <th className="sortable" onClick={() => toggleSort("priority")}>
                Priority{sortIndicator("priority")}
              </th>
              <th>Email</th>
              <th>LinkedIn</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cfg = configCache[row.segmentSlug];
              const rowKey = `${row.id}-${row.updatedAt}`;
              return (
                <tr key={rowKey}>
                  <td>{row.segmentName}</td>
                  <td>
                    {editMode ? (
                      <select
                        defaultValue={row.tierId ? String(row.tierId) : ""}
                        disabled={!cfg}
                        onChange={(e) => saveField(row, { tierId: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">—</option>
                        {(cfg?.tiers ?? []).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      row.tier?.label ?? "—"
                    )}
                  </td>
                  <td>
                    {editMode ? (
                      <input
                        defaultValue={row.brand ?? ""}
                        onBlur={(e) => {
                          const val = e.target.value.trim() || null;
                          if (val !== (row.brand ?? null)) saveField(row, { brand: val });
                        }}
                      />
                    ) : (
                      row.brand ?? ""
                    )}
                  </td>
                  <td>
                    {editMode ? (
                      <input
                        defaultValue={row.subBrand ?? ""}
                        onBlur={(e) => {
                          const val = e.target.value.trim() || null;
                          if (val !== (row.subBrand ?? null)) saveField(row, { subBrand: val });
                        }}
                      />
                    ) : (
                      row.subBrand ?? ""
                    )}
                  </td>
                  <td>
                    {editMode ? (
                      <input
                        defaultValue={row.name}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (!val) {
                            e.target.value = row.name;
                            return;
                          }
                          if (val !== row.name) saveField(row, { name: val });
                        }}
                      />
                    ) : (
                      row.name
                    )}
                  </td>
                  <td>
                    {editMode ? (
                      <input
                        defaultValue={row.role ?? ""}
                        onBlur={(e) => {
                          const val = e.target.value.trim() || null;
                          if (val !== (row.role ?? null)) saveField(row, { role: val });
                        }}
                      />
                    ) : (
                      row.role ?? ""
                    )}
                  </td>
                  <td>
                    {editMode ? (
                      <input
                        type="number"
                        min="0"
                        defaultValue={row.followers != null ? String(row.followers) : ""}
                        onBlur={(e) => {
                          const raw = e.target.value.trim();
                          const val = raw ? Number(raw) : null;
                          if (val !== row.followers) saveField(row, { followers: val });
                        }}
                      />
                    ) : (
                      row.followers?.toLocaleString() ?? ""
                    )}
                  </td>
                  <td>
                    {editMode ? (
                      <select
                        defaultValue={row.stageId ? String(row.stageId) : ""}
                        disabled={!cfg}
                        onChange={(e) => saveField(row, { stageId: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">—</option>
                        {(cfg?.stages ?? []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      row.stage?.name ?? "—"
                    )}
                  </td>
                  <td>{row.dueAt ? new Date(row.dueAt).toLocaleDateString("en-GB") : "—"}</td>
                  <td title={row.brandBonus ? `Boosted from base ${row.priorityScore.toFixed(1)} — ${row.brandBonus.eventType}, ${row.brandBonus.daysAgo}d ago` : undefined}>
                    {row.effectivePriorityScore.toFixed(1)}
                    {row.brandBonus ? " 📰" : ""}
                  </td>
                  <td>
                    {editMode ? (
                      <input
                        defaultValue={row.email ?? ""}
                        onBlur={(e) => {
                          const val = e.target.value.trim() || null;
                          if (val !== (row.email ?? null)) saveField(row, { email: val });
                        }}
                      />
                    ) : (
                      row.email ?? ""
                    )}
                  </td>
                  <td>
                    {editMode ? (
                      <input
                        defaultValue={row.linkedin ?? ""}
                        onBlur={(e) => {
                          const val = e.target.value.trim() || null;
                          if (val !== (row.linkedin ?? null)) saveField(row, { linkedin: val });
                        }}
                      />
                    ) : row.linkedin ? (
                      <a href={row.linkedin} target="_blank" rel="noreferrer">
                        in
                      </a>
                    ) : (
                      ""
                    )}
                  </td>
                  <td className="data-grid-actions">
                    {editMode && (
                      <button className="btn" onClick={() => handleDelete(row.id)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="data-grid-pagination">
        <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(p - 1, 1))}>
          ← Prev
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(p + 1, totalPages))}>
          Next →
        </button>
      </div>
    </div>
  );
}
