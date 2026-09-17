import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageEvent, canReview } from "@/lib/permissions";
import EventSettingsForm from "@/components/EventSettingsForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Event page settings | CivCentral" };

export default async function EventSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/events/${eventId}/settings`);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { owner: { select: { username: true } } },
  });
  if (!event) notFound();
  if (!canManageEvent(user, event)) redirect(`/events/${eventId}`);

  const ratingCount = await prisma.eventRating.count({
    where: { eventId: event.id },
  });

  return (
    <>
      <nav className="breadcrumbs">
        <Link href="/">Home</Link> /{" "}
        <Link href={`/events/${event.id}`}>{event.name}</Link> / Page settings
      </nav>

      <h1 className="page-title">Page settings</h1>
      <p className="lede">
        How <strong>{event.name}</strong> behaves for everyone who visits it.
        These are yours to set as the host — they change this event&apos;s page
        only, and take effect as soon as you save.
      </p>

      <div className="card" style={{ marginBottom: 18, fontSize: "0.9rem" }}>
        <strong>Host:</strong>{" "}
        {event.owner ? (
          <Link href={`/users/${event.owner.username}`}>
            {event.owner.username}
          </Link>
        ) : (
          <span className="muted">unassigned — archivists only</span>
        )}
        <p className="muted" style={{ margin: "6px 0 0" }}>
          {ratingCount} rating{ratingCount === 1 ? "" : "s"} recorded so far.
          Turning ratings off hides the widget but never deletes what people
          have already given.
        </p>
      </div>

      <EventSettingsForm
        eventId={event.id}
        initial={{
          ratingsEnabled: event.ratingsEnabled,
          ratingsPublic: event.ratingsPublic,
          commentsEnabled: event.commentsEnabled,
          ratingMode: event.ratingMode === "verified" ? "verified" : "open",
        }}
      />

      <p className="muted" style={{ marginTop: 20, fontSize: "0.85rem" }}>
        Whatever you set here, archivists can still moderate this page: reported
        comments and entries are reviewed site-wide. See the{" "}
        <Link href="/legal/terms">Terms of Use</Link> for what that covers.
        {canReview(user) && (
          <>
            {" "}
            As an archivist you can also{" "}
            <Link href={`/events/${event.id}/edit`}>edit the event itself</Link>.
          </>
        )}
      </p>
    </>
  );
}
