"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { banUser, unbanUser } from "@/app/actions/reports";

const DURATIONS = [
  { days: 1, label: "1 day" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 0, label: "Permanent" },
];

// Archivist control for suspending an account. Opens a small inline panel that
// asks for a reason and a length — the reason is shown to the banned user, so
// it is required rather than optional.
export default function BanControls({
  userId,
  username,
  banned,
}: {
  userId: string;
  username: string;
  banned: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitBan(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await banUser(userId, reason, days);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    setReason("");
    router.refresh();
  }

  async function lift() {
    if (!window.confirm(`Lift the suspension on ${username}?`)) return;
    setBusy(true);
    const res = await unbanUser(userId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  if (banned) {
    return (
      <button
        type="button"
        className="btn btn-sm btn-secondary"
        onClick={lift}
        disabled={busy}
      >
        {busy ? "…" : "Lift suspension"}
      </button>
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
    <form className="ban-panel" onSubmit={submitBan}>
      {error && <div className="alert alert-error">{error}</div>}
      <label htmlFor={`ban-reason-${userId}`} className="hint">
        Reason (shown to {username})
      </label>
      <input
        id={`ban-reason-${userId}`}
        type="text"
        value={reason}
        maxLength={500}
        autoFocus
        placeholder="e.g. Repeated harassment in event threads"
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="tag-row" style={{ marginTop: 8 }}>
        {DURATIONS.map((d) => (
          <button
            key={d.days}
            type="button"
            className={`btn btn-sm ${days === d.days ? "" : "btn-secondary"}`}
            onClick={() => setDays(d.days)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button
          className="btn btn-sm btn-danger"
          type="submit"
          disabled={busy || !reason.trim()}
        >
          {busy ? "…" : "Confirm suspension"}
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
    </form>
  );
}
