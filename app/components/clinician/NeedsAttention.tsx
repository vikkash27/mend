import Link from "next/link";
import { SeverityChip } from "@/components/ui/severity-chip";
import type { RosterPatient } from "@/lib/sim/roster";
import { chartTabHref } from "./chart-tabs";
import { SectionHeading } from "./ClinicianShell";
import { pickNeedsAttention } from "./needs-attention";

export function NeedsAttention({ patients }: { patients: RosterPatient[] }) {
  const shortlist = pickNeedsAttention(patients);

  return (
    <section className="space-y-3">
      <SectionHeading
        title="Needs attention"
        meta={
          shortlist.length > 0
            ? `${shortlist.length} red or amber · worst first`
            : "all on track"
        }
      />

      {shortlist.length === 0 ? (
        <p className="rounded-md border-2 border-line-strong bg-wash px-4 py-3 text-meta text-ink-secondary">
          No patients need attention right now.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-md border-2 border-line-strong bg-raised">
          {shortlist.map((patient) => {
            const level = patient.latest.decision.level;
            return (
              <li
                key={patient.id}
                className="border-b-2 border-line last:border-b-0"
              >
                <Link
                  href={chartTabHref(patient.id, "overview")}
                  className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5 hover:bg-wash"
                >
                  <span className="min-w-0 space-y-0.5">
                    <span className="block text-label font-medium text-ink">
                      {patient.name}
                    </span>
                    <span className="numeric block text-meta text-ink-tertiary">
                      {patient.procedure} · Day {patient.dayPostOp}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <SeverityChip level={level} size="sm" />
                    <span className="text-meta font-medium text-ink">Open chart</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
