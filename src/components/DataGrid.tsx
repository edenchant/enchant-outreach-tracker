"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { GridContact } from "@/lib/types";
import type { Segment, Stage, Tier } from "@/lib/types";
import {
  deleteContact as apiDeleteContact,
  fetchGrid,
  fetchSegmentConfig,
  updateContact as apiUpdateContact,
} from "@/lib/api-client";

type EditDraft = {
  tierId: string;
  stageId: string;
  brand: string;
  subBrand: string;
  name: string;
  role: string;
  followers: string;
  linkedin: string;
  email: string;
};

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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [configCache, setConfigCache] = useState<Record<string, { tiers: Tier[]; stages: Stage[] }>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function toggleSort(col: string) {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  }

  async function startEdit(row: GridContact) {
    if (!configCache[row.segmentSlug]) {
      const cfg = await fetchSegmentConfig(row.segmentSlug);
      setConfigCache((prev) => ({ ...prev, [row.segmentSlug]: { tiers: cfg.tiers, stages: cfg.stages } }));
    }
    setEditingId(row.id);
    setDraft({
      tierId: row.tierId ? String(row.tierId) : "",
      stageId: row.stageId ? String(row.stageId) : "",
      brand: row.brand ?? "",
      subBrand: row.subBrand ?? "",
      name: row.name,
      role: row.role ?? "",
      followers: row.followers != null ? String(row.followers) : "",
      linkedin: row.linkedin ?? "",
      email: row.email ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveEdit(id: number) {
    if (!draft) return;
    setSaving(true);
    try {
      await apiUpdateContact(id, {
        tierId: draft.tierId ? Number(draft.tierId) : null,
        stageId: draft.stageId ? Number(draft.stageId) : null,
        brand: draft.brand.trim() || null,
        subBrand: draft.subBrand.trim() || null,
        name: draft.name.trim(),
        role: draft.role.trim() || null,
        followers: draft.followers.trim() ? Number(draft.followers) : null,
        linkedin: draft.linkedin.trim() || null,
        email: draft.email.trim() || null,
      });
      setEditingId(null);
      setDraft(null);
      await refresh();
    } finally {
      setSaving(false);
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
      </div>

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
              const isEditing = editingId === row.id;
              const cfg = configCache[row.segmentSlug];
              return (
                <tr key={row.id} className={isEditing ? "editing-row" : ""}>
                  <td>{row.segmentName}</td>
                  <td>
                    {isEditing && draft && cfg ? (
                      <select value={draft.tierId} onChange={(e) => setDraft({ ...draft, tierId: e.target.value })}>
                        <option value="">—</option>
                        {cfg.tiers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      row.tier?.label ?? "—"
                    )}
                  </td>
                  <td>{isEditing && draft ? <input value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} /> : row.brand ?? ""}</td>
                  <td>{isEditing && draft ? <input value={draft.subBrand} onChange={(e) => setDraft({ ...draft, subBrand: e.target.value })} /> : row.subBrand ?? ""}</td>
                  <td>{isEditing && draft ? <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /> : row.name}</td>
                  <td>{isEditing && draft ? <input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} /> : row.role ?? ""}</td>
                  <td>
                    {isEditing && draft ? (
                      <input type="number" min="0" value={draft.followers} onChange={(e) => setDraft({ ...draft, followers: e.target.value })} />
                    ) : (
                      row.followers?.toLocaleString() ?? ""
                    )}
                  </td>
                  <td>
                    {isEditing && draft && cfg ? (
                      <select value={draft.stageId} onChange={(e) => setDraft({ ...draft, stageId: e.target.value })}>
                        <option value="">—</option>
                        {cfg.stages.map((s) => (
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
                  <td>{row.priorityScore.toFixed(1)}</td>
                  <td>{isEditing && draft ? <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /> : row.email ?? ""}</td>
                  <td>
                    {isEditing && draft ? (
                      <input value={draft.linkedin} onChange={(e) => setDraft({ ...draft, linkedin: e.target.value })} />
                    ) : row.linkedin ? (
                      <a href={row.linkedin} target="_blank" rel="noreferrer">
                        in
                      </a>
                    ) : (
                      ""
                    )}
                  </td>
                  <td className="data-grid-actions">
                    {isEditing ? (
                      <>
                        <button className="btn" disabled={saving} onClick={() => saveEdit(row.id)}>
                          {saving ? "…" : "Save"}
                        </button>
                        <button className="btn" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn" onClick={() => startEdit(row)}>
                          Edit
                        </button>
                        <button className="btn" onClick={() => handleDelete(row.id)}>
                          Delete
                        </button>
                      </>
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
