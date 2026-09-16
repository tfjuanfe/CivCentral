"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  dismissReport,
  removeReportedContent,
  resolveReport,
} from "@/app/actions/reports";

// The three ways an archivist can close a report: leave the content alone,
// delete it, or mark it handled because they acted elsewhere (e.g. a ban).
// Each carries an optional note that is stored on the report.
export default function ReportActions({
  reportId,
  targetType,
}: {
  reportId: string;
  targetType: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "dismiss" | "resolve" | "remove") {
    if (
      kind === "remove" &&
      !window.confirm(
        `Permanently delete the reported ${targetType}? This cannot be undone.`,
      )
    )
      return;

    setBusy(kind);
    setError(null);
    const res =
      kind === "dismiss"
        ? await dismissReport(reportId, note)
        : kind === "resolve"
          ? await resolveReport(reportId, note)
          : await removeReportedContent(reportId);
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="report-actions">
      {error && <div className="alert alert-error">{error}</div>}
      <input
        type="text"
        value={note}
        maxLength={300}
        placeholder="Note for the log (optional)"
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-sm btn-danger"
          onClick={() => run("remove")}
          disabled={!!busy}
        >
          {busy === "remove" ? "…" : `🗑 Delete ${targetType}`}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => run("resolve")}
          disabled={!!busy}
        >
          {busy === "resolve" ? "…" : "✓ Mark handled"}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => run("dismiss")}
          disabled={!!busy}
        >
          {busy === "dismiss" ? "…" : "Dismiss"}
        </button>
      </div>
    </div>
  );
}
