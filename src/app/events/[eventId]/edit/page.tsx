import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canReview } from "@/lib/permissions";
import { toDateInputValue } from "@/lib/format";
import EventForm from "@/components/EventForm";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/events/${(await params).eventId}/edit`);
  if (!canReview(user)) redirect(`/events/${(await params).eventId}`);

  const event = await prisma.event.findUnique({
    where: { id: (await params).eventId },
    include: { server: { select: { id: true, name: true } } },
  });
  if (!event) notFound();

  return (
    <>
      <nav className="breadcrumbs">
        <Link href={`/events/${event.id}`}>{event.name}</Link> / Edit
      </nav>
      <h1 className="page-title">Edit event</h1>
      <EventForm
        mode="edit"
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
        }}
      />
    </>
  );
}
