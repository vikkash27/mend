import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeCheckinVoiceBiomarkers } from "@/lib/amplifier/analyze-checkin";
import { DEFAULT_PATIENT_FIRST_NAME, firstName } from "@/lib/clinical/scripts";
import type { Decision, EcgReading, Symptoms, VitalsReading } from "@/lib/clinical/types";
import { planEscalationAfterCheckin } from "@/lib/db/escalation-audit";
import {
  fetchDemoPatient,
  insertEscalation,
  linkEscalationCheckin,
  updateCheckinAfterBiomarkers,
} from "@/lib/db/queries";
import { getSupabaseClient } from "@/lib/db/supabase";
import { generateSbar } from "@/lib/llm/sbar";
import { notifyCaregiver } from "@/lib/telephony/sms";

/**
 * POST /api/biomarkers/analyze — post-call Amplifier voice biomarker analysis.
 *
 * Prefer clinical snapshots in the request body (symptoms, vitals, ecg?,
 * priorDecision) rather than reloading from Supabase. Demo callers already
 * have the check-in context in memory; body snapshots avoid racey DB reads
 * and keep the path reliable when persistence is skipped or lagging.
 *
 * Flow: parse body → analyzeCheckinVoiceBiomarkers → if decisionChanged and
 * the new level rises into amber/red, reuse check-in caregiver notify +
 * escalation audit (fail-open) → if Supabase is available,
 * updateCheckinAfterBiomarkers → return { record, decision, decisionChanged }.
 */

const DEMO_PATIENT_PROCEDURE_FALLBACK = "hip hemiarthroplasty";

const SeveritySchema = z.enum(["green", "amber", "red"]);

const SymptomsSchema = z
  .object({
    breathless: z.boolean().optional(),
    chestPain: z.boolean().optional(),
    calfPainOrSwelling: z.boolean().optional(),
    woundDischarge: z.boolean().optional(),
    feverSubjective: z.boolean().optional(),
    suddenSevereHipPain: z.boolean().optional(),
    legShortenedOrRotated: z.boolean().optional(),
    unableToWeightBear: z.boolean().optional(),
    painControlled: z.boolean().optional(),
    newConfusion: z.boolean().optional(),
    painScore: z.number().finite().optional(),
  })
  .strict();

const VitalsReadingSchema = z.object({
  timestamp: z.string().min(1),
  hr: z.number().finite().optional(),
  sbp: z.number().finite().optional(),
  dbp: z.number().finite().optional(),
  tempC: z.number().finite().optional(),
  spo2: z.number().finite().optional(),
  respRate: z.number().finite().optional(),
  painScore: z.number().finite().optional(),
  source: z.enum(["ble_heart_rate", "manual", "kardia_6l", "simulated"]),
  deviceLabel: z.string().optional(),
  quality: z.enum(["ok", "poor", "stale"]),
});

const EcgReadingSchema = z.object({
  recordedAt: z.string().min(1),
  determination: z.enum([
    "normal_sinus_rhythm",
    "atrial_fibrillation",
    "tachycardia",
    "bradycardia",
    "unclassified",
  ]),
  bpm: z.number().finite().optional(),
  source: z.literal("kardia_6l"),
  pdfUrl: z.string().optional(),
});

const DecisionSchema = z.object({
  level: SeveritySchema,
  condition: z.string().optional(),
  action: z.string(),
  call: z.enum(["911", "ER", "surgeon_office", "nurse_line"]).optional(),
  rationale: z.array(z.string()),
  firedRules: z.array(z.string()),
});

const RequestBodySchema = z.object({
  checkinId: z.string().min(1),
  conversationId: z.string().min(1),
  dayPostOp: z.number().finite(),
  symptoms: SymptomsSchema,
  vitals: VitalsReadingSchema,
  ecg: EcgReadingSchema.optional(),
  priorDecision: DecisionSchema,
});

const LEVEL_RANK = { green: 0, amber: 1, red: 2 } as const;

/** Notify only when biomarkers raise severity into a new amber/red level —
 * not when the prior decision was already the same amber/red (avoids
 * duplicate SMS if firedRules change but level does not). */
export function shouldNotifyCaregiverForBiomarkerDecision(args: {
  decisionChanged: boolean;
  priorLevel: Decision["level"];
  newLevel: Decision["level"];
}): boolean {
  if (!args.decisionChanged) return false;
  if (args.newLevel === "green") return false;
  return LEVEL_RANK[args.newLevel] > LEVEL_RANK[args.priorLevel];
}

async function recordCaregiverNotified(args: {
  patientId: string | undefined;
  level: Exclude<Decision["level"], "green">;
  condition: string | null;
  notifiedAt: string;
}): Promise<string | undefined> {
  const supabase = getSupabaseClient();
  if (!supabase || !args.patientId) {
    console.warn(
      "[api/biomarkers/analyze] cannot durable-record caregiver notification — Supabase unavailable or demo patient not found.",
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
        "[api/biomarkers/analyze] failed to durable-record caregiver notification:",
        "insert returned no id",
      );
    }
    return id;
  } catch (err) {
    console.warn(
      "[api/biomarkers/analyze] failed to durable-record caregiver notification:",
      err,
    );
    return undefined;
  }
}

