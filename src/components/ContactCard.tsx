"use client";

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

export default function ContactCard({
  contact: c,
  rank,
  stages,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onMarkContacted,
  onDraft,
  onSnooze,
  segmentLabel,
}: {
  contact: Contact;
  rank: number;
  stages: Stage[];
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMarkContacted: () => void;
  onDraft: () => void;
  onSnooze: () => void;
  segmentLabel?: string;
}) {
  const tl = tierLetter(c.tier?.label);

  return (
    <div className={`card status-${c.status}`}>
      <div className="rank">{rank}</div>
      <div className="who">
        <div className="name-line">
          <button className="name" onClick={onToggleExpand}>
            {c.name}
          </button>
          <span className={`tier-badge tier-${tl}`}>{c.tier?.label ?? "—"}</span>
          {segmentLabel && <span className="segment-pill">{segmentLabel}</span>}
        </div>
        <div className="meta">
          <b>{c.role || "Unknown role"}</b> · {c.brand || ""}
          {c.subBrand ? ` · ${c.subBrand}` : ""}
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
        <button title="Draft a message" onClick={onDraft}>
          ✨
        </button>
        <button title="Snooze 30 days" onClick={onSnooze}>
          💤
        </button>
        <button title="Edit" onClick={onEdit}>
          ✎
        </button>
        <button title="Delete" onClick={onDelete}>
          ×
        </button>
        <button className="contacted" onClick={onMarkContacted}>
          Mark contacted
        </button>
      </div>
    </div>
  );
}
