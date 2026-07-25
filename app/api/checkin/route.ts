import { NextResponse } from "next/server";
import { analyzeCheckinVoiceBiomarkers } from "@/lib/amplifier/analyze-checkin";
import type { VoiceBiomarkersRecord } from "@/lib/amplifier/types";
import { composeDecision } from "@/lib/clinical/compose";
import { getPhase } from "@/lib/clinical/recovery-graph";
import { evaluate } from "@/lib/clinical/red-flag-engine";
import { DEFAULT_PATIENT_FIRST_NAME, firstName } from "@/lib/clinical/scripts";
import { assessNovelty, type PriorDecision } from "@/lib/clinical/novelty";
import { buildSymptomsHistory } from "@/lib/clinical/symptoms-history";
import { evaluateTrends } from "@/lib/clinical/trends";
import type { Decision, EcgReading, Symptoms, VitalsReading } from "@/lib/clinical/types";
import { buildCheckinVitalsInsert } from "@/lib/db/build-checkin-vitals-insert";
import { planEscalationAfterCheckin } from "@/lib/db/escalation-audit";
import {
  fetchDemoPatient,
  fetchLatestEcg,
  fetchLatestVitals,
  fetchRecentCheckins,
  fetchVitalsHistory,
  insertCheckin,
  insertEscalation,
  insertVitals,
  linkEscalationCheckin,
  updateCheckinAfterBiomarkers,
} from "@/lib/db/queries";
import { getSupabaseClient } from "@/lib/db/supabase";
import { extractSymptoms } from "@/lib/llm/extract";
import { generateSbar } from "@/lib/llm/sbar";
import { getActiveScenario, loadActiveScenario } from "@/lib/sim/active-scenario";
import { scenarioEcg, scenarioHistory, scenarioVitals } from "@/lib/sim/fixtures";
import { notifyCaregiver } from "@/lib/telephony/sms";

/**
 * POST /api/checkin — the full check-in pipeline.
 *
 * transcript -> extractSymptoms (Claude, tool-forced) -> load vitals/ECG/
 * history -> evaluate() + evaluateTrends() -> composeDecision() ->
 * generateSbar() on non-green -> persist checkin + escalation -> respond.
 *
 * Unlike /api/triage, this route is not on a live-call latency budget, so
 * it is allowed to call Claude (symptom extraction, and SBAR generation
 * only when the composed decision is non-green). Severity itself still
 * comes from nowhere but `evaluate()`, possibly raised by
 * `composeDecision()` — Claude's output here can only ever describe or
 * summarize an already-decided Decision, never set or change its level.
 */

const DEFAULT_DAY_POST_OP = 4;
const DEMO_PATIENT_PROCEDURE_FALLBACK = "hip hemiarthroplasty";

