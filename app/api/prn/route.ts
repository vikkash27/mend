import { NextRequest, NextResponse } from "next/server";
import { assessPrnRequest, PrnAssessment } from "@/lib/clinical/prn";
import {
  DEMO_MEDICATIONS,
  findMedication,
  MedicationAdministration,
} from "@/lib/clinical/medications";
import { buildPrnClinicianMessage } from "@/lib/telephony/prn-sms";
import { getSupabaseClient } from "@/lib/db/supabase";
import { fetchDemoPatient } from "@/lib/db/queries";
import { Severity } from "@/lib/clinical/types";

export const runtime = "nodejs";

/**
 * POST /api/prn — the patient asks for extra pain relief.
 *
 *   request ──▶ assessPrnRequest()  ──▶ clinician notification
 *               (deterministic)         (a human decides)
 *
 * The route never approves. It runs the assessment, records what was asked and
 * what the clinician was shown, and pings someone. Approval arrives later, from
 * a person, via PATCH.
 *
 * Degrades like the rest of the app: with no database the assessment still runs
 * and is returned, it simply is not persisted — a patient asking for help
 * should never be met with an error because storage is unavailable.
 */

interface PrnBody {
  medicationId?: string;
  painScore?: number;
  /** Today's verdict, so the clinical picture can outrank the dosing arithmetic. */
  currentSeverity?: Severity;
  firedRules?: string[];
  dayPostOp?: number;
}

function parseBody(raw: unknown): PrnBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.medicationId !== "string") return null;
  return {
    medicationId: b.medicationId,
    painScore: typeof b.painScore === "number" ? b.painScore : undefined,
    currentSeverity:
      b.currentSeverity === "red" || b.currentSeverity === "amber" || b.currentSeverity === "green"
        ? b.currentSeverity
        : "green",
    firedRules: Array.isArray(b.firedRules) ? (b.firedRules as string[]) : [],
    dayPostOp: typeof b.dayPostOp === "number" ? b.dayPostOp : undefined,
  };
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const body = parseBody(raw);
  if (!body) {
    return NextResponse.json(
      { error: "Expected { medicationId: string, painScore?: number }." },
      { status: 400 },
    );
  }

  const medication = findMedication(body.medicationId!);
  if (!medication) {
    return NextResponse.json(
      { error: `Unknown medication "${body.medicationId}".` },
      { status: 404 },
    );
  }

  const now = new Date();
  const supabase = getSupabaseClient();
  const warnings: string[] = [];

  // Dose history. Without it the assessment still runs, but it cannot see a
  // rising requirement or a recent dose — so say so rather than implying the
  // arithmetic was checked.
  let administrations: MedicationAdministration[] = [];
  let patientId: string | undefined;
  let patientFirstName = "the patient";

  if (supabase) {
    try {
      const patient = await fetchDemoPatient(supabase);
      if (patient) {
        patientId = patient.id;
        patientFirstName = patient.name.split(" ")[0] ?? patientFirstName;
        const { data } = await supabase
          .from("medication_administrations")
          .select("medication_id, taken_at, source")
          .eq("patient_id", patient.id)
          .gte("taken_at", new Date(now.getTime() - 72 * 3_600_000).toISOString())
          .order("taken_at", { ascending: false });
        administrations = (data ?? []).map((r) => ({
          medicationId: r.medication_id as string,
          takenAt: r.taken_at as string,
          source: r.source as MedicationAdministration["source"],
        }));
      }
    } catch {
      warnings.push("Dose history unavailable — interval and daily limits could not be checked.");
    }
  } else {
    warnings.push("Dose history unavailable — interval and daily limits could not be checked.");
  }

  const assessment: PrnAssessment = assessPrnRequest({
    medication,
    administrations,
    now,
    currentSeverity: body.currentSeverity ?? "green",
    firedRules: body.firedRules,
    painScore: body.painScore,
  });

  const notification = buildPrnClinicianMessage({
    patientFirstName,
    dayPostOp: body.dayPostOp ?? 0,
    medication,
    assessment,
  });

  // Persist the request and the frozen assessment. Best effort: a storage
  // failure must not stop the patient being told what happens next.
  let requestId: string | undefined;
  if (supabase && patientId) {
    try {
      const { data } = await supabase
        .from("prn_requests")
        .insert({
          patient_id: patientId,
          medication_id: medication.id,
          pain_score: body.painScore ?? null,
          assessment: assessment as unknown as Record<string, unknown>,
          notified_clinician_at: assessment.notify === "none" ? null : now.toISOString(),
        })
        .select("id")
        .single();
      requestId = data?.id as string | undefined;
    } catch {
      warnings.push("Request was assessed but could not be saved.");
    }
  }

  return NextResponse.json({
    requestId,
    assessment,
    clinicianNotification: notification,
    medication: {
      id: medication.id,
      name: medication.name,
      dose: medication.dose,
      isOpioid: medication.isOpioid ?? false,
    },
    ...(warnings.length > 0 ? { warnings } : {}),
  });
}

