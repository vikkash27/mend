import type { ReactNode } from "react";
import { SeverityChip } from "@/components/ui/severity-chip";
import { billableUnits, evaluateBilling } from "@/lib/clinical/billing";
import type { Severity } from "@/lib/clinical/types";
import type { RosterPatient } from "@/lib/sim/roster";

/**
 * Hub / directory summary strips.
 *
 * ClinicalSummary answers "who needs me?" for the morning triage board.
 * BillingSummary answers "is the panel paying for itself?" on Patients.
 */

function Stat({
  label,
  children,
  detail,
}: {
  label: string;
  children: ReactNode;
  detail?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-5 py-4 first:pl-0">
      <p className="eyebrow text-ink">{label}</p>
      <div className="flex min-h-8 flex-wrap items-center gap-2">{children}</div>
      {detail ? (
        <p className="numeric text-meta text-ink-tertiary">{detail}</p>
      ) : null}
    </div>
  );
}

function Figure({ value, unit }: { value: number | string; unit?: string }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span className="numeric text-2xl leading-none font-medium text-ink">
        {value}
      </span>
      {unit ? <span className="text-meta text-ink-tertiary">{unit}</span> : null}
    </p>
  );
}

export function ClinicalSummary({ patients }: { patients: RosterPatient[] }) {
  const count = (level: Severity) =>
    patients.filter((p) => p.latest.decision.level === level).length;

  const openEscalations = patients.reduce((sum, p) => sum + p.openEscalations, 0);
  const urgent = count("red");
  const attention = count("amber");
  const onTrack = count("green");

  return (
    <div className="grid grid-cols-1 divide-y-2 divide-line-strong border-y-2 border-line-strong sm:grid-cols-3 sm:divide-x-2 sm:divide-y-0">
      <Stat label="On the panel" detail="monitored patients">
        <Figure value={patients.length} unit="patients" />
      </Stat>

      <Stat label="Needing a clinician" detail={`${onTrack} on track`}>
        {urgent > 0 ? (
          <SeverityChip level="red" size="sm" label={`${urgent} urgent`} />
        ) : null}
        {attention > 0 ? (
          <SeverityChip
            level="amber"
            size="sm"
            label={`${attention} needs attention`}
          />
        ) : null}
        {urgent + attention === 0 ? (
          <SeverityChip level="green" size="sm" label="all on track" />
        ) : null}
      </Stat>

      <Stat label="Open escalations" detail="unacknowledged, all patients">
        <Figure value={openEscalations} unit="to review" />
      </Stat>
    </div>
  );
}

export function BillingSummary({ patients }: { patients: RosterPatient[] }) {
  const monitoringDays = patients.reduce(
    (sum, p) => sum + p.billing.monitoringDays,
    0,
  );
  const managementMinutes = patients.reduce(
    (sum, p) => sum + p.billing.managementMinutes,
    0,
  );
  const units = patients.reduce(
    (sum, p) => sum + billableUnits(evaluateBilling(p.billing)),
    0,
  );
  const supplyReady = patients.filter((p) => p.billing.monitoringDays >= 16).length;

  return (
    <div className="grid grid-cols-1 divide-y-2 divide-line-strong border-y-2 border-line-strong sm:grid-cols-3 sm:divide-x-2 sm:divide-y-0">
      <Stat
        label="Monitoring days"
        detail={`${supplyReady} of ${patients.length} past the 16-day supply bar`}
      >
        <Figure value={monitoringDays} unit="this period" />
      </Stat>

      <Stat label="Management time" detail="logged against RPM/RTM review">
        <Figure value={managementMinutes} unit="minutes" />
      </Stat>

      <Stat label="Claimable units" detail="RPM and RTM, accrued not submitted">
        <Figure value={units} unit="codes" />
      </Stat>
    </div>
  );
}

/** @deprecated Prefer ClinicalSummary / BillingSummary for surface-specific layout. */
export function PracticeSummary({ patients }: { patients: RosterPatient[] }) {
  return (
    <div className="space-y-0">
      <ClinicalSummary patients={patients} />
      <BillingSummary patients={patients} />
    </div>
  );
}
