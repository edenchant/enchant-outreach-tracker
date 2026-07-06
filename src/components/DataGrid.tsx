"use client";

import { useEffect, useRef, useState } from "react";
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

type ScrollColKey = "linkedin" | "email" | "inTouch" | "metInPerson" | "lastContacted" | "stage" | "dueAt";

const SCROLL_COLUMN_STORAGE_KEY = "dataGridColumnOrder";
const DEFAULT_COLUMN_ORDER: ScrollColKey[] = ["linkedin", "email", "inTouch", "metInPerson", "lastContacted", "stage", "dueAt"];

const SCROLL_COLUMN_LABELS: Record<ScrollColKey, string> = {
  linkedin: "LinkedIn",
  email: "Email",
  inTouch: "In touch",
  metInPerson: "Met in person",
  lastContacted: "Last contact",
  stage: "Stage",
  dueAt: "Next due",
};

const SCROLL_COLUMN_SORT_KEY: Partial<Record<ScrollColKey, string>> = {
  inTouch: "inTouch",
  metInPerson: "metInPerson",
  lastContacted: "lastContacted",
  stage: "stage",
  dueAt: "due",
};

// Fixed, non-reorderable identifying columns, pinned to the left of the
// horizontally-scrolling area. Widths are explicit so left offsets can be
// computed for position: sticky.
const FIXED_COLUMNS: Array<{ key: string; label: string; width: number; sort?: string }> = [
  { key: "clientType", label: "Client type", width: 110, sort: "segment" },
  { key: "tier", label: "Tier", width: 64, sort: "tier" },
  { key: "brand", label: "Brand / Company", width: 170, sort: "brand" },
  { key: "name", label: "Contact Name", width: 170, sort: "name" },
  { key: "role", label: "Job Role", width: 160, sort: "role" },
];

function fixedColumnLeft(index: number): number {
  return FIXED_COLUMNS.slice(0, index).reduce((sum, c) => sum + c.width, 0);
}

