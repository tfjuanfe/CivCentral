"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageEvent, canReview } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import type { EventSettings, SessionUser } from "@/lib/types";

export type AdminResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type DeleteResult = { ok: true } | { ok: false; error: string };

async function ensureArchivist(): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!canReview(user)) return { ok: false, error: "Archivists only." };
  return { ok: true };
}

async function gateArchivist(): Promise<
  { ok: true; user: SessionUser } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!canReview(user) || !user)
    return { ok: false, error: "Archivists only." };
  return { ok: true, user };
}

export interface ServerInput {
  name: string;
  description: string;
}

export async function createServer(input: ServerInput): Promise<AdminResult> {
  const gate = await ensureArchivist();
  if (!gate.ok) return { ok: false, error: gate.error! };
  if (input.name.trim().length < 2)
    return { ok: false, error: "Server name is too short." };
  if (input.name.trim().length > 200)
    return { ok: false, error: "Server name is too long." };
  if ((input.description ?? "").length > 5000)
    return { ok: false, error: "Description is too long (5000 characters max)." };

  const server = await prisma.server.create({
    data: {
      name: input.name.trim(),
      description: input.description.trim(),
    },
  });
  revalidatePath("/");
  return { ok: true, id: server.id };
}

export async function updateServer(
  id: string,
  input: ServerInput,
): Promise<AdminResult> {
  const gate = await ensureArchivist();
  if (!gate.ok) return { ok: false, error: gate.error! };
  if (input.name.trim().length < 2)
    return { ok: false, error: "Server name is too short." };
  if (input.name.trim().length > 200)
    return { ok: false, error: "Server name is too long." };
  if ((input.description ?? "").length > 5000)
    return { ok: false, error: "Description is too long (5000 characters max)." };

  await prisma.server.update({
    where: { id },
    data: { name: input.name.trim(), description: input.description.trim() },
  });
  revalidatePath("/");
  revalidatePath(`/servers/${id}`);
  return { ok: true, id };
}

export interface EventInput {
  serverId: string;
  name: string;
  theme: string;
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd or ""
  status: "upcoming" | "ongoing" | "concluded";
  description: string;
  discordUrl: string;
  // Username of the member who runs the event. Empty means "no host", which
  // leaves the event archivist-managed. Archivists set this; the host then
  // customizes the event page without needing archivist rights.
  hostUsername?: string;
}

