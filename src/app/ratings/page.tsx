import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canSeeEventRatings } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { eventSubjectKey } from "@/lib/ratings";
import { EventStatusBadge } from "@/components/Badges";
import RatingControl from "@/components/RatingControl";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Event ratings | WikiCiv" };

export default async function RatingsPage() {
  const user = await getCurrentUser();

  // Concluded events form the catalog of "past events" people can rate. Events
  // whose host switched ratings off are left out of the board entirely.
  const events = await prisma.event.findMany({
    where: { status: "concluded", ratingsEnabled: true },
    include: { server: { select: { id: true, name: true } } },
  });

  if (events.length === 0) {
    return (
      <>
        <nav className="breadcrumbs">
          <Link href="/">Home</Link> / Ratings
        </nav>
        <h1 className="page-title">Event ratings</h1>
        <p className="lede">
          A catalog of past events, ranked by how the community rated them on a
          copper-to-netherite scale.
        </p>
        <div className="empty-state">
          No concluded events yet. Once an event wraps up, it appears here for
          rating.
        </div>
      </>
    );
  }

  const eventIds = events.map((e) => e.id);
  const subjectKeys = eventIds.map(eventSubjectKey);

  const [ratingAgg, commentAgg, myRatings] = await Promise.all([
    prisma.eventRating.groupBy({
      by: ["eventId"],
      where: { eventId: { in: eventIds } },
      _avg: { value: true },
      _count: { value: true },
    }),
    prisma.comment.groupBy({
      by: ["subjectKey"],
      where: { subjectKey: { in: subjectKeys } },
      _count: { subjectKey: true },
    }),
    user
      ? prisma.eventRating.findMany({
          where: { userId: user.id, eventId: { in: eventIds } },
          select: { eventId: true, value: true },
        })
      : Promise.resolve([]),
  ]);

  const avgByEvent = new Map(
    ratingAgg.map((r) => [r.eventId, { avg: r._avg.value, count: r._count.value }]),
  );
  const commentsByEvent = new Map(
    commentAgg.map((c) => [
      c.subjectKey.replace(/^event::/, ""),
      c._count.subjectKey,
    ]),
  );
  const myByEvent = new Map(myRatings.map((r) => [r.eventId, r.value]));

  // Rated events first (highest average), then unrated, then most recent.
  // A host can keep their score private: the event still appears and can still
  // be rated, but it ranks as unrated and shows no number to outsiders.
  const ranked = events
    .map((e) => {
      const r = avgByEvent.get(e.id);
      const visible = canSeeEventRatings(user, e);
      return {
        event: e,
        visible,
        average: visible ? (r?.avg ?? null) : null,
        count: visible ? (r?.count ?? 0) : 0,
        comments: commentsByEvent.get(e.id) ?? 0,
        userValue: myByEvent.get(e.id) ?? 0,
      };
    })
    .sort((a, b) => {
      if ((b.average ?? -1) !== (a.average ?? -1))
        return (b.average ?? -1) - (a.average ?? -1);
      return (
        new Date(b.event.endDate ?? b.event.startDate).getTime() -
        new Date(a.event.endDate ?? a.event.startDate).getTime()
      );
    });

  return (
    <>
      <nav className="breadcrumbs">
        <Link href="/">Home</Link> / Ratings
      </nav>
      <h1 className="page-title">Event ratings</h1>
      <p className="lede">
        A catalog of past events, ranked by how the community rated them on a
        copper-to-netherite scale. Rate the ones you took part in and talk about
        them on each event&apos;s page.
      </p>

      <div className="list-stack">
        {ranked.map(({ event, visible, average, count, comments, userValue }, i) => (
          <article key={event.id} className="card rating-row">
            <div className="rating-rank" aria-hidden>
              #{i + 1}
            </div>
            <div className="rating-row-main">
              <div className="tag-row" style={{ marginBottom: 4 }}>
                <EventStatusBadge status={event.status} />
                {event.theme && (
                  <span className="badge badge-type">{event.theme}</span>
                )}
                <span className="muted">
                  {formatDate(event.startDate)}
                  {event.endDate ? ` – ${formatDate(event.endDate)}` : ""}
                </span>
              </div>
              <h3 style={{ margin: "2px 0" }}>
                <Link href={`/events/${event.id}`}>{event.name}</Link>
              </h3>
              <div className="meta muted">
                on{" "}
                <Link href={`/servers/${event.server.id}`}>
                  {event.server.name}
                </Link>
              </div>

              <RatingControl
                eventId={event.id}
                initialAverage={average}
                initialCount={count}
                initialUserValue={userValue}
                isLoggedIn={!!user}
                showAggregate={visible}
                privateToYou={!event.ratingsPublic && visible}
              />

              <div className="rating-row-foot">
                <Link
                  href={`/events/${event.id}`}
                  className="btn btn-sm btn-secondary"
                >
                  💬 Discuss ({comments})
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
