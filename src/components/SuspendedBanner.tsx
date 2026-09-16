import { formatDate } from "@/lib/format";

// Shown to a suspended or banned member on every page. Deliberately not
// dismissible: it is the explanation for why their posting controls are
// refusing them, so hiding it would only leave them confused.
export default function SuspendedBanner({
  status,
  until,
}: {
  status: string;
  until: string | null;
}) {
  const banned = status === "banned";
  return (
    <div className="suspended-banner" role="alert">
      <span>
        <strong>
          Your account is {banned ? "banned" : "suspended"}.
        </strong>{" "}
        You can still read CivCentral, but you can&apos;t post, vote, report, or
        submit lore
        {banned
          ? "."
          : until
            ? ` until ${formatDate(until)}.`
            : " — this suspension has no end date."}{" "}
        If you think this is a mistake, contact an archivist.
      </span>
    </div>
  );
}
