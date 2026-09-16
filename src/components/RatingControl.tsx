"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rateEvent } from "@/app/actions/ratings";
import { RATING_TIERS, tierForScore, tierName } from "@/lib/ratings";

export default function RatingControl({
  eventId,
  initialAverage,
  initialCount,
  initialUserValue,
  isLoggedIn,
  // When false the host keeps the score private: the viewer can still rate and
  // see their own tier, but not the average or how many people rated.
  showAggregate = true,
  // Set when the viewer is only shown the private score because they host the
  // event or archive it.
  privateToYou = false,
}: {
  eventId: string;
  initialAverage: number | null;
  initialCount: number;
  initialUserValue: number; // 0 = not yet rated
  isLoggedIn: boolean;
  showAggregate?: boolean;
  privateToYou?: boolean;
}) {
  const router = useRouter();
  const [average, setAverage] = useState(initialAverage);
  const [count, setCount] = useState(initialCount);
  const [userValue, setUserValue] = useState(initialUserValue);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avgTier = tierForScore(average);
  // Blocks fill up to the hovered tier, else up to the user's own rating.
  const fillTo = hover || userValue;

  async function choose(value: number) {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await rateEvent(eventId, value);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // The action returns nulls for the aggregate when the score is private.
    if (res.average !== null || res.count !== null) {
      setAverage(res.average);
      setCount(res.count ?? 0);
    }
    setUserValue(res.userValue);
    router.refresh();
  }

  return (
    <div className="rating-control">
      <div
        className="rating-tiers"
        onMouseLeave={() => setHover(0)}
        role="group"
        aria-label="Rate this event"
      >
        {RATING_TIERS.map((tier) => {
          const active = tier.value <= fillTo;
          return (
            <button
              key={tier.value}
              type="button"
              className={`tier-block${active ? " on" : ""}`}
              style={active ? { background: tier.color } : undefined}
              disabled={busy}
              onMouseEnter={() => setHover(tier.value)}
              onFocus={() => setHover(tier.value)}
              onClick={() => choose(tier.value)}
              aria-pressed={tier.value === userValue}
              title={
                isLoggedIn
                  ? `Rate ${tier.name}${tier.value === userValue ? " (click to clear)" : ""}`
                  : "Log in to rate"
              }
            >
              <span className="tier-num">{tier.value}</span>
            </button>
          );
        })}
        <span className="rating-hint muted">
          {hover ? tierName(hover) : userValue ? `You: ${tierName(userValue)}` : ""}
        </span>
      </div>

      <div className="rating-summary muted">
        {!showAggregate ? (
          <span>
            🔒 The host keeps this event&apos;s score private.
            {userValue ? ` Your rating: ${tierName(userValue)}.` : ""}
          </span>
        ) : count === 0 ? (
          <span>Not yet rated{isLoggedIn ? " — be the first." : "."}</span>
        ) : (
          <span>
            {privateToYou && <span title="Not shown to other members">🔒 </span>}
            <strong style={{ color: avgTier?.color }}>{avgTier?.name}</strong>{" "}
            · {average?.toFixed(1)} avg from {count} rating
            {count === 1 ? "" : "s"}
            {privateToYou && " (private)"}
          </span>
        )}
        {!isLoggedIn && (
          <span>
            {" "}
            · <a href="/login">Log in</a> to rate.
          </span>
        )}
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginTop: 6 }}>
          {error}
        </div>
      )}
    </div>
  );
}
