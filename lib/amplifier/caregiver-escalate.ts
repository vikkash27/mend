import { DEFAULT_PATIENT_FIRST_NAME, firstName } from "@/lib/clinical/scripts";
import type { Decision, EcgReading, Symptoms, VitalsReading } from "@/lib/clinical/types";
import { planEscalationAfterCheckin } from "@/lib/db/escalation-audit";
import {
  fetchDemoPatient,
  insertEscalation,
  linkEscalationCheckin,
} from "@/lib/db/queries";
import { getSupabaseClient } from "@/lib/db/supabase";
import { generateSbar } from "@/lib/llm/sbar";
import { notifyCaregiver } from "@/lib/telephony/sms";

const DEMO_PATIENT_PROCEDURE_FALLBACK = "hip hemiarthroplasty";

const LEVEL_RANK = { green: 0, amber: 1, red: 2 } as const;

const LOG_PREFIX = "[amplifier/caregiver-escalate]";

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
      `${LOG_PREFIX} cannot durable-record caregiver notification — Supabase unavailable or demo patient not found.`,
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
        `${LOG_PREFIX} failed to durable-record caregiver notification:`,
        "insert returned no id",
      );
    }
    return id;
  } catch (err) {
    console.warn(
      `${LOG_PREFIX} failed to durable-record caregiver notification:`,
      err,
    );
    return undefined;
  }
}

/** Fail-open caregiver escalate when voice biomarkers raise decision level.
 * Returns SBAR text when generated (for optional check-in patch); never throws. */
export async function maybeEscalateAfterBiomarkers(args: {
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
        `${LOG_PREFIX} fetchDemoPatient failed — using demo defaults for notify:`,
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
    console.warn(`${LOG_PREFIX} generateSbar failed — skipping caregiver notify:`, err);
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
      console.warn(`${LOG_PREFIX} notifyCaregiver failed:`, notifyResult.reason);
    }
  } catch (err) {
    console.warn(`${LOG_PREFIX} notifyCaregiver threw — continuing:`, err);
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
        console.warn(`${LOG_PREFIX} failed to link escalation to checkin:`, {
          escalationId: plan.escalationId,
          checkinId: plan.checkinId,
        });
      }
    } catch (err) {
      console.warn(`${LOG_PREFIX} failed to link escalation to checkin:`, err);
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
      console.warn(`${LOG_PREFIX} failed to persist escalation:`, err);
    }
  }

  return sbar;
}
