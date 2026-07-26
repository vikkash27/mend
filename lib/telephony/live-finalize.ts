import { analyzeLiveVoiceSnapshot } from "@/lib/amplifier/analyze-live-snapshot";
import { analyzeCheckinVoiceBiomarkers } from "@/lib/amplifier/analyze-checkin";
import { maybeEscalateAfterBiomarkers } from "@/lib/amplifier/caregiver-escalate";
import type { Decision, Symptoms, VitalsReading } from "@/lib/clinical/types";
import {
  findCheckinByVoiceConversationId,
  updateCheckinAfterBiomarkers,
} from "@/lib/db/queries";
import { getSupabaseClient } from "@/lib/db/supabase";
import {
  getLiveSession,
  type LiveCallSession,
  updateLiveSession,
} from "./live-session";

export type LiveFinalizeCheckinMatch = {
  checkinId: string;
  dayPostOp: number;
  symptoms: Symptoms;
  vitals: VitalsReading;
  priorDecision: Decision;
};

export type TriggerCheckinAnalyzeArgs = LiveFinalizeCheckinMatch & {
  conversationId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDecision(value: unknown): Decision | null {
  if (!isRecord(value)) return null;
  if (value.level !== "green" && value.level !== "amber" && value.level !== "red") {
    return null;
  }
  if (typeof value.action !== "string") return null;
  if (!Array.isArray(value.rationale) || !Array.isArray(value.firedRules)) {
    return null;
  }
  return value as unknown as Decision;
}

function parseVitals(value: unknown): VitalsReading | null {
  if (!isRecord(value)) return null;
  if (typeof value.timestamp !== "string") return null;
  if (
    value.source !== "ble_heart_rate" &&
    value.source !== "manual" &&
    value.source !== "kardia_6l" &&
    value.source !== "simulated"
  ) {
    return null;
  }
  if (value.quality !== "ok" && value.quality !== "poor" && value.quality !== "stale") {
    return null;
  }
  return value as unknown as VitalsReading;
}

function parseSymptoms(value: unknown): Symptoms {
  if (!isRecord(value)) return {};
  return value as Symptoms;
}

/** Map a check-in row into analyze inputs; null when clinical fields are unusable. */
export function checkinRowToAnalyzeMatch(row: {
  id: string;
  day_post_op: number;
  symptoms: unknown;
  vitals: unknown;
  decision: unknown;
}): LiveFinalizeCheckinMatch | null {
  const priorDecision = parseDecision(row.decision);
  const vitals = parseVitals(row.vitals);
  if (!priorDecision || !vitals) return null;
  return {
    checkinId: row.id,
    dayPostOp: row.day_post_op,
    symptoms: parseSymptoms(row.symptoms),
    vitals,
    priorDecision,
  };
}

async function defaultFindCheckinByConversationId(
  conversationId: string,
): Promise<LiveFinalizeCheckinMatch | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const row = await findCheckinByVoiceConversationId(supabase, conversationId);
  if (!row) return null;
  return checkinRowToAnalyzeMatch(row);
}

/**
 * Fire-and-forget post-call analyze + persist. Mirrors `/api/checkin` and
 * `/api/biomarkers/analyze` without blocking the live tick / triage path.
 */
export function defaultTriggerCheckinAnalyze(args: TriggerCheckinAnalyzeArgs): void {
  void (async () => {
    try {
      const result = await analyzeCheckinVoiceBiomarkers({
        conversationId: args.conversationId,
        dayPostOp: args.dayPostOp,
        symptoms: args.symptoms,
        vitals: args.vitals,
        priorDecision: args.priorDecision,
      });

      let sbar: string | null = null;
      try {
        sbar = await maybeEscalateAfterBiomarkers({
          checkinId: args.checkinId,
          dayPostOp: args.dayPostOp,
          symptoms: args.symptoms,
          vitals: args.vitals,
          ecg: undefined,
          decision: result.decision,
          priorDecision: args.priorDecision,
          decisionChanged: result.decisionChanged,
        });
      } catch (escalateErr) {
        console.warn(
          "[telephony/live-finalize] biomarker caregiver escalate failed open:",
          escalateErr,
        );
      }

      const supabase = getSupabaseClient();
      if (!supabase) return;

      const ok = await updateCheckinAfterBiomarkers(supabase, args.checkinId, {
        voice_biomarkers: result.record,
        decision: result.decision,
        ...(sbar !== null ? { sbar } : {}),
      });
      if (!ok) {
        console.warn(
          "[telephony/live-finalize] updateCheckinAfterBiomarkers returned false.",
        );
      }
    } catch (err) {
      console.warn("[telephony/live-finalize] post-call analyze failed open:", err);
    }
  })();
}

/**
 * Post-call handoff: final Amplifier snapshot (interim on session) → optional
 * check-in analyze when `voice_biomarkers.conversationId` matches → mark
 * `completed`. Never invents symptoms; `/api/checkin` remains the persistence
 * entry point when no matching check-in exists.
 */
export async function finalizeLiveSession(args: {
  conversationId: string;
  fetchImpl?: typeof fetch;
  analyzeSnapshot?: typeof analyzeLiveVoiceSnapshot;
  findCheckinByConversationId?: (
    conversationId: string,
  ) => Promise<LiveFinalizeCheckinMatch | null>;
  triggerCheckinAnalyze?: (args: TriggerCheckinAnalyzeArgs) => void;
}): Promise<LiveCallSession | null> {
  const session = getLiveSession(args.conversationId);
  if (!session) return null;

  if (session.status === "completed" || session.status === "error") {
    return session;
  }

  const priorBiomarkers = session.biomarkers;
  const analyze = args.analyzeSnapshot ?? analyzeLiveVoiceSnapshot;
  const snapshot = await analyze({
    conversationId: args.conversationId,
    fetchImpl: args.fetchImpl,
  });

  if (
    (snapshot.status === "unavailable" || snapshot.status === "error") &&
    priorBiomarkers?.status === "ready"
  ) {
    updateLiveSession(args.conversationId, {
      error: snapshot.error,
    });
  } else {
    updateLiveSession(args.conversationId, {
      biomarkers: snapshot,
      ...(snapshot.status !== "ready" && snapshot.error
        ? { error: snapshot.error }
        : {}),
    });
  }

  const findCheckin =
    args.findCheckinByConversationId ?? defaultFindCheckinByConversationId;
  const triggerAnalyze =
    args.triggerCheckinAnalyze ?? defaultTriggerCheckinAnalyze;

  try {
    const match = await findCheckin(args.conversationId);
    if (match) {
      triggerAnalyze({
        ...match,
        conversationId: args.conversationId,
      });
    }
  } catch (err) {
    console.warn(
      "[telephony/live-finalize] check-in lookup / analyze trigger failed open:",
      err,
    );
  }

  updateLiveSession(args.conversationId, { status: "completed" });
  return getLiveSession(args.conversationId);
}