interface CheckinRequestBody {
  transcript: string;
  dayPostOp?: number;
  /** ElevenLabs conversation id from POST /api/call — triggers pending voice_biomarkers + fire-and-forget analyze. */
  conversationId?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBody(raw: unknown): CheckinRequestBody | undefined {
  if (!isPlainObject(raw)) {
    return undefined;
  }
  if (typeof raw.transcript !== "string" || raw.transcript.trim().length === 0) {
    return undefined;
  }
  if (
    raw.dayPostOp !== undefined &&
    (typeof raw.dayPostOp !== "number" || !Number.isFinite(raw.dayPostOp))
  ) {
    return undefined;
  }
  if (
    raw.conversationId !== undefined &&
    (typeof raw.conversationId !== "string" || raw.conversationId.trim().length === 0)
  ) {
    return undefined;
  }

  return {
    transcript: raw.transcript,
    dayPostOp: raw.dayPostOp as number | undefined,
    conversationId:
      typeof raw.conversationId === "string" ? raw.conversationId.trim() : undefined,
  };
}

/** Fire-and-forget post-call Amplifier analyze. Never awaited on the check-in
 * response path — UI polls / re-runs via console "Run voice biomarkers". */
function triggerVoiceBiomarkerAnalyze(args: {
  checkinId: string;
  conversationId: string;
  dayPostOp: number;
  symptoms: Symptoms;
  vitals: VitalsReading;
  ecg: EcgReading | undefined;
  priorDecision: Decision;
}): void {
  void (async () => {
    try {
      const result = await analyzeCheckinVoiceBiomarkers({
        conversationId: args.conversationId,
        dayPostOp: args.dayPostOp,
        symptoms: args.symptoms,
        vitals: args.vitals,
        ecg: args.ecg,
        priorDecision: args.priorDecision,
      });
      const supabase = getSupabaseClient();
      if (!supabase) {
        return;
      }
      const ok = await updateCheckinAfterBiomarkers(supabase, args.checkinId, {
        voice_biomarkers: result.record,
        decision: result.decision,
      });
      if (!ok) {
        console.warn(
          "[api/checkin] updateCheckinAfterBiomarkers returned false after voice analyze.",
        );
      }
    } catch (err) {
      console.warn("[api/checkin] fire-and-forget voice biomarker analyze failed:", err);
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const errorRecord: VoiceBiomarkersRecord = {
        status: "error",
        conversationId: args.conversationId,
        error: err instanceof Error ? err.message : "Voice biomarker analyze failed.",
      };
      try {
        await updateCheckinAfterBiomarkers(supabase, args.checkinId, {
          voice_biomarkers: errorRecord,
        });
      } catch (persistErr) {
        console.warn(
          "[api/checkin] failed to persist voice_biomarkers error status:",
          persistErr,
        );
      }
    }
  })();
}

interface ClinicalContext {
  patientId: string | undefined;
  patientName: string;
  procedure: string;
  caregiverPhone: string | undefined;
  vitals: VitalsReading;
  ecg: EcgReading | undefined;
  history: VitalsReading[];
  /** Previous verdicts, oldest first — used only to say whether today's finding is new. */
  priorDecisions: PriorDecision[];
}

/** Loads the demo patient's identity plus latest vitals/ECG/history from
 * Supabase, falling back to fixtures whenever Supabase is unavailable,
 * unreachable, slow, or has no rows yet — never throws, never hangs
 * (lib/db/queries.ts times out every read). */
async function loadClinicalContext(): Promise<ClinicalContext> {
  const now = new Date();
  const fallbackScenario = await loadActiveScenario();
  const fallback: ClinicalContext = {
    patientId: undefined,
    patientName: DEFAULT_PATIENT_FIRST_NAME,
    procedure: DEMO_PATIENT_PROCEDURE_FALLBACK,
    caregiverPhone: undefined,
    vitals: scenarioVitals(fallbackScenario, now),
    ecg: scenarioEcg(fallbackScenario),
    history: scenarioHistory(fallbackScenario),
    priorDecisions: [],
  };

  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn("[api/checkin] Supabase client unavailable — using fixture vitals/ECG/history.");
    return fallback;
  }

  try {
    const patient = await fetchDemoPatient(supabase);
    if (!patient) {
      console.warn("[api/checkin] demo patient not found — using fixture vitals/ECG/history.");
      return fallback;
    }

    const [vitals, ecg, history, recentCheckins] = await Promise.all([
      fetchLatestVitals(supabase, patient.id),
      fetchLatestEcg(supabase, patient.id),
      fetchVitalsHistory(supabase, patient.id),
      fetchRecentCheckins(supabase, patient.id),
    ]);

    // Rows whose stored decision is unreadable are dropped rather than guessed
    // at: a wrong prior would mislabel today's finding as new.
    const priorDecisions: PriorDecision[] = recentCheckins.flatMap((row) => {
      const d = row.decision as { level?: string; firedRules?: unknown } | null;
      if (!d?.level) return [];
      return [{
        dayPostOp: row.day_post_op ?? 0,
        level: d.level as PriorDecision["level"],
        firedRules: Array.isArray(d.firedRules) ? (d.firedRules as string[]) : [],
      }];
    });

    return {
      patientId: patient.id,
      patientName: firstName(patient.name),
      procedure: patient.procedure,
      caregiverPhone: patient.caregiverPhone,
      vitals: vitals ?? fallback.vitals,
      ecg: ecg ?? fallback.ecg,
      history: history.length > 0 ? history : fallback.history,
      priorDecisions,
    };
  } catch (err) {
    console.warn("[api/checkin] Supabase read failed — using fixture vitals/ECG/history.", err);
    return fallback;
  }
}

