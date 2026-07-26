import Link from "next/link";
import type { RosterPatient } from "@/lib/sim/roster";
import { PrnQueue } from "@/app/components/prn/PrnQueue";
import { fullDate } from "./format";
import { NeedsAttention } from "./NeedsAttention";
import { ClinicalSummary } from "./PracticeSummary";

export function ClinicianHub({
  patients,
  nowIso,
  persistence,
}: {
  patients: RosterPatient[];
  nowIso: string;
  persistence: string;
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b-2 border-line-strong pt-8 pb-4">
        <div className="space-y-1.5">
          <h1 className="font-heading text-heading text-ink">Clinician hub</h1>
          <p className="max-w-3xl text-label text-ink-secondary">
            Who needs attention first. Open a patient to review their chart, then
            place a named call from there. Full panel lives under{" "}
            <Link
              href="/clinician/patients"
              className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              Patients
            </Link>
            .
          </p>
        </div>
        <p className="numeric text-meta text-ink-tertiary">
          {fullDate(nowIso)} · reading from {persistence}
        </p>
      </div>

      <ClinicalSummary patients={patients} />

      <PrnQueue />

      <NeedsAttention patients={patients} />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border-2 border-line-strong bg-raised px-5 py-4">
        <div className="space-y-1">
          <p className="text-label font-medium text-ink">Panel directory</p>
          <p className="text-meta text-ink-secondary">
            {patients.length} monitored patients — open the full worklist for
            billing stats, every chart, and capture tools.
          </p>
        </div>
        <Link
          href="/clinician/patients"
          className="inline-flex min-h-11 items-center rounded-md bg-ink px-4 text-label font-medium text-paper hover:bg-ink/90"
        >
          View all patients
        </Link>
      </div>

      <p className="max-w-4xl text-meta text-ink-tertiary">
        Synthetic patients. No protected health information is present in this
        repository, and no database credentials are required to render this page —
        with Supabase configured the same components read stored check-ins instead.
      </p>
    </div>
  );
}
