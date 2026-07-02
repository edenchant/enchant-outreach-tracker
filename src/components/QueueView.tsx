"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Contact, Segment, Stage, Tier } from "@/lib/types";
import {
  deleteContact as apiDeleteContact,
  fetchContacts,
  fetchStats,
  fetchTopToday,
  markContacted as apiMarkContacted,
  snoozeContact as apiSnoozeContact,
  undoContact as apiUndoContact,
} from "@/lib/api-client";
import Link from "next/link";
import SegmentTabs from "./SegmentTabs";
import ContactFormModal from "./ContactFormModal";
import ContactCard from "./ContactCard";
import DraftModal from "./DraftModal";

interface Stats {
  overdue: number;
  today: number;
  upcoming: number;
  total: number;
}

export default function QueueView({
  allSegments,
  segment,
  tiers,
  stages,
  initialContacts,
  initialStats,
  initialTopToday,
}: {
  allSegments: Segment[];
  segment: Segment;
  tiers: Tier[];
  stages: Stage[];
  initialContacts: Contact[];
  initialStats: Stats;
  initialTopToday: Contact[];
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
  const [toast, setToast] = useState<{ id: number; name: string; action: "contacted" | "snoozed" } | null>(null);
  const [topToday, setTopToday] = useState<Contact[]>(initialTopToday);
  const [showTopTen, setShowTopTen] = useState(true);
  const [draftingContact, setDraftingContact] = useState<Contact | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function refresh() {
    const [c, s, t] = await Promise.all([
      fetchContacts({ segment: segment.slug, search: search || undefined, tier: tierId, stage: stageId, status }),
      fetchStats(segment.slug),
      fetchTopToday(segment.slug),
    ]);
    setContacts(c);
    setStats(s);
    setTopToday(t);
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
    setToast({ id, name, action: "contacted" });
    await refresh();
  }

  async function handleSnooze(id: number, name: string) {
    await apiSnoozeContact(id);
    setToast({ id, name, action: "snoozed" });
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
          <Link href="/data" className="btn">
            Data grid
          </Link>
          <Link href="/brand-histories" className="btn">
            Brand histories
          </Link>
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
          {toast.action === "contacted" ? (
            <>
              Marked <b>{toast.name}</b> as contacted.
            </>
          ) : (
            <>
              Snoozed <b>{toast.name}</b> for 30 days.
            </>
          )}{" "}
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

      {topToday.length > 0 && (
        <div className="top-ten">
          <div className="top-ten-header">
            <h2>
              🎯 Today&apos;s Top {topToday.length}
              <span className="top-ten-sub">Highest-priority overdue &amp; due-today contacts</span>
            </h2>
            <button className="btn" onClick={() => setShowTopTen((v) => !v)}>
              {showTopTen ? "Hide" : "Show"}
            </button>
          </div>
          {showTopTen && (
            <div className="queue">
              {topToday.map((c, idx) => (
                <ContactCard
                  key={c.id}
                  contact={c}
                  rank={idx + 1}
                  stages={stages}
                  expanded={expandedId === c.id}
                  onToggleExpand={() => setExpandedId(expandedId === c.id ? null : c.id)}
                  onEdit={() => {
                    setModalMode("edit");
                    setEditingContact(c);
                  }}
                  onDelete={() => handleDelete(c.id)}
                  onMarkContacted={() => handleMarkContacted(c.id, c.name)}
                  onSnooze={() => handleSnooze(c.id, c.name)}
                  onDraft={() => setDraftingContact(c)}
                />
              ))}
            </div>
          )}
        </div>
      )}

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
        {contacts.map((c, idx) => (
          <ContactCard
            key={c.id}
            contact={c}
            rank={idx + 1}
            stages={stages}
            expanded={expandedId === c.id}
            onToggleExpand={() => setExpandedId(expandedId === c.id ? null : c.id)}
            onEdit={() => {
              setModalMode("edit");
              setEditingContact(c);
            }}
            onDelete={() => handleDelete(c.id)}
            onMarkContacted={() => handleMarkContacted(c.id, c.name)}
            onSnooze={() => handleSnooze(c.id, c.name)}
            onDraft={() => setDraftingContact(c)}
          />
        ))}
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

      {draftingContact && <DraftModal contact={draftingContact} onClose={() => setDraftingContact(null)} />}
    </div>
  );
}
