import type { Metadata } from "next";
import { ClinicianShell, SectionHeading } from "@/app/components/clinician/ClinicianShell";
import { fullDate } from "@/app/components/clinician/format";
import { PracticeSummary } from "@/app/components/clinician/PracticeSummary";
import { Worklist } from "@/app/components/clinician/Worklist";
import { getSupabaseClient } from "@/lib/db/supabase";
import { buildRoster } from "@/lib/sim/roster";

/**
 * /clinician — the surgeon's office and the nurse line.
 *
 * The dense surface, and deliberately so: the family view spends its screen
 * on one sentence, this one spends it on rows. Five patients rather than one
 * because a worklist is the difference between a demo and a product, and
 * because the fifth costs the same as the first when the severity, the
 * condition and the fired rule all come out of the engine rather than out of
 * a fixture file's prose.
 *
 * Renders identically with no Supabase and no Anthropic credentials: the
 * roster is synthetic and the SBAR falls back to its deterministic form.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Worklist — Mend",
  description:
    "Post-op patients under remote monitoring, sorted worst first: severity, last check-in, open escalations and monitoring days accrued.",
};

export default function ClinicianPage() {
  const now = new Date();
  const patients = buildRoster(now);
  const persistence = getSupabaseClient() ? "Supabase" : "fixtures";

  return (
    <ClinicianShell active="/clinician">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 pt-8 pb-5">
        <div className="space-y-1.5">
          <h1 className="font-heading text-heading text-ink">Recovery worklist</h1>
          <p className="max-w-3xl text-label text-ink-secondary">
            Sorted by severity, then by who was heard from most recently. Every
            verdict below is the deterministic engine&apos;s, computed at render
            time — open a patient to see the rule that produced it.
          </p>
        </div>
        <p className="numeric text-meta text-ink-tertiary">
          {fullDate(now.toISOString())} · reading from {persistence}
        </p>
      </div>

      <PracticeSummary patients={patients} />

      <div className="space-y-4 pt-8">
        <SectionHeading
          title="Patients"
          meta={`${patients.length} monitored · worst first`}
        />
        <Worklist patients={patients} now={now} />
        <p className="max-w-4xl text-meta text-ink-tertiary">
          Synthetic patients. No protected health information is present in this
          repository, and no database credentials are required to render this
          page — with Supabase configured the same components read stored
          check-ins instead.
        </p>
      </div>
    </ClinicianShell>
  );
}
