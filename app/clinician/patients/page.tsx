import type { Metadata } from "next";
import { ClinicianShell } from "@/app/components/clinician/ClinicianShell";
import { PatientsDirectory } from "@/app/components/clinician/PatientsDirectory";
import { getSupabaseClient } from "@/lib/db/supabase";
import { buildRoster } from "@/lib/sim/roster";

/**
 * /clinician/patients — full panel directory.
 *
 * The worklist lives here (not beside a single chart). Open a row for the
 * chart; Call now and Ops stay available for the demo.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Patients — Mend",
  description:
    "Every patient on the remote-monitoring panel, worst first. Open a chart to dig in.",
};

export default async function PatientsPage() {
  const now = new Date();
  const patients = buildRoster(now);
  const persistence = getSupabaseClient() ? "Supabase" : "fixtures";

  return (
    <ClinicianShell
      active="/clinician/patients"
      crumbs={[{ label: "Patients" }]}
    >
      <PatientsDirectory
        patients={patients}
        nowIso={now.toISOString()}
        persistence={persistence}
      />
    </ClinicianShell>
  );
}
