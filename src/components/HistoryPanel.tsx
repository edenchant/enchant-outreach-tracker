"use client";

import { useEffect, useState } from "react";
import { fetchHistory, type OutreachEventDTO } from "@/lib/api-client";
import type { Stage } from "@/lib/types";

export default function HistoryPanel({ contactId, stages }: { contactId: number; stages: Stage[] }) {
  const [events, setEvents] = useState<OutreachEventDTO[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHistory(contactId).then((e) => {
      if (!cancelled) setEvents(e);
    });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const stageName = (id: number | null) => stages.find((s) => s.id === id)?.name ?? "—";

  if (events === null) return <div className="history-panel">Loading history…</div>;
  if (events.length === 0) return <div className="history-panel">No outreach logged yet.</div>;

  return (
    <div className="history-panel">
      {events.map((e) => (
        <div key={e.id} className="event">
          {new Date(e.contactedAt).toLocaleString("en-GB")} —{" "}
          {e.type === "snoozed" ? `Snoozed (was ${stageName(e.fromStageId)})` : `${stageName(e.fromStageId)} → ${stageName(e.toStageId)}`}
        </div>
      ))}
    </div>
  );
}