interface PendingRow {
  id: string;
  requested_at: string;
  pain_score: number | null;
  assessment: PrnAssessment;
  medication_id: string;
  patients: { name: string } | null;
  medications: { name: string; dose: string; is_opioid: boolean } | null;
}

/**
 * GET /api/prn — the patient's medication list.
 * GET /api/prn?pending=1 — the clinician's queue of undecided requests.
 *
 * The queue is deliberately *undecided-only*. A request that has been approved
 * or declined is a completed episode of care and belongs in the audit trail, not
 * in a worklist — leaving it visible is how a decided request gets decided twice.
 */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("pending") === "1") {
    const supabase = getSupabaseClient();
    // No database is not the same as no requests. Say which one it is, so an
    // empty queue is never read as "nobody is waiting" when it means "unknown".
    if (!supabase) {
      return NextResponse.json({ requests: [], unavailable: true });
    }
    try {
      const { data, error } = await supabase
        .from("prn_requests")
        .select("id, requested_at, pain_score, assessment, medication_id, patients (name), medications (name, dose, is_opioid)")
        .is("decision", null)
        .order("requested_at", { ascending: false })
        .limit(20);
      if (error) return NextResponse.json({ requests: [], unavailable: true });

      // The generated row types do not describe the embedded joins, so the
      // shape is asserted once here rather than spread through the mapping.
      const rows = (data ?? []) as unknown as PendingRow[];
      const requests = rows.map((r) => ({
        requestId: r.id,
        requestedAt: r.requested_at,
        patientName: r.patients?.name ?? "Patient",
        medicationName: r.medications?.name ?? r.medication_id,
        medicationDose: r.medications?.dose ?? "",
        isOpioid: Boolean(r.medications?.is_opioid),
        painScore: r.pain_score ?? undefined,
        assessment: r.assessment,
      }));
      return NextResponse.json({ requests });
    } catch {
      return NextResponse.json({ requests: [], unavailable: true });
    }
  }

  return NextResponse.json({
    medications: DEMO_MEDICATIONS.map((m) => ({
      id: m.id,
      name: m.name,
      dose: m.dose,
      route: m.route,
      schedule: m.schedule,
      frequency: m.frequency,
      indication: m.indication,
      isOpioid: m.isOpioid ?? false,
      withheld: Boolean(m.contraindicationNote),
      contraindicationNote: m.contraindicationNote,
    })),
  });
}

/**
 * PATCH /api/prn — the clinician's decision.
 *
 * This is the prescribing step, so it records who decided and when against the
 * assessment they were actually shown. The stored assessment is never rewritten:
 * a later change to the rules must not alter the record of what was on screen.
 */
export async function PATCH(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const b = (raw ?? {}) as Record<string, unknown>;
  const requestId = typeof b.requestId === "string" ? b.requestId : undefined;
  const decision = b.decision;
  const decidedBy = typeof b.decidedBy === "string" ? b.decidedBy : undefined;

  if (!requestId || !decidedBy) {
    return NextResponse.json(
      { error: "Expected { requestId: string, decision: string, decidedBy: string }." },
      { status: 400 },
    );
  }
  if (decision !== "approved" && decision !== "declined" && decision !== "call_placed") {
    return NextResponse.json(
      { error: 'decision must be "approved", "declined" or "call_placed".' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Decisions cannot be recorded without a database — not saved." },
      { status: 503 },
    );
  }

  try {
    const { error } = await supabase
      .from("prn_requests")
      .update({
        decision,
        decided_by: decidedBy,
        decided_at: new Date().toISOString(),
        decision_note: typeof b.note === "string" ? b.note : null,
      })
      .eq("id", requestId);

    if (error) {
      return NextResponse.json({ error: "Could not record the decision." }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: "Could not record the decision." }, { status: 500 });
  }

  return NextResponse.json({ requestId, decision, decidedBy });
}
