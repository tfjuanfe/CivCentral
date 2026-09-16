"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageEvent } from "@/lib/permissions";
import type { EventSettings, SessionUser } from "@/lib/types";

export type EventSettingsResult =
  | { ok: true }
  | { ok: false; error: string };

// Gate an action on "may manage THIS event" — its owner, or any archivist.
async function gateEventManager(
  eventId: string,
): Promise<
  | { ok: true; user: SessionUser; event: { id: string; ownerId: string | null } }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to manage this event." };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, ownerId: true },
  });
  if (!event) return { ok: false, error: "That event no longer exists." };
  if (!canManageEvent(user, event))
    return {
      ok: false,
      error: "Only this event's host or an archivist can change it.",
    };
  return { ok: true, user, event };
}

// Save the host-controlled page settings.
//
// Deliberately separate from updateEvent: the settings screen is open to a
// host who is not an archivist, and it must not become a way to rewrite an
// event's name, dates, or description.
export async function updateEventSettings(
  eventId: string,
  settings: EventSettings,
): Promise<EventSettingsResult> {
  const gate = await gateEventManager(eventId);
  if (!gate.ok) return gate;

  if (settings.ratingMode !== "open" && settings.ratingMode !== "verified")
    return { ok: false, error: "Unknown participation setting." };

  await prisma.event.update({
    where: { id: eventId },
    data: {
      ratingsEnabled: !!settings.ratingsEnabled,
      ratingsPublic: !!settings.ratingsPublic,
      commentsEnabled: !!settings.commentsEnabled,
      ratingMode: settings.ratingMode,
    },
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/settings`);
  revalidatePath("/ratings");
  return { ok: true };
}
