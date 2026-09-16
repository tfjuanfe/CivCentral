"use client";

import { useEffect, useRef, useState } from "react";
import { submitReport } from "@/app/actions/reports";
import {
  REPORT_REASONS,
  REPORT_DETAILS_MAX,
  type ReportReason,
  type ReportTargetType,
} from "@/lib/reports";

// "Report" link that opens a modal: pick a reason, optionally explain, send.
// Closes on Escape, on backdrop click, and on Cancel, and returns focus to the
// trigger so keyboard users aren't stranded.
export default function ReportButton({
  targetType,
  targetId,
  isLoggedIn,
  label = "Report",
}: {
  targetType: ReportTargetType;
  targetId: string;
  isLoggedIn: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [sent, setSent] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    setError(null);
    triggerRef.current?.focus();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) {
      setError("Pick a reason.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await submitReport({ targetType, targetId, reason, details });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSent(true);
    setOpen(false);
    setReason("");
    setDetails("");
  }

  if (sent) {
    return (
      <span className="report-sent" role="status">
        ⚑ Reported — thanks, an archivist will look.
      </span>
    );
  }

  const selected = REPORT_REASONS.find((r) => r.value === reason);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="link-button report-trigger"
        onClick={() => (isLoggedIn ? setOpen(true) : setNeedsLogin(true))}
        title={isLoggedIn ? "Report this to the archivists" : "Log in to report"}
      >
        ⚑ {label}
      </button>

      {needsLogin && (
        <span className="vote-error">
          <a href="/login">Log in</a> to report.
        </span>
      )}

      {open && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            tabIndex={-1}
            ref={dialogRef}
          >
            <div className="modal-head">
              <h3 id="report-title">Report this {targetType}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={close}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={onSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}
                <p className="muted" style={{ marginTop: 0 }}>
                  Reports go to the archivists, not to the author. Tell us what
                  the problem is and they&apos;ll decide what to do.
                </p>

                <fieldset className="reason-list">
                  <legend className="sr-only">Reason</legend>
                  {REPORT_REASONS.map((r) => (
                    <label key={r.value} className="reason-option">
                      <input
                        type="radio"
                        name="report-reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                      />
                      <span>
                        <strong>{r.label}</strong>
                        <span className="hint">{r.hint}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                <div className="field" style={{ marginTop: 12 }}>
                  <label htmlFor="report-details">
                    Details{" "}
                    <span className="hint">
                      {reason === "other" ? "(required)" : "(optional)"}
                    </span>
                  </label>
                  <textarea
                    id="report-details"
                    rows={3}
                    maxLength={REPORT_DETAILS_MAX}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder={
                      selected
                        ? `What makes this "${selected.label.toLowerCase()}"?`
                        : "Anything an archivist should know."
                    }
                  />
                  <p className="hint" style={{ margin: "4px 0 0" }}>
                    {details.length}/{REPORT_DETAILS_MAX}
                  </p>
                </div>
              </div>

              <div className="modal-foot">
                <button
                  type="submit"
                  className="btn btn-sm btn-danger"
                  disabled={busy || !reason}
                >
                  {busy ? "Sending…" : "Send report"}
                </button>
                <button
                  type="button"
                  className="link-button"
                  onClick={close}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