// Resolve the host username on an event form to a user id.
// Returns `undefined` for the id when the name doesn't match an account.
async function resolveHost(
  hostUsername: string | undefined,
): Promise<{ ok: true; hostId: string | null } | { ok: false; error: string }> {
  const name = (hostUsername ?? "").trim();
  if (!name) return { ok: true, hostId: null };

  const host = await prisma.user.findUnique({
    where: { username: name },
    select: { id: true },
  });
  if (!host)
    return { ok: false, error: `No account named "${name}" — check the spelling.` };
  return { ok: true, hostId: host.id };
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function validateEvent(input: EventInput): string | null {
  if (input.name.trim().length < 2) return "Event name is too short.";
  if (input.name.trim().length > 200) return "Event name is too long.";
  if ((input.theme ?? "").length > 200) return "Theme is too long.";
  if ((input.description ?? "").length > 5000)
    return "Description is too long (5000 characters max).";
  if (
    input.status !== "upcoming" &&
    input.status !== "ongoing" &&
    input.status !== "concluded"
  )
    return "Unknown status.";
  const discord = (input.discordUrl ?? "").trim();
  if (discord) {
    if (discord.length > 500) return "Discord link is too long.";
    if (!/^https?:\/\//i.test(discord))
      return "Discord link must start with http:// or https://.";
  }
  const start = parseDate(input.startDate);
  if (!start) return "A valid start date is required.";
  const end = parseDate(input.endDate);
  if (end && end < start) return "End date cannot be before the start date.";
  if (input.status === "concluded" && !end)
    return "A concluded event needs an end date.";
  return null;
}

export async function createEvent(input: EventInput): Promise<AdminResult> {
  const gate = await gateArchivist();
  if (!gate.ok) return { ok: false, error: gate.error };

  const problem = validateEvent(input);
  if (problem) return { ok: false, error: problem };

  const server = await prisma.server.findUnique({
    where: { id: input.serverId },
  });
  if (!server) return { ok: false, error: "That server no longer exists." };

  const host = await resolveHost(input.hostUsername);
  if (!host.ok) return host;

  const event = await prisma.event.create({
    data: {
      serverId: input.serverId,
      name: input.name.trim(),
      theme: input.theme.trim(),
      startDate: parseDate(input.startDate)!,
      endDate: parseDate(input.endDate),
      status: input.status,
      description: input.description.trim(),
      discordUrl: input.discordUrl.trim(),
      // Default the host to the archivist creating it, so every new event has
      // someone who can tune its page.
      hostId: host.hostId ?? gate.user.id,
    },
  });
  revalidatePath("/");
  revalidatePath("/upcoming");
  revalidatePath(`/servers/${input.serverId}`);
  return { ok: true, id: event.id };
}

// Edit an event's details. Open to its host as well as to archivists — but
// only an archivist can hand the event to a different host.
export async function updateEvent(
  id: string,
  input: EventInput,
): Promise<AdminResult> {
  const gate = await gateEventManager(id);
  if (!gate.ok) return { ok: false, error: gate.error };

  const problem = validateEvent(input);
  if (problem) return { ok: false, error: problem };

  let hostId: string | null | undefined;
  if (input.hostUsername !== undefined && canReview(gate.user)) {
    const host = await resolveHost(input.hostUsername);
    if (!host.ok) return host;
    hostId = host.hostId;
  }

  const event = await prisma.event.update({
    where: { id },
    data: {
      name: input.name.trim(),
      theme: input.theme.trim(),
      startDate: parseDate(input.startDate)!,
      endDate: parseDate(input.endDate),
      status: input.status,
      description: input.description.trim(),
      discordUrl: input.discordUrl.trim(),
      ...(hostId === undefined ? {} : { hostId }),
    },
  });
  revalidatePath("/");
  revalidatePath("/upcoming");
  revalidatePath(`/servers/${event.serverId}`);
  revalidatePath(`/events/${id}`);
  return { ok: true, id };
}

// Gate an action on "may manage THIS event" — its host, or any archivist.
async function gateEventManager(
  eventId: string,
): Promise<
  | { ok: true; user: SessionUser; event: { id: string; hostId: string | null } }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to manage this event." };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, hostId: true },
  });
  if (!event) return { ok: false, error: "That event no longer exists." };
  if (!canManageEvent(user, event))
    return {
      ok: false,
      error: "Only this event's host or an archivist can change it.",
    };
  return { ok: true, user, event };
}

// Save the host-controlled page settings. Separate from updateEvent so the
// settings page can't be used to rewrite an event's dates or description.
export async function updateEventSettings(
  eventId: string,
  settings: EventSettings,
): Promise<AdminResult> {
  const gate = await gateEventManager(eventId);
  if (!gate.ok) return { ok: false, error: gate.error };

  await prisma.event.update({
    where: { id: eventId },
    data: {
      ratingsEnabled: !!settings.ratingsEnabled,
      ratingsPublic: !!settings.ratingsPublic,
      requireVerifiedEmail: !!settings.requireVerifiedEmail,
      commentsEnabled: !!settings.commentsEnabled,
    },
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/settings`);
  revalidatePath("/ratings");
  return { ok: true, id: eventId };
}

// Hard-delete an event and everything filed under it (cascades to entries,
// evidence, revisions). Archivist only. The audit log entry survives.
export async function deleteEvent(eventId: string): Promise<DeleteResult> {
  const gate = await gateArchivist();
  if (!gate.ok) return gate;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { ok: false, error: "Event not found." };

  await prisma.event.delete({ where: { id: eventId } });

  await logAudit({
    action: "deleted_event",
    actorId: gate.user.id,
    actorName: gate.user.username,
    targetType: "event",
    targetId: event.id,
    targetName: event.name,
  });

  revalidatePath("/");
  revalidatePath(`/servers/${event.serverId}`);
  return { ok: true };
}

// Hard-delete a server and all its events/entries (cascade). Archivist only.
export async function deleteServer(serverId: string): Promise<DeleteResult> {
  const gate = await gateArchivist();
  if (!gate.ok) return gate;

  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) return { ok: false, error: "Server not found." };

  await prisma.server.delete({ where: { id: serverId } });

  await logAudit({
    action: "deleted_server",
    actorId: gate.user.id,
    actorName: gate.user.username,
    targetType: "server",
    targetId: server.id,
    targetName: server.name,
  });

  revalidatePath("/");
  return { ok: true };
}
