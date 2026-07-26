import { analyzeLiveVoiceSnapshot } from "@/lib/amplifier/analyze-live-snapshot";
import { analyzeCheckinVoiceBiomarkers } from "@/lib/amplifier/analyze-checkin";
import { maybeEscalateAfterBiomarkers } from "@/lib/amplifier/caregiver-escalate";
import type { Decision, Severity, Symptoms, VitalsReading } from "@/lib/clinical/types";
import {
  findCheckinByVoiceConversationId,
  updateCheckinAfterBiomarkers,
} from "@/lib/db/queries";
import { getSupabaseClient } from "@/lib/db/supabase";
import type { VoiceBiomarkersRecord } from "@/lib/amplifier/types";
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
  /** From check-in `voice_biomarkers` — used to skip redundant finalize analyze. */
  voiceBiomarkersStatus?: VoiceBiomarkersRecord["status"];
  voiceBiomarkersPhase?: VoiceBiomarkersRecord["phase"];
};

export type TriggerCheckinAnalyzeArgs = LiveFinalizeCheckinMatch & {
  conversationId: string;
};

const LEVEL_RANK: Record<Severity, number> = { green: 0, amber: 1, red: 2 };

/** Conversations waiting on fire-and-forget check-in analyze to mark completed. */
const postCallAnalyzeInFlight = new Set<string>();

export function clearFinalizeHandoffsForTests(): void {
  postCallAnalyzeInFlight.clear();
}

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

function parseVoiceBiomarkersMeta(value: unknown): {
  voiceBiomarkersStatus?: VoiceBiomarkersRecord["status"];
  voiceBiomarkersPhase?: VoiceBiomarkersRecord["phase"];
} {
  if (!isRecord(value)) return {};
  const status = value.status;
  const phase = value.phase;
  return {
    ...(status === "pending" ||
    status === "ready" ||
    status === "unavailable" ||
    status === "error"
      ? { voiceBiomarkersStatus: status }
      : {}),
    ...(phase === "during" || phase === "final"
      ? { voiceBiomarkersPhase: phase }
      : {}),
  };
}

/**
 * Skip re-analyze when check-in already has authoritative final biomarkers
 * (or analyze already in flight from `/api/checkin`).
 */
export function shouldSkipCheckinAnalyze(match: LiveFinalizeCheckinMatch): boolean {
  if (match.voiceBiomarkersStatus === "pending") return true;
  return (
    match.voiceBiomarkersStatus === "ready" &&
    match.voiceBiomarkersPhase === "final"
  );
}

