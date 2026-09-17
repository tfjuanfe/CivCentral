import { prisma } from "@/lib/db";
import { loadSubject } from "@/lib/subjects";
import { parseInfobox, type EntryType } from "@/lib/types";
import { INFOBOX_FIELDS, TYPE_LABELS } from "@/lib/templates";

export const dynamic = "force-dynamic";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "entry"
  );
}

function isoDate(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

// GET /entries/:id/export -> the published subject (Record + Accounts) as a
// downloadable Markdown file. Only published content is included.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const anchor = await prisma.entry.findUnique({
    where: { id: (await params).entryId },
    include: { event: { include: { server: true } } },
  });
  if (!anchor) return new Response("Not found", { status: 404 });

  const { records, accounts } = await loadSubject(anchor);
  if (records.length === 0 && accounts.length === 0) {
    return new Response("Nothing published to export.", { status: 404 });
  }

  const type = anchor.type as EntryType;
  const out: string[] = [];

  out.push(`# ${anchor.name}`, "");
  out.push(
    `> ${TYPE_LABELS[type]} · ${anchor.event.name} (${anchor.event.server.name})`,
  );
  out.push(`> Exported from CivCentral on ${isoDate(new Date())}`, "");

  if (records.length > 0) {
    out.push("## Record", "");
    records.forEach((rec, i) => {
      if (records.length > 1) {
        out.push(`### Record claim ${i + 1}, by ${rec.author.username}`, "");
      }
      const info = parseInfobox(rec.infobox);
      const fields = INFOBOX_FIELDS[type].filter((f) => info[f.key]);
      if (fields.length > 0) {
        for (const f of fields) out.push(`- **${f.label}:** ${info[f.key]}`);
        out.push("");
      }
      if (rec.body.trim()) out.push(rec.body.trim(), "");
      if (rec.evidence.length > 0) {
        out.push("**Evidence**", "");
        for (const ev of rec.evidence) {
          out.push(`- ${ev.caption ? `${ev.caption}: ` : ""}${ev.url}`);
        }
        out.push("");
      }
      out.push(
        `*Submitted by ${rec.author.username} on ${isoDate(rec.createdAt)}*`,
        "",
      );
    });
  }

  if (accounts.length > 0) {
    out.push("## Accounts", "");
    for (const acc of accounts) {
      out.push(`### As told by ${acc.attributedTo || "Unknown"}`, "");
      if (acc.body.trim()) out.push(acc.body.trim(), "");
      out.push(
        `*Submitted by ${acc.author.username} on ${isoDate(acc.createdAt)}*`,
        "",
      );
    }
  }

  const markdown = out.join("\n");
  return new Response(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(anchor.name)}.md"`,
    },
  });
}
