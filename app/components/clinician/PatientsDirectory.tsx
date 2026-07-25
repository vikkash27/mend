"use client";

import { useEffect, useMemo, useState } from "react";
import type { RosterPatient } from "@/lib/sim/roster";
import { ActionBoard } from "./ActionBoard";
import { HubOpsPanel } from "./HubOpsPanel";
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
  const [opsOpen, setOpsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#ops") setOpsOpen(true);
    const onHash = () => {
      if (window.location.hash === "#ops") setOpsOpen(true);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

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

      <section id="ops" className="scroll-mt-24 space-y-4 border-t border-line pt-8">
        <details
          open={opsOpen}
          onToggle={(e) => setOpsOpen((e.target as HTMLDetailsElement).open)}
          className="group"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-lg border border-line bg-raised px-4 py-3 text-label font-medium text-ink shadow-card marker:content-none [&::-webkit-details-marker]:hidden">
            <span>Ops — scenario, vitals, ECG, BLE, transcript</span>
            <span className="numeric text-meta font-normal text-ink-tertiary group-open:hidden">
              Show
            </span>
            <span className="numeric hidden text-meta font-normal text-ink-tertiary group-open:inline">
              Hide
            </span>
          </summary>
          <div className="pt-5">
            <HubOpsPanel />
          </div>
        </details>
      </section>
    </div>
  );
}
