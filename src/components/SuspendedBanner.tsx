import { formatDate } from "@/lib/format";

// Shown to a suspended member on every page. Deliberately not dismissible: it
// explains why their posting controls are refusing them, so hiding it would
// just leave them confused.
export default function SuspendedBanner({
  reason,
  until,
}: {
  reason: string | null;
  until: string | null;
}) {
  return (
    <div className="suspended-banner" role="alert">
      <span>
        <strong>Your account is suspended.</strong> You can still read the
        archive, but you can&apos;t post, vote, or submit lore
        {until ? ` until ${formatDate(until)}` : " — this suspension has no end date"}.
        {reason ? ` Reason: ${reason}` : ""} If you think this is a mistake,
        contact an archivist.
      </span>
    </div>
  );
}
