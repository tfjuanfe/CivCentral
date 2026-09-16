"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reinstateUser, suspendUser } from "@/app/actions/reports";

const DURATIONS = [
  { days: 1, label: "1 day" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 0, label: "No end date" },
];

// Archivist control for suspending or banning an account. A suspension can be
// timed; a ban never lapses. Both leave reading open.
export default function ModerationControls({
  userId,
  username,
  suspended,
}: {
  userId: string;
  username: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(7);
  const [ban, setBan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    const what = ban
      ? `Ban ${username} permanently?`
      : days > 0
        ? `Suspend ${username} for ${days} day${days === 1 ? "" : "s"}?`
        : `Suspend ${username} with no end date?`;
    if (!window.confirm(what)) return;

    setBusy(true);
    setError(null);
    const res = await suspendUser(userId, days, ban);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function lift() {
    if (!window.confirm(`Reinstate ${username}?`)) return;
    setBusy(true);
    setError(null);
    const res = await reinstateUser(userId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  if (suspended) {
    return (
      <>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={lift}
          disabled={busy}
        >
          {busy ? "…" : "Reinstate"}
        </button>
        {error && <div className="alert alert-error">{error}</div>}
      </>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-sm btn-danger"
        onClick={() => setOpen(true)}
      >
        Suspend
      </button>
    );
  }

  return (
    <div className="ban-panel">
      {error && <div className="alert alert-error">{error}</div>}
      <p className="hint" style={{ margin: "0 0 6px" }}>
        Blocks posting, voting, and reporting. Reading stays open.
      </p>
      <div className="tag-row">
        {DURATIONS.map((d) => (
          <button
            key={d.days}
            type="button"
            className={`btn btn-sm ${
              !ban && days === d.days ? "" : "btn-secondary"
            }`}
            onClick={() => {
              setBan(false);
              setDays(d.days);
            }}
          >
            {d.label}
          </button>
        ))}
        <button
          type="button"
          className={`btn btn-sm ${ban ? "btn-danger" : "btn-secondary"}`}
          onClick={() => setBan(true)}
        >
          Ban
        </button>
      </div>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button
          className="btn btn-sm btn-danger"
          type="button"
          onClick={apply}
          disabled={busy}
        >
          {busy ? "…" : ban ? "Confirm ban" : "Confirm suspension"}
        </button>
        <button
          type="button"
          className="link-button"
          onClick={() => setOpen(false)}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
