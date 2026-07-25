import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadCallStageProps } from "@/app/components/call/load-call-stage-props";
import { ClinicianShell } from "@/app/components/clinician/ClinicianShell";
import { PatientChart } from "@/app/components/clinician/PatientChart";
import { parseChartTab } from "@/app/components/clinician/chart-tabs";
import { buildRoster, findPatient, rosterIds } from "@/lib/sim/roster";

/**
 * /clinician/[patientId] — patient workspace.
 *
 * Server-loads the roster patient and CallStage props; the client PatientChart
 * hosts tabs, in-place Live mode, Call now, Ops, and the xl worklist column.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ patientId: string }>;
}): Promise<Metadata> {
  const { patientId } = await params;
  const patient = findPatient(patientId);
  if (!patient) return { title: "Patient not found — Mend" };

  return {
    title: `${patient.name} — Mend`,
    description: `Day ${patient.dayPostOp} after ${patient.procedure}: trends against the phase envelope, the SBAR handoff, and the audit trail for every decision.`,
  };
}

export function generateStaticParams() {
  return rosterIds().map((patientId) => ({ patientId }));
}

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ tab?: string; live?: string }>;
}) {
  const { patientId } = await params;
  const sp = await searchParams;
  const now = new Date();
  const patients = buildRoster(now);
  const patient = findPatient(patientId, now);
  if (!patient) notFound();

  const callStageProps = await loadCallStageProps();
  const initialTab = parseChartTab(sp.tab);
  const initialLiveFocus = sp.live === "1";

  return (
    <ClinicianShell active="/clinician" breadcrumb={patient.name}>
      <PatientChart
        patient={patient}
        patients={patients}
        nowIso={now.toISOString()}
        callStageProps={callStageProps}
        initialTab={initialTab}
        initialLiveFocus={initialLiveFocus}
      />
    </ClinicianShell>
  );
}
