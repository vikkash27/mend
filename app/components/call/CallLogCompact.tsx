import Link from "next/link";
import { SeverityChip } from "@/components/ui/severity-chip";
import type { CallLogRow } from "@/lib/telephony/call-log";
import { cn } from "@/lib/utils";
import { clockTime, shortDate } from "@/app/components/clinician/format";
import { compactCallLogRows } from "./call-stage-live";

const LABEL = "text-eyebrow font-medium uppercase";

/**
 * Compact past-call list for the full `/call` stage (variant `stage`).
 * In-progress live rows are filtered out — the stage header already marks live.
 */
export function CallLogCompact({
  rows,
  className,
}: {
  rows: CallLogRow[];
  className?: string;
}) {
  const past = compactCallLogRows(rows);
  if (past.length === 0) {
    return null;
  }

  return (
    <section
      className={cn(
        "shrink-0 border-t border-line bg-paper px-6 py-4 lg:px-10 2xl:px-14",
        className,
      )}
      aria-label="Past calls"
    >
      <p className={cn(LABEL, "mb-3 text-ink-tertiary")}>Past calls</p>
      <ul className="space-y-2.5">
        {past.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
          >
            <p className="min-w-0 flex-1 text-meta text-ink-secondary">
              {row.summary || "No transcript summary"}
            </p>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {row.decisionLevel ? (
                <SeverityChip level={row.decisionLevel} size="sm" />
              ) : null}
              <span className="numeric text-meta text-ink-tertiary">
                {typeof row.dayPostOp === "number" ? `day ${row.dayPostOp} · ` : ""}
                {shortDate(row.at)} {clockTime(row.at)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Single-line past-calls note for the hub embed. */
export function CallLogHubNote({
  rows,
  patientId,
  className,
}: {
  rows: CallLogRow[];
  patientId?: string;
  className?: string;
}) {
  const past = compactCallLogRows(rows);
  if (past.length === 0) {
    return null;
  }

  const label =
    past.length === 1 ? "1 past call" : `${past.length} past calls`;
  const href = patientId ? `/clinician/${patientId}` : "/clinician/patients";

  return (
    <p
      className={cn(
        "numeric shrink-0 border-t border-line px-4 py-2 text-meta text-ink-tertiary lg:px-6",
        className,
      )}
    >
      <Link href={href} className="underline-offset-2 hover:text-ink hover:underline">
        {label}
      </Link>
      {" on chart"}
    </p>
  );
}
