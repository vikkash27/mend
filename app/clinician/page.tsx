import type { Metadata } from "next";
import { Suspense } from "react";
import { ClinicianHub } from "@/app/components/clinician/ClinicianHub";
import { ClinicianShell } from "@/app/components/clinician/ClinicianShell";
import { getSupabaseClient } from "@/lib/db/supabase";
import { buildRoster } from "@/lib/sim/roster";

/**
 * /clinician — the clinician's daily hub.
 *
 * Action board, needs-attention shortlist, full worklist, and Ops tools.
 * Live check-in opens on the demo patient’s chart. Renders from synthetic
 * roster fixtures without credentials.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clinician hub — Mend",
  description:
    "Post-op patients under remote monitoring: action board, worklist, and live check-in.",
};

export default async function ClinicianPage() {
  const now = new Date();
  const patients = buildRoster(now);
  const persistence = getSupabaseClient() ? "Supabase" : "fixtures";

  return (
    <ClinicianShell active="/clinician">
      <Suspense
        fallback={
          <div className="pt-8 text-label text-ink-secondary">Loading hub…</div>
        }
      >
        <ClinicianHub
          patients={patients}
          nowIso={now.toISOString()}
          persistence={persistence}
        />
      </Suspense>
    </ClinicianShell>
  );
}
