import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canReview } from "@/lib/permissions";
import ServerForm from "@/components/ServerForm";

export const dynamic = "force-dynamic";

export default async function EditServerPage({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/servers/${(await params).serverId}/edit`);
  if (!canReview(user)) redirect(`/servers/${(await params).serverId}`);

  const server = await prisma.server.findUnique({
    where: { id: (await params).serverId },
  });
  if (!server) notFound();

  return (
    <>
      <nav className="breadcrumbs">
        <Link href={`/servers/${server.id}`}>{server.name}</Link> / Edit
      </nav>
      <h1 className="page-title">Edit server</h1>
      <ServerForm
        mode="edit"
        initial={{
          id: server.id,
          name: server.name,
          description: server.description,
          discordUrl: server.discordUrl,
        }}
      />
    </>
  );
}
