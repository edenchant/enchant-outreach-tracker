"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Contact, Segment, Stage, Tier } from "@/lib/types";
import {
  deleteContact as apiDeleteContact,
  fetchContacts,
  fetchStats,
  markContacted as apiMarkContacted,
  undoContact as apiUndoContact,
} from "@/lib/api-client";
import Link from "next/link";
import SegmentTabs from "./SegmentTabs";
import ContactFormModal from "./ContactFormModal";
import HistoryPanel from "./HistoryPanel";

interface Stats {
  overdue: number;
  today: number;
  upcoming: number;
  total: number;
}

function relTime(dueAt: string | null): string {
  if (!dueAt) return "No due date";
  const diffMs = new Date(dueAt).getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `Due in ${diffDays}d`;
}

function tierLetter(label?: string | null): string {
  if (!label) return "?";
  return label.charAt(0);
}

export default function QueueView({
  allSegments,
  segment,
  tiers,
  stages,
  initialContacts,
  initialStats,
}: {
  allSegments: Segment[];
  segment: Segment;
  tiers: Tier[];
  stages: Stage[];
  initialContacts: Contact[];
  initialStats: Stats;
}) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [search, setSearch] = useState("");
  const [tierId, setTierId] = useState<number | undefined>(undefined);
  const [stageId, setStageId] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<"overdue" | "today" | "upcoming" | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [toast, setToast] = useState<{ id: number; name: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function refresh() {
    const [c, s] = await Promise.all([
      fetchContacts({ segment: segment.slug, search: search || undefined, tier: tierId, stage: stageId, status }),
      fetchStats(segment.slug),
    ]);
    setContacts(c);
    setStats(s);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      refresh();
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tierId, stageId, status, segment.slug]);

  async function handleMarkContacted(id: number, name: string) {
    await apiMarkContacted(id);
    setToast({ id, name });
    await refresh();
  }

  async function handleUndo(id: number) {
    await apiUndoContact(id);
    setToast(null);
    await refresh();
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this contact? This cannot be undone.")) return;
    await apiDeleteContact(id);
    await refresh();
  }

  const stageOptions = useMemo(() => stages.slice().sort((a, b) => a.sortOrder - b.sortOrder), [stages]);
  const tierOptions = useMemo(() => tiers.slice().sort((a, b) => a.sortOrder - b.sortOrder), [tiers]);

  return (
    <div className="wrap">
      <SegmentTabs segments={allSegments} activeSlug={segment.slug} />

      <header className="top">
        <div>
          <p className="eyebrow">Enchant · {segment.name} segment</p>
          <h1>Today&apos;s Outreach Queue</h1>
        </div>
        <div className="top-actions">
          <Link href={`/segments/${segment.slug}/settings`} className="btn">
            Settings
          </Link>
          <div className="today-date" suppressHydrationWarning>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      </header>

      {toast && (
        <div className="history-panel" style={{ marginBottom: 14 }}>
          Marked <b>{toast.name}</b> as contacted.{" "}
          <button className="btn" style={{ marginLeft: 8 }} onClick={() => handleUndo(toast.id)}>
            Undo
          </button>
        </div>
      )}

      <div className="stats">
        <div className="stat overdue">
          <div className="num">{stats.overdue}</div>
          <div className="label">Overdue</div>
        </div>
        <div className="stat today">
          <div className="num">{stats.today}</div>
          <div className="label">Due today</div>
        </div>
        <div className="stat upcoming">
          <div className="num">{stats.upcoming}</div>
          <div className="label">Upcoming (7d)</div>
        </div>
        <div className="stat">
          <div className="num">{stats.total}</div>
          <div className="label">Total contacts</div>
        </div>
      </div>

      <div className="controls">
        <input
          type="text"
          placeholder="Search name, brand, role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={tierId ?? ""} onChange={(e) => setTierId(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">All tiers</option>
          {tierOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={stageId ?? ""}
          onChange={(e) => setStageId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">All stages</option>
          {stageOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="seg">
          <button className={!status ? "active" : ""} onClick={() => setStatus(undefined)}>
            All
          </button>
          <button className={status === "overdue" ? "active" : ""} onClick={() => setStatus("overdue")}>
            Overdue
          </button>
          <button className={status === "today" ? "active" : ""} onClick={() => setStatus("today")}>
            Today
          </button>
          <button className={status === "upcoming" ? "active" : ""} onClick={() => setStatus("upcoming")}>
            Upcoming
          </button>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            setModalMode("add");
            setEditingContact(null);
          }}
        >
          + Add contact
        </button>
      </div>

      <div className="queue">
        {contacts.map((c, idx) => {
          const tl = tierLetter(c.tier?.label);
          const isExpanded = expandedId === c.id;
          return (
            <div key={c.id} className={`card status-${c.status}`}>
              <div className="rank">{idx + 1}</div>
              <div className="who">
                <div className="name-line">
                  <button className="name" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                    {c.name}
                  </button>
                  <span className={`tier-badge tier-${tl}`}>{c.tier?.label ?? "—"}</span>
                </div>
                <div className="meta">
                  <b>{c.role || "Unknown role"}</b> · {c.brand || ""}
                  {c.subBrand ? ` · ${c.subBrand}` : ""}
                </div>
                {isExpanded && <HistoryPanel contactId={c.id} stages={stages} />}
              </div>
              <div className="stage-pill">{c.stage?.name ?? "—"}</div>
              <div className="due-info">
                <div className="rel">{relTime(c.dueAt)}</div>
                <div className="score">priority {c.priorityScore.toFixed(1)}</div>
              </div>
              <div className="actions">
                {c.linkedin && (
                  <a href={c.linkedin} target="_blank" rel="noreferrer" title="Open LinkedIn">
                    in
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} title="Email">
                    ✉
                  </a>
                )}
                <button
                  title="Edit"
                  onClick={() => {
                    setModalMode("edit");
                    setEditingContact(c);
                  }}
                >
                  ✎
                </button>
                <button title="Delete" onClick={() => handleDelete(c.id)}>
                  ×
                </button>
                <button className="contacted" onClick={() => handleMarkContacted(c.id, c.name)}>
                  Mark contacted
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {contacts.length === 0 && <div className="empty">Nothing matches these filters — try widening them.</div>}

      <div className="footnote">
        {segment.name} segment · {stats.total} contacts. Priority score is computed from tier weight × stage weight ×
        followers, and updates automatically as contacts move through the pipeline. Marking a contact as contacted
        advances them to the next stage and recalculates their next due date.
      </div>

      {modalMode && (
        <ContactFormModal
          segmentSlug={segment.slug}
          tiers={tierOptions}
          stages={stageOptions}
          contact={modalMode === "edit" ? editingContact : null}
          onClose={() => setModalMode(null)}
          onSaved={() => {
            setModalMode(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
