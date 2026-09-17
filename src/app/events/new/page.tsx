import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canHostEvents, canReview } from "@/lib/permissions";
import EventForm from "@/components/EventForm";

export const dynamic = "force-dynamic";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ serverId?: string }>;
}) {
  const query = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/events/new");
  if (!canHostEvents(user)) redirect("/");

  const isArchivist = canReview(user);
  const submitMode = isArchivist ? "create" : "request";

  const servers = await prisma.server.findMany({ orderBy: { name: "asc" } });

  // Archivists create directly and need a server to file under. Event hosts can
  // propose a brand-new server inline, so they don't need one to exist first.
  if (submitMode === "create" && servers.length === 0) {
    return (
      <div className="empty-state">
        Create a server first. <Link href="/servers/new">New server</Link>.
      </div>
    );
  }

  const validParam =
    query.serverId && servers.some((s) => s.id === query.serverId)
      ? query.serverId
      : null;
  const defaultServerId = validParam ?? servers[0]?.id ?? "";

  return (
    <>
      <nav className="breadcrumbs">
        <Link href="/">Home</Link> /{" "}
        {isArchivist ? "New event" : "Suggest an event"}
      </nav>
      <h1 className="page-title">
        {isArchivist ? "New event" : "Suggest an event"}
      </h1>
      <p className="lede">
        {isArchivist
          ? "Set up a civilization event. Contributors can then file Records and Accounts under it."
          : "Suggest a civilization event (upcoming or concluded) with a Discord link. An archivist will review and publish it."}
      </p>
      <EventForm
        mode="create"
        submitMode={submitMode}
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
        }}
      />
    </>
  );
}