function fmtDMY(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

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
  const [columnOrder, setColumnOrder] = useState<ScrollColKey[]>(DEFAULT_COLUMN_ORDER);
  const dragKey = useRef<ScrollColKey | null>(null);
  const [dragOverKey, setDragOverKey] = useState<ScrollColKey | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deferred to a post-mount effect (rather than the useState initializer)
  // so the client's first render matches the server's, then reorders once
  // the saved preference is known — avoids a hydration mismatch.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SCROLL_COLUMN_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === DEFAULT_COLUMN_ORDER.length && DEFAULT_COLUMN_ORDER.every((k) => parsed.includes(k))) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of a client-only preference, deferred past the initial render to keep SSR/client markup identical for hydration
        setColumnOrder(parsed as ScrollColKey[]);
      }
    } catch {
      // ignore malformed/unavailable storage
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SCROLL_COLUMN_STORAGE_KEY, JSON.stringify(columnOrder));
    } catch {
      // ignore unavailable storage
    }
  }, [columnOrder]);

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

  function toggleSort(col?: string) {
    if (!col) return;
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

  function handleColumnDrop(targetKey: ScrollColKey) {
    const source = dragKey.current;
    dragKey.current = null;
    setDragOverKey(null);
    if (!source || source === targetKey) return;
    setColumnOrder((prev) => {
      const next = prev.filter((k) => k !== source);
      const targetIdx = next.indexOf(targetKey);
      next.splice(targetIdx, 0, source);
      return next;
    });
  }

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  function sortIndicator(col?: string) {
    if (!col || sortBy !== col) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  function renderScrollCell(row: GridContact, key: ScrollColKey, cfg: { tiers: Tier[]; stages: Stage[] } | undefined) {
    switch (key) {
      case "linkedin":
        return editMode ? (
          <input
            defaultValue={row.linkedin ?? ""}
            onBlur={(e) => {
              const val = e.target.value.trim() || null;
              if (val !== (row.linkedin ?? null)) saveField(row, { linkedin: val });
            }}
          />
        ) : row.linkedin ? (
          <a className="btn" href={row.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        ) : (
          "—"
        );
      case "email":
        return editMode ? (
          <input
            defaultValue={row.email ?? ""}
            onBlur={(e) => {
              const val = e.target.value.trim() || null;
              if (val !== (row.email ?? null)) saveField(row, { email: val });
            }}
          />
        ) : row.email ? (
          <a className="btn" href={`mailto:${row.email}`}>
            Email
          </a>
        ) : (
          "—"
        );
      case "inTouch":
        return editMode ? (
          <input type="checkbox" defaultChecked={row.inTouch} onChange={(e) => saveField(row, { inTouch: e.target.checked })} />
        ) : (
          <span className={`bool-pill ${row.inTouch ? "yes" : "no"}`}>{row.inTouch ? "Y" : "N"}</span>
        );
      case "metInPerson":
        return editMode ? (
          <input type="checkbox" defaultChecked={row.metInPerson} onChange={(e) => saveField(row, { metInPerson: e.target.checked })} />
        ) : (
          <span className={`bool-pill ${row.metInPerson ? "yes" : "no"}`}>{row.metInPerson ? "Y" : "N"}</span>
        );
      case "lastContacted":
        return editMode ? (
          <input
            type="date"
            defaultValue={toDateInputValue(row.lastContactedAt)}
            onChange={(e) => {
              const val = e.target.value || null;
              if (val !== toDateInputValue(row.lastContactedAt)) saveField(row, { lastContactedAt: val });
            }}
          />
        ) : (
          fmtDMY(row.lastContactedAt)
        );
      case "stage":
        return editMode ? (
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
        );
      case "dueAt":
        return fmtDMY(row.dueAt);
    }
  }

  return (
    <div className="data-grid-embed">
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
              {FIXED_COLUMNS.map((col, idx) => (
                <th
                  key={col.key}
                  className={`sticky-col ${col.sort ? "sortable" : ""} ${idx === FIXED_COLUMNS.length - 1 ? "sticky-col-last" : ""}`}
                  style={{ left: fixedColumnLeft(idx), width: col.width }}
                  onClick={() => toggleSort(col.sort)}
                >
                  {col.label}
                  {sortIndicator(col.sort)}
                </th>
              ))}
              {columnOrder.map((key) => (
                <th
                  key={key}
                  className={`sortable draggable-col ${dragOverKey === key ? "drag-over" : ""}`}
                  draggable
                  onClick={() => toggleSort(SCROLL_COLUMN_SORT_KEY[key])}
                  onDragStart={() => {
                    dragKey.current = key;
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverKey(key);
                  }}
                  onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleColumnDrop(key);
                  }}
                  onDragEnd={() => {
                    dragKey.current = null;
                    setDragOverKey(null);
                  }}
                  title="Drag to reorder"
                >
                  ⠿ {SCROLL_COLUMN_LABELS[key]}
                  {sortIndicator(SCROLL_COLUMN_SORT_KEY[key])}
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cfg = configCache[row.segmentSlug];
              const rowKey = `${row.id}-${row.updatedAt}`;
              return (
                <tr key={rowKey}>
                  <td className="sticky-col" style={{ left: fixedColumnLeft(0), width: FIXED_COLUMNS[0].width }}>
                    {row.segmentName}
                  </td>
                  <td className="sticky-col" style={{ left: fixedColumnLeft(1), width: FIXED_COLUMNS[1].width }}>
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
                  <td className="sticky-col" style={{ left: fixedColumnLeft(2), width: FIXED_COLUMNS[2].width }}>
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
                  <td className="sticky-col" style={{ left: fixedColumnLeft(3), width: FIXED_COLUMNS[3].width }}>
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
                  <td className="sticky-col sticky-col-last" style={{ left: fixedColumnLeft(4), width: FIXED_COLUMNS[4].width }}>
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
                  {columnOrder.map((key) => (
                    <td key={key}>{renderScrollCell(row, key, cfg)}</td>
                  ))}
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
