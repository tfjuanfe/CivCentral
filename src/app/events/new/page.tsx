import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canReview } from "@/lib/permissions";
import EventForm from "@/components/EventForm";

export const dynamic = "force-dynamic";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: { serverId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/events/new");
  if (!canReview(user)) redirect("/");

  const servers = await prisma.server.findMany({ orderBy: { name: "asc" } });
  if (servers.length === 0) {
    return (
      <div className="empty-state">
        Create a server first. <Link href="/servers/new">New server</Link>.
      </div>
    );
  }

  const defaultServerId =
    searchParams.serverId && servers.some((s) => s.id === searchParams.serverId)
      ? searchParams.serverId
      : servers[0].id;

  return (
    <>
      <nav className="breadcrumbs">
        <Link href="/">Home</Link> / New event
      </nav>
      <h1 className="page-title">New event</h1>
      <p className="lede">
        Set up a civilization event. Contributors can then file Records and
        Accounts under it.
      </p>
      <EventForm
        mode="create"
        canAssignHost
        servers={servers.map((s) => ({ id: s.id, name: s.name }))}
        initial={{
          serverId: defaultServerId,
          name: "",
          theme: "",
          startDate: "",
          endDate: "",
          status: "upcoming",
          description: "",
          discordUrl: "",
          hostUsername: "",
        }}
      />
    </>
  );
}
