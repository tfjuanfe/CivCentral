import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canEditEntry } from "@/lib/permissions";
import { parseInfobox } from "@/lib/types";
import type { EntryType, Layer } from "@/lib/types";
import EntryForm from "@/components/EntryForm";

export const dynamic = "force-dynamic";

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/entries/${(await params).entryId}/edit`);

  const entry = await prisma.entry.findUnique({
    where: { id: (await params).entryId },
    include: {
      evidence: true,
      event: { include: { server: { select: { name: true } } } },
    },
  });

  if (!entry) notFound();
  if (!canEditEntry(user, entry)) redirect(`/entries/${entry.id}`);

  return (
    <>
      <nav className="breadcrumbs">
        <Link href={`/entries/${entry.id}`}>{entry.name}</Link> / Edit
      </nav>
      <h1 className="page-title">Edit entry</h1>
      <p className="lede">
        Saving creates a new revision. The previous version is kept.
      </p>

      {entry.reviewFeedback && (
        <div className="alert alert-error">
          <strong>An archivist requested changes:</strong>
          <br />
          {entry.reviewFeedback}
        </div>
      )}

      <EntryForm
        mode="edit"
        events={[
          {
            id: entry.eventId,
            name: entry.event.name,
            serverName: entry.event.server.name,
          },
        ]}
        initial={{
          entryId: entry.id,
          eventId: entry.eventId,
          type: entry.type as EntryType,
          layer: entry.layer as Layer,
          name: entry.name,
          attributedTo: entry.attributedTo ?? "",
          body: entry.body,
          infobox: parseInfobox(entry.infobox),
          evidence: entry.evidence.map((e) => ({
            url: e.url,
            caption: e.caption ?? "",
          })),
        }}
      />
    </>
  );
}
