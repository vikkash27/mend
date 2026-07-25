"use client";

import { useMemo } from "react";
import type { RosterPatient } from "@/lib/sim/roster";
import { ActionBoard } from "./ActionBoard";
import { SectionHeading } from "./ClinicianShell";
import { fullDate } from "./format";
import { Worklist } from "./Worklist";

/**
 * Full patient directory: call actions + the complete worklist table.
 */
export function PatientsDirectory({
  patients,
  nowIso,
  persistence,
}: {
  patients: RosterPatient[];
  nowIso: string;
  persistence: string;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pt-8 pb-2">
        <div className="space-y-1.5">
          <h1 className="font-heading text-heading text-ink">Patients</h1>
          <p className="max-w-3xl text-label text-ink-secondary">
            Full panel, worst first. Open a row for that patient&apos;s chart —
            overview, readings, handoff, billing, and audit.
          </p>
        </div>
        <p className="numeric text-meta text-ink-tertiary">
          {fullDate(nowIso)} · reading from {persistence}
        </p>
      </div>

      <ActionBoard patients={patients} />

      <div className="space-y-4">
        <SectionHeading
          title="Panel directory"
          meta={`${patients.length} monitored · worst first`}
        />
        <Worklist patients={patients} now={now} />
      </div>
    </div>
  );
}
