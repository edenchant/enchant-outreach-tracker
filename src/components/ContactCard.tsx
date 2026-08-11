"use client";

import { useState } from "react";
import type { Contact, Stage } from "@/lib/types";
import HistoryPanel from "./HistoryPanel";

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

function linkedinActivityUrl(linkedin: string): string {
  return `${linkedin.replace(/\/+$/, "")}/recent-activity/all/`;
}

// Purely a visual read of list position, like a signal meter — not a
// re-statement of the priority score itself. Ranks 1-2 read as "hot"
// (all 5 bars lit), tapering down every couple of places.
function signalLevel(rank: number): number {
  return Math.max(1, Math.min(5, 6 - Math.ceil(rank / 2)));
}

export default function ContactCard({
  contact: c,
  rank,
  stages,
  expanded,
  onToggleExpand,
  onEdit,
  onMarkContacted,
  onDraft,
  onSnooze,
  onUpdateFlags,
  segmentLabel,
  contactedLabel = "Mark contacted",
  contactedBusy = false,
}: {
  contact: Contact;
  rank: number;
  stages: Stage[];
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onMarkContacted: () => void;
  onDraft: () => void;
  onSnooze: () => void;
  onUpdateFlags: (patch: { inTouch?: boolean; converted?: boolean }) => void;
  segmentLabel?: string;
  contactedLabel?: string;
  contactedBusy?: boolean;
}) {
  const tl = tierLetter(c.tier?.label);
  const level = signalLevel(rank);
  const [emailCopied, setEmailCopied] = useState(false);
  const flagClass = c.converted ? "flag-converted" : c.inTouch ? "flag-in-touch" : "";

  async function handleCopyEmail() {
    if (!c.email) return;
    await navigator.clipboard.writeText(c.email);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  }

  return (
    <div className={`card status-${c.status} ${flagClass}`}>
      <div className="rank-meter" aria-hidden="true">
        <div className="bars">
          {[1, 2, 3, 4, 5].map((bar) => (
            <span key={bar} className={bar <= level ? "lit" : ""} />
          ))}
        </div>
        <div className="rank-num">{rank}</div>
      </div>
      <div className="who">
        <div className="name-line">
          <button className="name" onClick={onToggleExpand}>
            {c.name}
          </button>
          <span className={`tier-badge tier-${tl}`}>{c.tier?.label ?? "—"}</span>
          {segmentLabel && <span className="segment-pill">{segmentLabel}</span>}
          {c.brandBonus && (
            <span className="brand-badge" title={`Boosted: ${c.brandBonus.eventType} at ${c.brand}, ${c.brandBonus.daysAgo}d ago`}>
              📰 {c.brandBonus.eventType} · {c.brandBonus.daysAgo}d ago
            </span>
          )}
        </div>
        <div className="meta">
          <b>{c.role || "Unknown role"}</b> · {c.brand || ""}
          {c.subBrand ? ` · ${c.subBrand}` : ""}
        </div>
        <div className="flag-checks">
          <label>
            <input
              type="checkbox"
              defaultChecked={c.inTouch}
              onChange={(e) => onUpdateFlags({ inTouch: e.target.checked })}
            />
            In touch
          </label>
          <label>
            <input
              type="checkbox"
              defaultChecked={c.converted}
              onChange={(e) => onUpdateFlags({ converted: e.target.checked })}
            />
            Converted
          </label>
        </div>
        {expanded && (
          <>
            <HistoryPanel contactId={c.id} stages={stages} />
            {c.promptContext && (
              <div className="history-panel" style={{ marginTop: 6 }}>
                <b>Context:</b> {c.promptContext}
              </div>
            )}
          </>
        )}
      </div>
      <div className="stage-pill">{c.stage?.name ?? "—"}</div>
      <div className="due-info">
        <div className="rel">{relTime(c.dueAt)}</div>
        <div className="score">
          priority {c.effectivePriorityScore.toFixed(1)}
          {c.brandBonus && c.effectivePriorityScore > c.priorityScore ? ` (base ${c.priorityScore.toFixed(1)})` : ""}
        </div>
      </div>
      <div className="actions">
        <div className="actions-grid">
          <button title="Draft a message" onClick={onDraft}>
            ✨
          </button>
          <button
            className={c.email ? "" : "missing"}
            title={c.email ? (emailCopied ? "Copied!" : "Copy email address") : "No email on file"}
            disabled={!c.email}
            onClick={handleCopyEmail}
          >
            {emailCopied ? "✓" : "✉"}
          </button>
          {c.linkedin ? (
            <a href={c.linkedin} target="_blank" rel="noreferrer" title="Open LinkedIn">
              in
            </a>
          ) : (
            <span className="missing" title="No LinkedIn on file">
              in
            </span>
          )}
          <button title="Snooze 30 days" onClick={onSnooze}>
            💤
          </button>
          <button title="Edit" onClick={onEdit}>
            ✎
          </button>
          {c.linkedin ? (
            <a href={linkedinActivityUrl(c.linkedin)} target="_blank" rel="noreferrer" title="Recent LinkedIn activity">
              📈
            </a>
          ) : (
            <span className="missing" title="No LinkedIn on file">
              📈
            </span>
          )}
        </div>
        <button className="contacted" onClick={onMarkContacted} disabled={contactedBusy}>
          {contactedBusy ? "Saving…" : contactedLabel}
        </button>
      </div>
    </div>
  );
}
