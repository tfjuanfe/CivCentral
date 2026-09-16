import Link from "next/link";
import { prisma } from "@/lib/db";
import EntryCard from "@/components/EntryCard";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = ((await searchParams).q ?? "").trim();
  const ql = q.toLowerCase();

  let entries: Awaited<ReturnType<typeof findEntries>> = [];
  let events: Awaited<ReturnType<typeof findEvents>> = [];

  if (q) {
    [entries, events] = await Promise.all([findEntries(ql), findEvents(ql)]);
  }

  return (
    <>
      <h1 className="page-title">Search</h1>
      <form action="/search" method="get" className="field" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search entries by name, or events…"
          aria-label="Search query"
          autoFocus
        />
      </form>

      {!q ? (
        <p className="lede">Type a name above to search published lore.</p>
      ) : (
        <>
          <h2 className="section-title">
            <span className="cube-bullet" aria-hidden /> Entries (
            {entries.length})
          </h2>
          {entries.length === 0 ? (
            <div className="empty-state">No entries match “{q}”.</div>
          ) : (
            <div className="card-grid">
              {entries.map((e) => (
                <EntryCard key={e.id} entry={e} />
              ))}
            </div>
          )}

          <h2 className="section-title">
            <span className="cube-bullet" aria-hidden /> Events ({events.length})
          </h2>
          {events.length === 0 ? (
            <div className="empty-state">No events match “{q}”.</div>
          ) : (
            <div className="list-stack">
              {events.map((ev) => (
                <Link key={ev.id} href={`/events/${ev.id}`} className="card">
                  <h3 style={{ margin: "2px 0" }}>{ev.name}</h3>
                  <div className="muted">
                    {ev.server.name} · {formatDate(ev.startDate)} –{" "}
                    {formatDate(ev.endDate)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

// Postgres matches case-insensitively natively (`mode: "insensitive"`), so we
// filter in the database instead of loading every row and scanning in memory.
// `take` caps the work per query; a future upgrade is Postgres full-text
// search (tsvector). Matching includes the host (server) name so searching a
// host surfaces everything they've hosted.
async function findEntries(q: string) {
  const matched = await prisma.entry.findMany({
    where: {
      status: "published",
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { event: { server: { name: { contains: q, mode: "insensitive" } } } },
      ],
    },
    include: {
      author: { select: { username: true } },
      event: { select: { server: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Collapse to one result per subject (record + accounts share a name).
  const seen = new Map<string, (typeof matched)[number]>();
  for (const e of matched) {
    const key = `${e.eventId}::${e.type}::${e.name.toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing || (e.layer === "record" && existing.layer !== "record")) {
      seen.set(key, e);
    }
  }
  return [...seen.values()].slice(0, 50);
}

async function findEvents(q: string) {
  return prisma.event.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { theme: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { server: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
    include: { server: { select: { name: true } } },
    orderBy: { startDate: "desc" },
    take: 50,
  });
}
