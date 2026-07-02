"use client";

import { useState } from "react";
import Link from "next/link";
import type { Contact, GridContact, Segment, Stage, Tier } from "@/lib/types";
import {
  fetchGlobalStats,
  fetchGlobalTopToday,
  fetchSegmentConfig,
  markContacted as apiMarkContacted,
  snoozeContact as apiSnoozeContact,
  undoContact as apiUndoContact,
} from "@/lib/api-client";
import SegmentTabs from "./SegmentTabs";
import Waveform from "./Waveform";
import StatMeter from "./StatMeter";
import ContactCard from "./ContactCard";
import ContactFormModal from "./ContactFormModal";
import DraftModal from "./DraftModal";

interface Stats {
  overdue: number;
  today: number;
  upcoming: number;
  total: number;
}

export default function GlobalHome({
  segments,
  initialStats,
  initialTopToday,
}: {
  segments: Segment[];
  initialStats: Stats;
  initialTopToday: GridContact[];
}) {
  const [stats, setStats] = useState<Stats>(initialStats);
  const [topToday, setTopToday] = useState<GridContact[]>(initialTopToday);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ id: number; name: string; action: "contacted" | "snoozed" } | null>(null);
  const [draftingContact, setDraftingContact] = useState<Contact | null>(null);
  const [editing, setEditing] = useState<{ contact: GridContact; tiers: Tier[]; stages: Stage[] } | null>(null);
  const [configCache, setConfigCache] = useState<Record<string, { tiers: Tier[]; stages: Stage[] }>>({});

  async function refresh() {
    const [s, t] = await Promise.all([fetchGlobalStats(), fetchGlobalTopToday()]);
    setStats(s);
    setTopToday(t);
  }

  async function ensureConfig(slug: string) {
    if (configCache[slug]) return configCache[slug];
    const cfg = await fetchSegmentConfig(slug);
    const entry = { tiers: cfg.tiers, stages: cfg.stages };
    setConfigCache((prev) => ({ ...prev, [slug]: entry }));
    return entry;
  }

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

  async function handleEdit(contact: GridContact) {
    const cfg = await ensureConfig(contact.segmentSlug);
    setEditing({ contact, tiers: cfg.tiers, stages: cfg.stages });
  }

  async function handleToggleExpand(contact: GridContact) {
    if (expandedId === contact.id) {
      setExpandedId(null);
      return;
    }
    await ensureConfig(contact.segmentSlug);
    setExpandedId(contact.id);
  }

  return (
    <div className="wrap">
      <SegmentTabs segments={segments} activeSlug="" />

      <header className="top">
        <div>
          <p className="eyebrow">Enchant · all segments</p>
          <h1>Today&apos;s Priority Queue</h1>
        </div>
        <div className="top-actions">
          <Link href="/data" className="btn">
            Data grid
          </Link>
          <Link href="/brand-histories" className="btn">
            Brand histories
          </Link>
          <div className="today-date" suppressHydrationWarning>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
        <Waveform />
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
          <StatMeter value={stats.overdue} total={stats.total} />
        </div>
        <div className="stat today">
          <div className="num">{stats.today}</div>
          <div className="label">Due today</div>
          <StatMeter value={stats.today} total={stats.total} />
        </div>
        <div className="stat upcoming">
          <div className="num">{stats.upcoming}</div>
          <div className="label">Upcoming (7d)</div>
          <StatMeter value={stats.upcoming} total={stats.total} />
        </div>
        <div className="stat total">
          <div className="num">{stats.total}</div>
          <div className="label">Total contacts</div>
          <StatMeter value={stats.total} total={stats.total} />
        </div>
      </div>

      <div className="top-ten">
        <div className="top-ten-header">
          <h2>
            🎯 Today&apos;s Top {topToday.length}
            <span className="top-ten-sub">Highest-priority overdue &amp; due-today contacts, across every segment</span>
          </h2>
        </div>
        <div className="queue">
          {topToday.map((c, idx) => (
            <ContactCard
              key={c.id}
              contact={c}
              rank={idx + 1}
              stages={configCache[c.segmentSlug]?.stages ?? []}
              expanded={expandedId === c.id}
              onToggleExpand={() => handleToggleExpand(c)}
              onEdit={() => handleEdit(c)}
              onMarkContacted={() => handleMarkContacted(c.id, c.name)}
              onSnooze={() => handleSnooze(c.id, c.name)}
              onDraft={() => setDraftingContact(c)}
              segmentLabel={c.segmentName}
            />
          ))}
        </div>
        {topToday.length === 0 && <div className="empty">Nothing overdue or due today — nice work.</div>}
      </div>

      <div className="footnote">
        Combined view across {segments.length} segments · {stats.total} contacts total. Jump into a segment above for
        its full queue, filters, and pipeline settings.
      </div>

      {editing && (
        <ContactFormModal
          segmentSlug={editing.contact.segmentSlug}
          tiers={editing.tiers}
          stages={editing.stages}
          contact={editing.contact}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}

      {draftingContact && <DraftModal contact={draftingContact} onClose={() => setDraftingContact(null)} />}
    </div>
  );
}