/** Fail-open caregiver escalate when voice biomarkers raise decision level.
 * Returns SBAR text when generated (for optional check-in patch); never throws. */
async function maybeEscalateAfterBiomarkers(args: {
  checkinId: string;
  dayPostOp: number;
  symptoms: Symptoms;
  vitals: VitalsReading;
  ecg: EcgReading | undefined;
  decision: Decision;
  priorDecision: Decision;
  decisionChanged: boolean;
}): Promise<string | null> {
  if (
    !shouldNotifyCaregiverForBiomarkerDecision({
      decisionChanged: args.decisionChanged,
      priorLevel: args.priorDecision.level,
      newLevel: args.decision.level,
    })
  ) {
    return null;
  }

  let patientId: string | undefined;
  let patientName = DEFAULT_PATIENT_FIRST_NAME;
  let procedure = DEMO_PATIENT_PROCEDURE_FALLBACK;
  let caregiverPhone: string | undefined;

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const patient = await fetchDemoPatient(supabase);
      if (patient) {
        patientId = patient.id;
        patientName = firstName(patient.name);
        procedure = patient.procedure;
        caregiverPhone = patient.caregiverPhone;
      }
    } catch (err) {
      console.warn(
        "[api/biomarkers/analyze] fetchDemoPatient failed — using demo defaults for notify:",
        err,
      );
    }
  }

  let sbar: string;
  try {
    sbar = await generateSbar({
      patient: patientName,
      dayPostOp: args.dayPostOp,
      procedure,
      decision: args.decision,
      symptoms: args.symptoms,
      vitals: args.vitals,
      ecg: args.ecg,
      trendFindings: [],
    });
  } catch (err) {
    console.warn("[api/biomarkers/analyze] generateSbar failed — skipping caregiver notify:", err);
    return null;
  }

  let notifiedCaregiverAt: string | null = null;
  let earlyEscalationId: string | undefined;

  try {
    const notifyResult = await notifyCaregiver(
      { name: patientName, caregiverPhone },
      args.decision,
      sbar,
    );
    if (notifyResult.status === "sent") {
      notifiedCaregiverAt = new Date().toISOString();
      earlyEscalationId = await recordCaregiverNotified({
        patientId,
        level: args.decision.level as Exclude<Decision["level"], "green">,
        condition: args.decision.condition ?? null,
        notifiedAt: notifiedCaregiverAt,
      });
    } else if (notifyResult.status === "error") {
      console.warn("[api/biomarkers/analyze] notifyCaregiver failed:", notifyResult.reason);
    }
  } catch (err) {
    console.warn("[api/biomarkers/analyze] notifyCaregiver threw — continuing:", err);
  }

  const plan = planEscalationAfterCheckin({
    level: args.decision.level,
    earlyEscalationId,
    checkinId: args.checkinId,
  });

  if (plan.kind === "link" && supabase) {
    try {
      const linked = await linkEscalationCheckin(supabase, plan.escalationId, plan.checkinId);
      if (!linked) {
        console.warn("[api/biomarkers/analyze] failed to link escalation to checkin:", {
          escalationId: plan.escalationId,
          checkinId: plan.checkinId,
        });
      }
    } catch (err) {
      console.warn("[api/biomarkers/analyze] failed to link escalation to checkin:", err);
    }
  } else if (plan.kind === "insert_fallback" && supabase && patientId) {
    try {
      await insertEscalation(supabase, {
        patient_id: patientId,
        checkin_id: args.checkinId,
        level: args.decision.level,
        condition: args.decision.condition ?? null,
        notified_caregiver_at: notifiedCaregiverAt,
      });
    } catch (err) {
      console.warn("[api/biomarkers/analyze] failed to persist escalation:", err);
    }
  }

  return sbar;
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const parsed = RequestBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Expected { checkinId, conversationId, dayPostOp, symptoms, vitals, priorDecision, ecg? }.",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const body = parsed.data;

  const result = await analyzeCheckinVoiceBiomarkers({
    conversationId: body.conversationId,
    dayPostOp: body.dayPostOp,
    symptoms: body.symptoms,
    vitals: body.vitals,
    ecg: body.ecg,
    priorDecision: body.priorDecision,
  });

  let sbar: string | null = null;
  try {
    sbar = await maybeEscalateAfterBiomarkers({
      checkinId: body.checkinId,
      dayPostOp: body.dayPostOp,
      symptoms: body.symptoms,
      vitals: body.vitals,
      ecg: body.ecg,
      decision: result.decision,
      priorDecision: body.priorDecision,
      decisionChanged: result.decisionChanged,
    });
  } catch (err) {
    console.warn("[api/biomarkers/analyze] escalation path failed open:", err);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const ok = await updateCheckinAfterBiomarkers(supabase, body.checkinId, {
        voice_biomarkers: result.record,
        decision: result.decision,
        ...(sbar !== null ? { sbar } : {}),
      });
      if (!ok) {
        console.warn(
          "[api/biomarkers/analyze] updateCheckinAfterBiomarkers returned false — analysis still returned to caller.",
        );
      }
    } catch (err) {
      console.warn("[api/biomarkers/analyze] failed to persist biomarkers:", err);
    }
  }

  return NextResponse.json({
    record: result.record,
    decision: result.decision,
    decisionChanged: result.decisionChanged,
  });
}
