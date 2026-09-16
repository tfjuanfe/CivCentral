"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canParticipateInEvent, canSeeEventRatings } from "@/lib/permissions";
import { isValidRating } from "@/lib/ratings";
import { rateLimit, retryMessage } from "@/lib/ratelimit";

export type RateResult =
  | {
      ok: true;
      // null when the host keeps the aggregate private — the rater still gets
      // their own value back so the widget can show what they picked.
      average: number | null;
      count: number | null;
      userValue: number;
    }
  | { ok: false; error: string };

// Set, change, or clear the current user's rating of an event. Passing the same
// value they already gave clears it (toggle off), mirroring the star button.
// Upcoming events can't be rated — there's nothing to judge yet — and the host
// can switch ratings off for their event entirely.
export async function rateEvent(
  eventId: string,
  value: number,
): Promise<RateResult> {
  const user = await getCurrentUser();
  if (!isValidRating(value)) return { ok: false, error: "Invalid rating." };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      status: true,
      ownerId: true,
      ratingsEnabled: true,
      ratingsPublic: true,
      ratingMode: true,
    },
  });
  if (!event) return { ok: false, error: "That event no longer exists." };

  if (!event.ratingsEnabled)
    return {
      ok: false,
      error: "The host has turned ratings off for this event.",
    };

  // The host's participation policy decides whether a verified email is
  // needed here; login, role, and suspension checks always apply.
  const gate = canParticipateInEvent(
    user,
    { ratingMode: event.ratingMode === "verified" ? "verified" : "open" },
    "rate events",
  );
  if (!gate.ok) return gate;

  const userId = user!.id;
  const rl = await rateLimit(`rateevent:${userId}`, 40, 60);
  if (!rl.ok) return { ok: false, error: retryMessage(rl.retryAfter) };

  if (event.status === "upcoming")
    return {
      ok: false,
      error: "You can only rate events that have started.",
    };

  const existing = await prisma.eventRating.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });

  let userValue = value;
  if (existing && existing.value === value) {
    await prisma.eventRating.delete({ where: { id: existing.id } });
    userValue = 0;
  } else {
    await prisma.eventRating.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, value },
      update: { value },
    });
  }

  const agg = await prisma.eventRating.aggregate({
    where: { eventId },
    _avg: { value: true },
    _count: { value: true },
  });

  // A private score must not leave the server for a viewer who can't see it,
  // so it's withheld here rather than hidden in the component.
  const showAggregate = canSeeEventRatings(user, event);

  revalidatePath("/ratings");
  revalidatePath(`/events/${eventId}`);
  return {
    ok: true,
    average: showAggregate ? agg._avg.value : null,
    count: showAggregate ? agg._count.value : null,
    userValue,
  };
}
