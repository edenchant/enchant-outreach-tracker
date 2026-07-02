"use client";

import { useState } from "react";
import Link from "next/link";
import Waveform from "./Waveform";
import type { Segment, Stage, Tier } from "@/lib/types";
import { updateStageApi, updateTierApi } from "@/lib/api-client";

export default function SettingsForm({
  segment,
  initialTiers,
  initialStages,
}: {
  segment: Segment;
  initialTiers: Tier[];
  initialStages: Stage[];
}) {
  const [tiers, setTiers] = useState(initialTiers);
  const [stages, setStages] = useState(initialStages);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function saveTier(t: Tier, label: string, weight: number) {
    setSavingId(`tier-${t.id}`);
    try {
      const { tier } = await updateTierApi(t.id, { label, weight });
      setTiers((prev) => prev.map((x) => (x.id === tier.id ? tier : x)));
    } finally {
      setSavingId(null);
    }
  }

  async function saveStage(s: Stage, name: string, intervalDays: number, weight: number) {
    setSavingId(`stage-${s.id}`);
    try {
      const { stage } = await updateStageApi(s.id, { name, intervalDays, weight });
      setStages((prev) => prev.map((x) => (x.id === stage.id ? stage : x)));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <p className="eyebrow">Enchant · {segment.name} segment</p>
          <h1>Pipeline settings</h1>
        </div>
        <div className="top-actions">
          <Link href={`/segments/${segment.slug}`} className="btn">
            ← Back to queue
          </Link>
        </div>
        <Waveform />
      </header>

      <div className="settings-section">
        <h2>Tiers</h2>
        <table className="settings-table">
          <thead>
            <tr>
              <th>Letter</th>
              <th>Label</th>
              <th>Priority weight</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <TierRow key={t.id} tier={t} saving={savingId === `tier-${t.id}`} onSave={saveTier} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="settings-section">
        <h2>Stages (in outreach order)</h2>
        <table className="settings-table">
          <thead>
            <tr>
              <th>Stage</th>
              <th>Follow-up interval (days)</th>
              <th>Priority weight</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stages
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((s) => (
                <StageRow key={s.id} stage={s} saving={savingId === `stage-${s.id}`} onSave={saveStage} />
              ))}
          </tbody>
        </table>
      </div>

      <div className="footnote">
        Priority score = followers × tier weight × stage weight. Changing a weight recalculates the priority score
        for every contact currently on that tier or stage. The follow-up interval controls how many days after
        marking a contact as contacted before they become due again.
      </div>
    </div>
  );
}

function TierRow({
  tier,
  saving,
  onSave,
}: {
  tier: Tier;
  saving: boolean;
  onSave: (t: Tier, label: string, weight: number) => void;
}) {
  const [label, setLabel] = useState(tier.label);
  const [weight, setWeight] = useState(tier.weight.toString());

  return (
    <tr>
      <td>{tier.letter}</td>
      <td>
        <input value={label} onChange={(e) => setLabel(e.target.value)} />
      </td>
      <td>
        <input type="number" step="0.05" value={weight} onChange={(e) => setWeight(e.target.value)} />
      </td>
      <td>
        <button className="btn" disabled={saving} onClick={() => onSave(tier, label, Number(weight))}>
          {saving ? "Saving…" : "Save"}
        </button>
      </td>
    </tr>
  );
}

function StageRow({
  stage,
  saving,
  onSave,
}: {
  stage: Stage;
  saving: boolean;
  onSave: (s: Stage, name: string, intervalDays: number, weight: number) => void;
}) {
  const [name, setName] = useState(stage.name);
  const [intervalDays, setIntervalDays] = useState(stage.intervalDays.toString());
  const [weight, setWeight] = useState(stage.weight.toString());

  return (
    <tr>
      <td>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td>
        <input type="number" step="1" min="0" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
      </td>
      <td>
        <input type="number" step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} />
      </td>
      <td>
        <button
          className="btn"
          disabled={saving}
          onClick={() => onSave(stage, name, Number(intervalDays), Number(weight))}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </td>
    </tr>
  );
}
