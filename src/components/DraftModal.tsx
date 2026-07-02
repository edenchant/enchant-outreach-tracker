"use client";

import { useEffect, useState } from "react";
import type { Contact } from "@/lib/types";
import { draftMessage } from "@/lib/api-client";

export default function DraftModal({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const [kind, setKind] = useState<"email" | "linkedin">("email");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate(k: "email" | "linkedin") {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const result = await draftMessage(contact.id, k);
      setDraft(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    draftMessage(contact.id, "email")
      .then((result) => {
        if (!cancelled) setDraft(result);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleKindChange(k: "email" | "linkedin") {
    setKind(k);
    generate(k);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
  }

  const mailtoHref = contact.email
    ? `mailto:${contact.email}?subject=${encodeURIComponent(`Quick hello from Enchant`)}&body=${encodeURIComponent(draft)}`
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Draft a message for {contact.name}</h2>
        <div className="seg" style={{ marginBottom: 14 }}>
          <button className={kind === "email" ? "active" : ""} onClick={() => handleKindChange("email")}>
            Email
          </button>
          <button className={kind === "linkedin" ? "active" : ""} onClick={() => handleKindChange("linkedin")}>
            LinkedIn message
          </button>
        </div>

        {loading && <div className="history-panel">Drafting…</div>}
        {error && <div className="error-text">{error}</div>}

        {!loading && !error && (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={kind === "linkedin" ? 5 : 10}
              className="draft-textarea"
            />
            {kind === "linkedin" && (
              <div className="score" style={{ marginTop: 4 }}>
                {draft.length} / 300 characters
              </div>
            )}
          </>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Close
          </button>
          <button className="btn" disabled={loading} onClick={() => generate(kind)}>
            Regenerate
          </button>
          <button className="btn" disabled={loading || !draft} onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </button>
          {kind === "email" && mailtoHref && (
            <a className="btn primary" href={mailtoHref}>
              Open in email
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