/**
 * Writes the caregiver-SMS audit fact immediately after a successful send,
 * in its own try/catch, before vitals/checkin persistence. The dangerous
 * failure direction is "SMS went out, escalations.notified_caregiver_at is
 * null" — that invites a duplicate text or a clinician concluding the
 * family was never contacted.
 */
/** Returns the early SMS audit row id when the durable insert succeeds. */
async function recordCaregiverNotified(args: {
  patientId: string | undefined;
  level: Exclude<ReturnType<typeof composeDecision>["level"], "green">;
  condition: string | null;
  notifiedAt: string;
}): Promise<string | undefined> {
  const supabase = getSupabaseClient();
  if (!supabase || !args.patientId) {
    console.warn(
      "[api/checkin] cannot durable-record caregiver notification — Supabase unavailable or demo patient not found.",
    );
    return undefined;
  }

  try {
    const id = await insertEscalation(supabase, {
      patient_id: args.patientId,
      checkin_id: null,
      level: args.level,
      condition: args.condition,
      notified_caregiver_at: args.notifiedAt,
    });
    if (!id) {
      console.warn(
        "[api/checkin] failed to durable-record caregiver notification:",
        "insert returned no id",
      );
    }
    return id;
  } catch (err) {
    console.warn("[api/checkin] failed to durable-record caregiver notification:", err);
    return undefined;
  }
}

