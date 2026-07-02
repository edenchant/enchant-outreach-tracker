"use client";

import { useState } from "react";
import type { Contact } from "@/lib/types";
import { draftMessage } from "@/lib/api-client";

export default function DraftModal({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const [step, setStep] = useState<"context" | "result">("context");
  const [contextInput, setContextInput] = useState("");
  const [kind, setKind] = useState<"email" | "linkedin">("email");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  async function generate(k: "email" | "linkedin", contextOverride?: string) {
    setLoading(true);
    setError(null);
    setCopied(false);
    const contextToUse = contextOverride !== undefined ? contextOverride : contextInput.trim() || undefined;
    try {
      const result = await draftMessage(contact.id, k, contextToUse);
      setDraft(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleGenerateWithContext() {
    setStep("result");
    generate(kind);
  }

  function handleSkip() {
    setContextInput("");
    setStep("result");
    generate(kind, "");
  }

  function handleKindChange(k: "email" | "linkedin") {
    setKind(k);
    generate(k);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
  }

  async function handleCopyEmail() {
    if (!contact.email) return;
    await navigator.clipboard.writeText(contact.email);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  }

  if (step === "context") {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>Draft a message for {contact.name}</h2>
          <div className="form-row full">
            <label htmlFor="draftContext">Anything specific to include? (optional)</label>
            <textarea
              id="draftContext"
              value={contextInput}
              onChange={(e) => setContextInput(e.target.value)}
              rows={5}
              className="draft-textarea"
              placeholder="e.g. a recent brand announcement, a mutual contact, something discussed at an event, a specific service to mention…"
              autoFocus
            />
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn" onClick={handleSkip}>
              Skip
            </button>
            <button className="btn primary" onClick={handleGenerateWithContext}>
              Generate draft
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <button className="btn" onClick={() => setStep("context")}>
            Edit context
          </button>
          <button className="btn" disabled={loading} onClick={() => generate(kind)}>
            Regenerate
          </button>
          <button className="btn" disabled={loading || !draft} onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </button>
          {kind === "email" && contact.email && (
            <button className="btn primary" onClick={handleCopyEmail}>
              {emailCopied ? "Email copied!" : "Copy email address"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
