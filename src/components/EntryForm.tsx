"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ENTRY_TYPES, INFOBOX_FIELDS, TYPE_LABELS } from "@/lib/templates";
import type { EntryType, Layer } from "@/lib/types";
import { createEntry, updateEntry } from "@/app/actions/entries";
import Icon from "./Icon";
import MediaUpload from "./MediaUpload";

interface EventOption {
  id: string;
  name: string;
  serverName: string;
}

export interface EntryFormInitial {
  entryId?: string;
  eventId: string;
  type: EntryType;
  layer: Layer;
  name: string;
  attributedTo: string;
  body: string;
  infobox: Record<string, string>;
  evidence: { url: string; caption: string }[];
}

export default function EntryForm({
  mode,
  events,
  initial,
}: {
  mode: "create" | "edit";
  events: EventOption[];
  initial: EntryFormInitial;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [eventId, setEventId] = useState(initial.eventId);
  const [type, setType] = useState<EntryType>(initial.type);
  const [layer, setLayer] = useState<Layer>(initial.layer);
  const [name, setName] = useState(initial.name);
  const [attributedTo, setAttributedTo] = useState(initial.attributedTo);
  const [body, setBody] = useState(initial.body);
  const [infobox, setInfobox] = useState<Record<string, string>>(
    initial.infobox,
  );
  const [evidence, setEvidence] = useState<{ url: string; caption: string }[]>(
    initial.evidence.length ? initial.evidence : [{ url: "", caption: "" }],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fields = INFOBOX_FIELDS[type];

  const publishHint = useMemo(() => {
    if (layer === "record")
      return "Record entries are reviewed by an archivist before publishing.";
    return "Account entries publish immediately for trusted contributors; otherwise they enter the review queue.";
  }, [layer]);

  function setInfoboxValue(key: string, value: string) {
    setInfobox((prev) => ({ ...prev, [key]: value }));
  }

  function updateEvidence(i: number, patch: Partial<{ url: string; caption: string }>) {
    setEvidence((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function addEvidence() {
    setEvidence((prev) => [...prev, { url: "", caption: "" }]);
  }
  function removeEvidence(i: number) {
    setEvidence((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit(asDraft: boolean) {
    if (uploading || busy) return;
    setError(null);
    setBusy(true);
    try {
      const payload = {
        type,
        layer,
        name,
        attributedTo,
        body,
        infobox,
        evidence: evidence
          .filter((e) => e.url.trim())
          .map((e) => ({ url: e.url.trim(), caption: e.caption.trim() })),
        asDraft,
      };

      const res = isEdit
        ? await updateEntry(initial.entryId!, payload)
        : await createEntry({ ...payload, eventId });

      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      router.push(`/entries/${res.id}`);
      router.refresh();
    } catch {
      setError("Something went wrong saving the entry.");
      setBusy(false);
    }
  }

  return (
    <form
      className="form-wrap"
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
    >
      {error && <div className="alert alert-error">{error}</div>}

      {/* Event */}
      <div className="field">
        <label>Event</label>
        {isEdit ? (
          <input
            type="text"
            value={events.find((e) => e.id === eventId)?.name ?? ""}
            disabled
          />
        ) : (
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.serverName} · {e.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Type */}
      <div className="field">
        <label>
          Type{" "}
          {isEdit && <span className="hint">(fixed after creation)</span>}
        </label>
        <div className="tag-row">
          {ENTRY_TYPES.map((t) => (
            <button
              type="button"
              key={t}
              disabled={isEdit}
              className={`btn btn-sm ${type === t ? "" : "btn-secondary"}`}
              onClick={() => setType(t)}
            >
              <Icon name={t} className="badge-ico" /> {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Layer */}
      <div className="field">
        <label>
          Layer {isEdit && <span className="hint">(fixed after creation)</span>}
        </label>
        <div className="tag-row">
          <button
            type="button"
            disabled={isEdit}
            className={`btn btn-sm ${layer === "record" ? "" : "btn-secondary"}`}
            onClick={() => setLayer("record")}
          >
            <Icon name="record" className="badge-ico" /> Record (verifiable
            facts)
          </button>
          <button
            type="button"
            disabled={isEdit}
            className={`btn btn-sm ${layer === "account" ? "" : "btn-secondary"}`}
            onClick={() => setLayer("account")}
          >
            <Icon name="account" className="badge-ico" /> Account (in-character
            story)
          </button>
        </div>
        <p className="hint" style={{ marginTop: 6 }}>
          {publishHint}
        </p>
      </div>

      {/* Name */}
      <div className="field">
        <label htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Name of this ${TYPE_LABELS[type].toLowerCase()}`}
        />
        <p className="hint">
          Record and Account entries that share this exact name (within the same
          event &amp; type) appear together on one subject page.
        </p>
      </div>

      {/* Attribution (accounts only) */}
      {layer === "account" && (
        <div className="field">
          <label htmlFor="attr">Attributed to</label>
          <input
            id="attr"
            type="text"
            value={attributedTo}
            onChange={(e) => setAttributedTo(e.target.value)}
            placeholder="e.g. The Ashen Concord, or player IGN"
          />
          <p className="hint">
            Whose telling is this? Shown as “as told by …”.
          </p>
        </div>
      )}

      {/* Infobox template */}
      <fieldset>
        <legend>
          <Icon name={type} className="badge-ico" /> {TYPE_LABELS[type]} details
        </legend>
        <div className="field-row">
          {fields.map((f) => (
            <div className="field" key={f.key} style={{ marginBottom: 8 }}>
              <label htmlFor={`ib-${f.key}`}>{f.label}</label>
              <input
                id={`ib-${f.key}`}
                type="text"
                value={infobox[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => setInfoboxValue(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </fieldset>

      {/* Evidence (record only) */}
      {layer === "record" && (
        <fieldset>
          <legend>Evidence</legend>
          <p className="hint" style={{ marginTop: 0 }}>
            Record entries require at least one image URL or source link.
          </p>
          <MediaUpload disabled={busy || uploading || evidence.filter(e => e.url.trim()).length >= 20} onBusyChange={setUploading}
            onUploaded={(url, name) => setEvidence(prev => [...prev.filter(e => e.url.trim()), { url, caption: name.slice(0, 300) }])} />
          {evidence.map((ev, i) => (
            <div className="evidence-row" key={i}>
              <input
                type="url"
                placeholder="https://image-or-source-url"
                value={ev.url}
                onChange={(e) => updateEvidence(i, { url: e.target.value })}
              />
              <input
                type="text"
                placeholder="caption (optional)"
                value={ev.caption}
                onChange={(e) => updateEvidence(i, { caption: e.target.value })}
              />
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => removeEvidence(i)}
                aria-label="Remove evidence"
              >
                <Icon name="close" />
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-secondary" onClick={addEvidence}>
            + Add evidence
          </button>
        </fieldset>
      )}

      {/* Body */}
      <div className="field">
        <label htmlFor="body">Body (Markdown)</label>
        <MediaUpload disabled={busy || uploading} onBusyChange={setUploading} onUploaded={(url) =>
          setBody(prev => `${prev}\n\n![Uploaded media](${url})\n`)} />
        <textarea
          id="body"
          rows={14}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            layer === "record"
              ? "Describe the verifiable facts. **Markdown** supported."
              : "Tell the story as your character or faction sees it. **Markdown** supported."
          }
        />
        <p className="hint">
          Supports Markdown: **bold**, *italics*, # headings, - lists, &gt;
          quotes, [links](url), and tables.
        </p>
      </div>

      <div className="btn-row">
        <button type="submit" className="btn" disabled={busy || uploading}>
          {busy ? "Saving…" : isEdit ? "Save changes" : "Submit entry"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || uploading}
          onClick={() => submit(true)}
        >
          Save as draft
        </button>
        <button
          type="button"
          className="link-button"
          onClick={() => router.back()}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