async function persist(args: {
  patientId: string | undefined;
  dayPostOp: number;
  transcript: string;
  symptoms: Symptoms;
  vitals: VitalsReading;
  ecg: EcgReading | undefined;
  decision: ReturnType<typeof composeDecision>;
  trendFindings: ReturnType<typeof evaluateTrends>;
  sbar: string | null;
  /** Set only when `notifyCaregiver` actually sent an SMS for this
   * check-in, so `escalations.notified_caregiver_at` can distinguish a
   * first send from a later resend. */
  notifiedCaregiverAt: string | null;
  /** Id of the early SMS audit row when the durable insert succeeded;
   * undefined means persist should fall back to a full escalation insert. */
  earlyEscalationId: string | undefined;
  conversationId: string | undefined;
}): Promise<string | undefined> {
  const supabase = getSupabaseClient();
  if (!supabase || !args.patientId) {
    console.warn("[api/checkin] Supabase unavailable or demo patient not found — skipping persistence.");
    return undefined;
  }

  let checkinId: string | undefined;
  try {
    const painScore =
      typeof args.symptoms.painScore === "number"
        ? args.symptoms.painScore
        : typeof args.vitals.painScore === "number"
          ? args.vitals.painScore
          : null;

    // Write the reading (with pain) into the vitals time series so the next
    // check-in's trend slope sees a distinct timepoint, not only today's
    // symptoms jsonb on the checkins row. Stamp recorded_at at write time —
    // reusing args.vitals.timestamp collides when two check-ins share the
    // same latest physiologic sample.
    await insertVitals(supabase, {
      patient_id: args.patientId,
      ...buildCheckinVitalsInsert(args.vitals, painScore, new Date().toISOString()),
    });

    const pendingBiomarkers: VoiceBiomarkersRecord | undefined = args.conversationId
      ? { status: "pending", conversationId: args.conversationId }
      : undefined;

    checkinId = await insertCheckin(supabase, {
      patient_id: args.patientId,
      day_post_op: args.dayPostOp,
      transcript: args.transcript,
      symptoms: args.symptoms,
      vitals: { ...args.vitals, ...(painScore !== null ? { painScore } : {}) },
      decision: args.decision,
      trend_findings: args.trendFindings,
      sbar: args.sbar,
      ...(pendingBiomarkers ? { voice_biomarkers: pendingBiomarkers } : {}),
    });

    if (checkinId && args.conversationId) {
      triggerVoiceBiomarkerAnalyze({
        checkinId,
        conversationId: args.conversationId,
        dayPostOp: args.dayPostOp,
        symptoms: args.symptoms,
        vitals: args.vitals,
        ecg: args.ecg,
        priorDecision: args.decision,
      });
    }
  } catch (err) {
    console.warn("[api/checkin] failed to persist vitals/checkin:", err);
  }

  // Escalation audit is independent of the vitals/checkin write above.
  const plan = planEscalationAfterCheckin({
    level: args.decision.level,
    earlyEscalationId: args.earlyEscalationId,
    checkinId,
  });

  if (plan.kind === "link") {
    try {
      const linked = await linkEscalationCheckin(supabase, plan.escalationId, plan.checkinId);
      if (!linked) {
        // Never suppress a successful SMS because link-back failed.
        console.warn(
          "[api/checkin] failed to link escalation to checkin:",
          { escalationId: plan.escalationId, checkinId: plan.checkinId },
        );
      }
    } catch (err) {
      // Never suppress a successful SMS because link-back failed.
      console.warn("[api/checkin] failed to link escalation to checkin:", err);
    }
  } else if (plan.kind === "insert_fallback") {
    try {
      await insertEscalation(supabase, {
        patient_id: args.patientId,
        checkin_id: checkinId ?? null,
        level: args.decision.level,
        condition: args.decision.condition ?? null,
        notified_caregiver_at: args.notifiedCaregiverAt,
      });
    } catch (err) {
      console.warn("[api/checkin] failed to persist escalation:", err);
    }
  }

  return checkinId;
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const body = parseBody(raw);
  if (!body) {
    return NextResponse.json(
      {
        error:
          "Expected { transcript: string, dayPostOp?: number, conversationId?: string }.",
      },
      { status: 400 },
    );
  }

  const dayPostOp = body.dayPostOp ?? DEFAULT_DAY_POST_OP;
  const phase = getPhase(dayPostOp);

  const warnings: string[] = [];
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    warnings.push(
      "ANTHROPIC_API_KEY is not set — symptoms were not extracted from the transcript, and SBAR will use the deterministic fallback.",
    );
  }

  const extraction = await extractSymptoms(body.transcript);
  const symptoms = extraction.symptoms;
  const { patientId, patientName, procedure, caregiverPhone, vitals, ecg, history, priorDecisions } =
    await loadClinicalContext();

  const decision = evaluate({
    dayPostOp,
    symptoms,
    vitals,
    ecg,
    symptomsUnusable: !extraction.ok,
  });
  const trendFindings = evaluateTrends(history, buildSymptomsHistory(history, symptoms), phase);
  const composed = composeDecision(decision, trendFindings);

  let sbar: string | null = null;
  if (composed.level !== "green") {
    sbar = await generateSbar({
      patient: patientName,
      dayPostOp,
      procedure,
      decision: composed,
      symptoms,
      vitals,
      ecg,
      trendFindings,
    });
  }

  // Caregiver notification is independent of persistence: it must still
  // fire on amber/red even when Supabase is unavailable, as long as a
  // destination number is configured (patient.caregiverPhone or the
  // DEMO_CAREGIVER_PHONE fallback inside notifyCaregiver itself).
  let notifiedCaregiverAt: string | null = null;
  let earlyEscalationId: string | undefined;
  if (composed.level !== "green" && sbar !== null) {
    const notifyResult = await notifyCaregiver({ name: patientName, caregiverPhone }, composed, sbar);
    if (notifyResult.status === "sent") {
      notifiedCaregiverAt = new Date().toISOString();
      // Durable BEFORE vitals/checkin writes — never suppress the SMS if
      // this audit insert fails; just try again inside persist.
      earlyEscalationId = await recordCaregiverNotified({
        patientId,
        level: composed.level,
        condition: composed.condition ?? null,
        notifiedAt: notifiedCaregiverAt,
      });
    } else if (notifyResult.status === "error") {
      console.warn("[api/checkin] notifyCaregiver failed:", notifyResult.reason);
    }
  }

  const checkinId = await persist({
    patientId,
    dayPostOp,
    transcript: body.transcript,
    symptoms,
    vitals,
    ecg,
    decision: composed,
    trendFindings,
    sbar,
    notifiedCaregiverAt,
    earlyEscalationId,
    conversationId: body.conversationId,
  });

  // Is this finding new, or has it been true for days? Never changes the
  // verdict — a patient unchanged at red is still red — but a clinician
  // triaging a worklist needs to know which reds appeared this morning.
  const novelty = assessNovelty(composed, priorDecisions);

  return NextResponse.json({
    decision: composed,
    novelty,
    trendFindings,
    phase,
    sbar,
    symptoms,
    vitals,
    ecg,
    scenario: getActiveScenario(),
    ...(checkinId ? { checkinId } : {}),
    ...(body.conversationId ? { conversationId: body.conversationId } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
  });
}
