"use client";

import { useState } from "react";
import Link from "next/link";
import type { Contact, GridContact, Segment, Stage, Tier } from "@/lib/types";
import {
  fetchLinkedInQueue,
  fetchSegmentConfig,
  markContacted as apiMarkContacted,
  snoozeContact as apiSnoozeContact,
  undoContact as apiUndoContact,
  updateContact as apiUpdateContact,
} from "@/lib/api-client";
import SegmentTabs from "./SegmentTabs";
import Waveform from "./Waveform";
import StatMeter from "./StatMeter";
import ContactCard from "./ContactCard";
import ContactFormModal from "./ContactFormModal";
import DraftModal from "./DraftModal";

export default function LinkedInQueueView({
  segments,
  initialSuggestions,
  initialAddedThisWeek,
  weeklyLimit,
}: {
  segments: Segment[];
  initialSuggestions: GridContact[];
  initialAddedThisWeek: number;
  weeklyLimit: number;
}) {
  const [suggestions, setSuggestions] = useState<GridContact[]>(initialSuggestions);
  const [addedThisWeek, setAddedThisWeek] = useState(initialAddedThisWeek);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ id: number; name: string; action: "contacted" | "snoozed" } | null>(null);
  const [draftingContact, setDraftingContact] = useState<Contact | null>(null);
  const [editing, setEditing] = useState<{ contact: GridContact; tiers: Tier[]; stages: Stage[] } | null>(null);
  const [configCache, setConfigCache] = useState<Record<string, { tiers: Tier[]; stages: Stage[] }>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmedIds, setConfirmedIds] = useState<Set<number>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  async function refresh() {
    const q = await fetchLinkedInQueue();
    setSuggestions(q.suggestions);
    setAddedThisWeek(q.addedThisWeek);
  }

  async function ensureConfig(slug: string) {
    if (configCache[slug]) return configCache[slug];
    const cfg = await fetchSegmentConfig(slug);
    const entry = { tiers: cfg.tiers, stages: cfg.stages };
    setConfigCache((prev) => ({ ...prev, [slug]: entry }));
    return entry;
  }

  // On success, the contact immediately gets a due date and would vanish
  // from this list the moment we refetch — but with the next contact
  // instantly sliding into the same spot with an identically-labelled
  // button, a click can look like it did nothing at all. Holding the
  // just-added card in a visibly "done" state for a beat before removing it
  // makes the click's effect unmistakable on the specific card you clicked.
  async function handleAdded(id: number, name: string) {
    setActionError(null);
    setBusyId(id);
    try {
      await apiMarkContacted(id);
      setBusyId(null);
      setConfirmedIds((prev) => new Set(prev).add(id));
      setToast({ id, name, action: "contacted" });
      await new Promise((resolve) => setTimeout(resolve, 1400));
      await refresh();
      setConfirmedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      setActionError(`Couldn't add ${name}: ${(e as Error).message}`);
      setBusyId(null);
    }
  }

  async function handleSnooze(id: number, name: string) {
    setActionError(null);
    setBusyId(id);
    try {
      await apiSnoozeContact(id);
      setToast({ id, name, action: "snoozed" });
      await refresh();
    } catch (e) {
      setActionError(`Couldn't snooze ${name}: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleUndo(id: number) {
    setActionError(null);
    try {
      await apiUndoContact(id);
      setToast(null);
      setConfirmedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await refresh();
    } catch (e) {
      setActionError(`Couldn't undo: ${(e as Error).message}`);
    }
  }

  async function handleUpdateFlags(id: number, patch: { inTouch?: boolean; converted?: boolean }) {
    try {
      await apiUpdateContact(id, patch);
      await refresh();
    } catch (e) {
      setActionError(`Couldn't save: ${(e as Error).message}`);
    }
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

  const remaining = Math.max(weeklyLimit - addedThisWeek, 0);

  return (
    <div className="wrap">
      <SegmentTabs segments={segments} activeSlug="" />

      <header className="top">
        <div>
          <p className="eyebrow">Enchant · LinkedIn add queue</p>
          <h1>LinkedIn Add Queue</h1>
        </div>
        <div className="top-actions">
          <Link href="/brand-histories" className="btn">
            Brand histories
          </Link>
          <Link href="/reports" className="btn">
            Reports
          </Link>
          <Link href="/" className="btn">
            ← Back to queue
          </Link>
        </div>
        <Waveform />
      </header>

      {actionError && (
        <div className="error-text" style={{ marginBottom: 14 }}>
          {actionError}
        </div>
      )}

      {toast && (
        <div className="history-panel" style={{ marginBottom: 14 }}>
          {toast.action === "contacted" ? (
            <>
              Added <b>{toast.name}</b> on LinkedIn.
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
        <div className="stat total" style={{ gridColumn: "span 2" }}>
          <div className="num">
            {addedThisWeek} / {weeklyLimit}
          </div>
          <div className="label">Added on LinkedIn this week</div>
          <StatMeter value={addedThisWeek} total={weeklyLimit} />
        </div>
        <div className="stat total" style={{ gridColumn: "span 2" }}>
          <div className="num">{remaining}</div>
          <div className="label">Remaining this week&apos;s allowance</div>
          <StatMeter value={remaining} total={weeklyLimit} />
        </div>
      </div>

      <div className="top-ten">
        <div className="top-ten-header">
          <h2>
            🔗 Suggested adds
            <span className="top-ten-sub">
              Highest-priority contacts with no due date yet — the outreach process hasn&apos;t started for them, so
              adding them on LinkedIn is the first step
            </span>
          </h2>
        </div>
        <div className="queue">
          {suggestions.map((c, idx) => (
            <ContactCard
              key={`${c.id}-${c.updatedAt}`}
              contact={c}
              rank={idx + 1}
              stages={configCache[c.segmentSlug]?.stages ?? []}
              expanded={expandedId === c.id}
              onToggleExpand={() => handleToggleExpand(c)}
              onEdit={() => handleEdit(c)}
              onMarkContacted={() => handleAdded(c.id, c.name)}
              onSnooze={() => handleSnooze(c.id, c.name)}
              onDraft={() => setDraftingContact(c)}
              onUpdateFlags={(patch) => handleUpdateFlags(c.id, patch)}
              segmentLabel={c.segmentName}
              contactedLabel="Added on LinkedIn ✓"
              contactedBusy={busyId === c.id}
              confirmed={confirmedIds.has(c.id)}
              confirmedLabel="✓ Connected"
              noDueLabel="Not connected yet"
            />
          ))}
        </div>
        {suggestions.length === 0 && remaining === 0 && (
          <div className="empty">You&apos;ve used this week&apos;s LinkedIn allowance — check back after it resets on Monday.</div>
        )}
        {suggestions.length === 0 && remaining > 0 && (
          <div className="empty">No contacts waiting to be added — everyone in the database has a due date already.</div>
        )}
      </div>

      <div className="footnote">
        LinkedIn caps outgoing connection requests at {weeklyLimit} a week, resetting Monday. This list shows the
        highest-priority contacts who don&apos;t have a due date yet — meaning the outreach process hasn&apos;t started
        for them — capped to whatever&apos;s left of this week&apos;s allowance. Click &quot;Added on LinkedIn&quot; once
        you&apos;ve sent the request; that gives them a due date and moves them into the regular queue. Snoozing instead
        defers them 30 days without using up any of the allowance.
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
