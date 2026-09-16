import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageEvent, canReview } from "@/lib/permissions";
import { toDateInputValue } from "@/lib/format";
import EventForm from "@/components/EventForm";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
}: {
  params: { eventId: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/events/${params.eventId}/edit`);

  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    include: {
      server: { select: { id: true, name: true } },
      host: { select: { username: true } },
    },
  });
  if (!event) notFound();

  // Hosts edit their own event; archivists edit any.
  if (!canManageEvent(user, event)) redirect(`/events/${params.eventId}`);
  const isArchivist = canReview(user);

  return (
    <>
      <nav className="breadcrumbs">
        <Link href={`/events/${event.id}`}>{event.name}</Link> / Edit
      </nav>
      <div className="entry-header">
        <h1 className="page-title" style={{ margin: 0 }}>
          Edit event
        </h1>
        <Link
          href={`/events/${event.id}/settings`}
          className="btn btn-sm btn-secondary"
        >
          ⚙ Page settings
        </Link>
      </div>
      <EventForm
        mode="edit"
        canAssignHost={isArchivist}
        servers={[{ id: event.server.id, name: event.server.name }]}
        initial={{
          id: event.id,
          serverId: event.serverId,
          name: event.name,
          theme: event.theme,
          startDate: toDateInputValue(event.startDate),
          endDate: toDateInputValue(event.endDate),
          status: event.status as "upcoming" | "ongoing" | "concluded",
          description: event.description,
          discordUrl: event.discordUrl,
          hostUsername: event.host?.username ?? "",
        }}
      />
    </>
  );
}
