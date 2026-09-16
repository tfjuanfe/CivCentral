import Link from "next/link";
import Icon from "@/components/Icon";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canHostEvents, canReview } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { EventStatusBadge } from "@/components/Badges";
import DeleteButton from "@/components/DeleteButton";
import { deleteServer } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function ServerPage({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  const [server, user] = await Promise.all([
    prisma.server.findUnique({
      where: { id: (await params).serverId },
      include: {
        events: {
          include: { _count: { select: { entries: true } } },
          orderBy: { startDate: "desc" },
        },
      },
    }),
    getCurrentUser(),
  ]);

  if (!server) notFound();
  const isArchivist = canReview(user);

  return (
    <>
      <nav className="breadcrumbs">
        <Link href="/">Home</Link> / {server.name}
      </nav>

      <div className="entry-header">
        <h1 className="page-title" style={{ margin: 0 }}>
          {server.name}
        </h1>
        {isArchivist && (
          <span className="inline-actions">
            <Link href={`/servers/${server.id}/edit`} className="btn btn-sm btn-secondary">
              Edit server
            </Link>
            <DeleteButton
              action={deleteServer.bind(null, server.id)}
              redirectTo="/"
              confirm={`Permanently delete the server "${server.name}" and ALL its events and entries? This cannot be undone.`}
            >
              <Icon name="trash" /> Delete server
            </DeleteButton>
          </span>
        )}
      </div>
      <p className="lede">{server.description}</p>

      {server.discordUrl && (
        <p style={{ margin: "8px 0 14px" }}>
          <a
            href={server.discordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm discord-btn"
          >
            <Icon name="discord" /> Join on Discord
          </a>
        </p>
      )}

      <h2 className="section-title" style={{ justifyContent: "space-between" }}>
        <span>
          <span className="cube-bullet" aria-hidden /> Events
        </span>
        {canHostEvents(user) && (
          <Link href={`/events/new?serverId=${server.id}`} className="btn btn-sm">
            + {isArchivist ? "New event" : "Suggest event"}
          </Link>
        )}
      </h2>
      {server.events.length === 0 ? (
        <div className="empty-state">No events recorded for this server yet.</div>
      ) : (
        <div className="list-stack">
          {server.events.map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className="card">
              <div className="tag-row" style={{ marginBottom: 6 }}>
                <EventStatusBadge status={e.status} />
                {e.theme && <span className="badge badge-type">{e.theme}</span>}
              </div>
              <h3 style={{ margin: "2px 0" }}>{e.name}</h3>
              <div className="meta muted">
                {e.status === "upcoming"
                  ? `Planned for ${formatDate(e.startDate)}`
                  : `${formatDate(e.startDate)} – ${
                      e.endDate ? formatDate(e.endDate) : "present"
                    }`}{" "}
                · {e._count.entries} entr{e._count.entries === 1 ? "y" : "ies"}
              </div>
              {e.description && (
                <p className="muted" style={{ marginBottom: 0 }}>
                  {e.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