/** Map a check-in row into analyze inputs; null when clinical fields are unusable. */
export function checkinRowToAnalyzeMatch(row: {
  id: string;
  day_post_op: number;
  symptoms: unknown;
  vitals: unknown;
  decision: unknown;
  voice_biomarkers?: unknown;
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
    ...parseVoiceBiomarkersMeta(row.voice_biomarkers),
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

async function applyDuringSnapshot(args: {
  conversationId: string;
  fetchImpl?: typeof fetch;
  analyzeSnapshot: typeof analyzeLiveVoiceSnapshot;
}): Promise<void> {
  const priorBiomarkers = getLiveSession(args.conversationId)?.biomarkers;
  const snapshot = await args.analyzeSnapshot({
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
}

/**
 * Fire-and-forget post-call analyze + persist. Mirrors `/api/checkin` and
 * `/api/biomarkers/analyze` without blocking the live tick / triage path.
 * Never demotes a decision already persisted by a concurrent check-in analyze.
 * Patches the live session with phase-final biomarkers and marks completed when done.
 */
export function defaultTriggerCheckinAnalyze(args: TriggerCheckinAnalyzeArgs): void {
  void runDefaultCheckinAnalyze(args);
}

/** Exported for unit tests — same demotion-safe persist path as the fire-and-forget trigger. */
export async function runDefaultCheckinAnalyze(
  args: TriggerCheckinAnalyzeArgs,
): Promise<void> {
  try {
    const result = await analyzeCheckinVoiceBiomarkers({
      conversationId: args.conversationId,
      dayPostOp: args.dayPostOp,
      symptoms: args.symptoms,
      vitals: args.vitals,
      priorDecision: args.priorDecision,
    });

    const supabase = getSupabaseClient();
    if (!supabase) {
      updateLiveSession(args.conversationId, {
        biomarkers: result.record,
      });
      return;
    }

    // Re-read before persist: concurrent `/api/checkin` may have raised severity
    // after our stale priorDecision snapshot.
    const latestRow = await findCheckinByVoiceConversationId(
      supabase,
      args.conversationId,
    );
    const currentDecision =
      latestRow ? parseDecision(latestRow.decision) : null;
    const latestMeta = parseVoiceBiomarkersMeta(latestRow?.voice_biomarkers);
    if (
      latestMeta.voiceBiomarkersStatus === "pending" ||
      (latestMeta.voiceBiomarkersStatus === "ready" &&
        latestMeta.voiceBiomarkersPhase === "final")
    ) {
      // Authoritative ready+final (or pending in-flight) landed while we ran —
      // do not overwrite biomarkers or decision. Prefer session bind to DB final
      // when present on the re-read row.
      const existing = latestRow?.voice_biomarkers;
      if (isRecord(existing) && existing.phase === "final") {
        updateLiveSession(args.conversationId, {
          biomarkers: existing as unknown as VoiceBiomarkersRecord,
        });
      }
      return;
    }

    const canRaiseDecision =
      result.decisionChanged &&
      result.record.status === "ready" &&
      (!currentDecision ||
        LEVEL_RANK[result.decision.level] >= LEVEL_RANK[currentDecision.level]);

    let sbar: string | null = null;
    if (canRaiseDecision) {
      try {
        sbar = await maybeEscalateAfterBiomarkers({
          checkinId: args.checkinId,
          dayPostOp: args.dayPostOp,
          symptoms: args.symptoms,
          vitals: args.vitals,
          ecg: undefined,
          decision: result.decision,
          priorDecision: currentDecision ?? args.priorDecision,
          decisionChanged: true,
        });
      } catch (escalateErr) {
        console.warn(
          "[telephony/live-finalize] biomarker caregiver escalate failed open:",
          escalateErr,
        );
      }
    }

    const ok = await updateCheckinAfterBiomarkers(supabase, args.checkinId, {
      voice_biomarkers: result.record,
      ...(canRaiseDecision ? { decision: result.decision } : {}),
      ...(sbar !== null ? { sbar } : {}),
    });
    if (!ok) {
      console.warn(
        "[telephony/live-finalize] updateCheckinAfterBiomarkers returned false.",
      );
    }

    updateLiveSession(args.conversationId, {
      biomarkers: result.record,
    });
  } catch (err) {
    console.warn("[telephony/live-finalize] post-call analyze failed open:", err);
  } finally {
    postCallAnalyzeInFlight.delete(args.conversationId);
    updateLiveSession(args.conversationId, { status: "completed" });
  }
}

/**
 * Post-call handoff: optional fail-open during snapshot only when there is no
 * matching check-in analyze → optional check-in analyze when
 * `voice_biomarkers.conversationId` matches and check-in does not already have
 * ready+final (or pending in-flight) biomarkers → mark `completed`.
 * When check-in analyze will run, skip the interim during snapshot (final is
 * about to land). Never invents symptoms; `/api/checkin` remains the persistence
 * entry point when no matching check-in exists. Never demotes a persisted
 * decision via stale priorDecision from lookup time.
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

  if (postCallAnalyzeInFlight.has(args.conversationId)) {
    return session;
  }

  const analyze = args.analyzeSnapshot ?? analyzeLiveVoiceSnapshot;
  const findCheckin =
    args.findCheckinByConversationId ?? defaultFindCheckinByConversationId;
  const triggerAnalyze =
    args.triggerCheckinAnalyze ?? defaultTriggerCheckinAnalyze;

  let match: LiveFinalizeCheckinMatch | null = null;
  try {
    match = await findCheckin(args.conversationId);
  } catch (err) {
    console.warn(
      "[telephony/live-finalize] check-in lookup / analyze trigger failed open:",
      err,
    );
  }

  const willAnalyze = Boolean(match && !shouldSkipCheckinAnalyze(match));

  if (willAnalyze && match) {
    // Skip interim during snapshot — authoritative check-in analyze owns final.
    postCallAnalyzeInFlight.add(args.conversationId);
    try {
      triggerAnalyze({
        ...match,
        conversationId: args.conversationId,
      });
    } catch (err) {
      postCallAnalyzeInFlight.delete(args.conversationId);
      console.warn(
        "[telephony/live-finalize] check-in analyze trigger failed open:",
        err,
      );
      updateLiveSession(args.conversationId, { status: "completed" });
    }
    // Stay finalizing until runDefaultCheckinAnalyze marks completed.
    return getLiveSession(args.conversationId);
  }

  // No matching check-in: fail-open with during snapshot for stage/chart bind.
  // Matching check-in already pending/final: skip redundant during stamp.
  if (!match) {
    try {
      await applyDuringSnapshot({
        conversationId: args.conversationId,
        fetchImpl: args.fetchImpl,
        analyzeSnapshot: analyze,
      });
    } catch (err) {
      console.warn(
        "[telephony/live-finalize] during snapshot failed open:",
        err,
      );
    }
  }

  updateLiveSession(args.conversationId, { status: "completed" });
  return getLiveSession(args.conversationId);
}
