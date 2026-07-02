"use client";

import { useState } from "react";
import type { Contact, Stage, Tier } from "@/lib/types";
import { createContact, updateContact } from "@/lib/api-client";

export default function ContactFormModal({
  segmentSlug,
  tiers,
  stages,
  contact,
  onClose,
  onSaved,
}: {
  segmentSlug: string;
  tiers: Tier[];
  stages: Stage[];
  contact?: Contact | null;
  onClose: () => void;
  onSaved: (contact: Contact) => void;
}) {
  const isEdit = !!contact;
  const [name, setName] = useState(contact?.name ?? "");
  const [brand, setBrand] = useState(contact?.brand ?? "");
  const [subBrand, setSubBrand] = useState(contact?.subBrand ?? "");
  const [role, setRole] = useState(contact?.role ?? "");
  const [followers, setFollowers] = useState(contact?.followers?.toString() ?? "");
  const [linkedin, setLinkedin] = useState(contact?.linkedin ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [tierId, setTierId] = useState<string>(contact?.tierId?.toString() ?? tiers[0]?.id.toString() ?? "");
  const [stageId, setStageId] = useState<string>(contact?.stageId?.toString() ?? stages[0]?.id.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        brand: brand.trim() || null,
        subBrand: subBrand.trim() || null,
        role: role.trim() || null,
        followers: followers.trim() ? Number(followers) : null,
        linkedin: linkedin.trim() || null,
        email: email.trim() || null,
        tierId: tierId ? Number(tierId) : null,
        stageId: stageId ? Number(stageId) : null,
      };
      const saved = isEdit
        ? await updateContact(contact!.id, payload)
        : await createContact({ ...payload, segmentSlug });
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? "Edit contact" : "Add contact"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-row full">
              <label htmlFor="name">Name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="form-row">
              <label htmlFor="brand">Brand</label>
              <input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div className="form-row">
              <label htmlFor="subBrand">Sub-brand</label>
              <input id="subBrand" value={subBrand} onChange={(e) => setSubBrand(e.target.value)} />
            </div>
            <div className="form-row full">
              <label htmlFor="role">Role</label>
              <input id="role" value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
            <div className="form-row">
              <label htmlFor="tier">Tier</label>
              <select id="tier" value={tierId} onChange={(e) => setTierId(e.target.value)}>
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="stage">Stage</label>
              <select id="stage" value={stageId} onChange={(e) => setStageId(e.target.value)}>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="followers">Followers</label>
              <input id="followers" type="number" min="0" value={followers} onChange={(e) => setFollowers(e.target.value)} />
            </div>
            <div className="form-row">
              <label htmlFor="linkedin">LinkedIn URL</label>
              <input id="linkedin" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
            </div>
            <div className="form-row full">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          {error && <div className="error-text">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
