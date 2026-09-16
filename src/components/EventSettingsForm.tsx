"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateEventSettings } from "@/app/actions/admin";
import type { EventSettings } from "@/lib/types";

interface Toggle {
  key: keyof EventSettings;
  label: string;
  on: string; // what it means when enabled
  off: string; // what it means when disabled
}

const TOGGLES: Toggle[] = [
  {
    key: "ratingsEnabled",
    label: "Ratings",
    on: "Members can rate this event on the copper-to-netherite scale.",
    off: "The rating widget is hidden and no new ratings are accepted. Ratings already given are kept.",
  },
  {
    key: "ratingsPublic",
    label: "Public score",
    on: "Everyone sees the average score, the number of ratings, and the event's place on the Ratings board.",
    off: "Only you and the archivists see the score. Raters still see their own rating, and the event is listed without a score.",
  },
  {
    key: "requireVerifiedEmail",
    label: "Require a verified email",
    on: "Only members with a confirmed email address can rate or comment here.",
    off: "Any logged-in member can take part, verified or not. Adding lore entries still needs a verified email.",
  },
  {
    key: "commentsEnabled",
    label: "Discussion",
    on: "The comment thread is open for new comments and votes.",
    off: "The thread is closed. Existing comments stay visible but nobody can post or vote.",
  },
];

export default function EventSettingsForm({
  eventId,
  initial,
}: {
  eventId: string;
  initial: EventSettings;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<EventSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(key: keyof EventSettings) {
    setSaved(false);
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await updateEventSettings(eventId, settings);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const dirty = TOGGLES.some((t) => settings[t.key] !== initial[t.key]);

  return (
    <form className="form-wrap" onSubmit={onSubmit}>
      {error && <div className="alert alert-error">{error}</div>}
      {saved && !dirty && (
        <div className="alert alert-success">Settings saved.</div>
      )}

      <div className="settings-list">
        {TOGGLES.map((t) => {
          const on = settings[t.key];
          // "Public score" is meaningless while ratings are off entirely.
          const muted = t.key === "ratingsPublic" && !settings.ratingsEnabled;
          return (
            <div
              key={t.key}
              className={`setting-row${muted ? " setting-muted" : ""}`}
            >
              <div className="setting-copy">
                <strong>{t.label}</strong>
                <p className="hint">{on ? t.on : t.off}</p>
                {muted && (
                  <p className="hint">
                    Has no effect while ratings are switched off.
                  </p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={t.label}
                className={`switch${on ? " on" : ""}`}
                onClick={() => toggle(t.key)}
              >
                <span className="switch-knob" aria-hidden />
                <span className="switch-text">{on ? "On" : "Off"}</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="btn-row">
        <button className="btn" type="submit" disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save settings"}
        </button>
        <button
          type="button"
          className="link-button"
          onClick={() => router.push(`/events/${eventId}`)}
        >
          Back to the event
        </button>
      </div>
    </form>
  );
}
