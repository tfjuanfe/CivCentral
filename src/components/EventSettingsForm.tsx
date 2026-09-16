"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateEventSettings } from "@/app/actions/events";
import type { EventSettings } from "@/lib/types";

interface Toggle {
  key: "ratingsEnabled" | "ratingsPublic" | "commentsEnabled" | "verified";
  label: string;
  on: string; // what it means when enabled
  off: string; // what it means when disabled
}

// Each row describes what the setting means in its CURRENT state, so a host
// reads the consequence of where the switch is rather than a label they have to
// mentally invert.
const TOGGLES: Toggle[] = [
  {
    key: "ratingsEnabled",
    label: "Ratings",
    on: "Members can rate this event on the copper-to-netherite scale.",
    off: "The rating widget is hidden and no new ratings are accepted. Ratings already given are kept, not deleted.",
  },
  {
    key: "ratingsPublic",
    label: "Public score",
    on: "Everyone sees the average score, how many people rated, and this event's place on the Ratings board.",
    off: "Only you and the archivists see the score. Raters still see their own rating, and the event is listed without a number.",
  },
  {
    key: "verified",
    label: "Require a verified email",
    on: "Only members with a confirmed email address can rate or comment here.",
    off: "Any logged-in member can take part, verified or not. Submitting lore entries still needs a verified email.",
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

  // "verified" is a two-value string on the model, but a switch in the UI.
  function isOn(key: Toggle["key"]): boolean {
    if (key === "verified") return settings.ratingMode === "verified";
    return settings[key];
  }

  function toggle(key: Toggle["key"]) {
    setSaved(false);
    setSettings((s) =>
      key === "verified"
        ? { ...s, ratingMode: s.ratingMode === "verified" ? "open" : "verified" }
        : { ...s, [key]: !s[key] },
    );
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

  const dirty =
    settings.ratingsEnabled !== initial.ratingsEnabled ||
    settings.ratingsPublic !== initial.ratingsPublic ||
    settings.commentsEnabled !== initial.commentsEnabled ||
    settings.ratingMode !== initial.ratingMode;

  return (
    <form className="form-wrap" onSubmit={onSubmit}>
      {error && <div className="alert alert-error">{error}</div>}
      {saved && !dirty && (
        <div className="alert alert-success">Settings saved.</div>
      )}

      <div className="settings-list">
        {TOGGLES.map((t) => {
          const on = isOn(t.key);
          // A public-score switch says nothing while ratings are off entirely.
          const inert = t.key === "ratingsPublic" && !settings.ratingsEnabled;
          return (
            <div
              key={t.key}
              className={`setting-row${inert ? " setting-muted" : ""}`}
            >
              <div className="setting-copy">
                <strong>{t.label}</strong>
                <p className="hint">{on ? t.on : t.off}</p>
                {inert && (
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
