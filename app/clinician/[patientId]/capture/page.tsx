import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClinicianShell } from "@/app/components/clinician/ClinicianShell";
import { PatientCapture } from "@/app/components/clinician/PatientCapture";
import { findPatient, rosterIds } from "@/lib/sim/roster";

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
    title: `Capture · ${patient.name} — Mend`,
    description: `Record vitals and ECG for ${patient.name}.`,
  };
}

export function generateStaticParams() {
  return rosterIds().map((patientId) => ({ patientId }));
}

export default async function PatientCapturePage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const patient = findPatient(patientId);
  if (!patient) notFound();

  return (
    <ClinicianShell
      active={`/clinician/${patient.id}`}
      crumbs={[
        { label: "Patients", href: "/clinician/patients" },
        { label: patient.name, href: `/clinician/${patient.id}` },
        { label: "Capture" },
      ]}
    >
      <div className="py-8">
        <PatientCapture
          patientId={patient.id}
          density="full"
          patientName={patient.name}
          dayPostOp={patient.dayPostOp}
          procedure={patient.procedure}
        />
      </div>
    </ClinicianShell>
  );
}
