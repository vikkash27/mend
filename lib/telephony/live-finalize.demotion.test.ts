import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const analyzeCheckinVoiceBiomarkers = vi.fn();
const findCheckinByVoiceConversationId = vi.fn();
const updateCheckinAfterBiomarkers = vi.fn();
const getSupabaseClient = vi.fn();
const maybeEscalateAfterBiomarkers = vi.fn();

vi.mock("@/lib/amplifier/analyze-checkin", () => ({
  analyzeCheckinVoiceBiomarkers: (...args: unknown[]) =>
    analyzeCheckinVoiceBiomarkers(...args),
}));

vi.mock("@/lib/amplifier/caregiver-escalate", () => ({
  maybeEscalateAfterBiomarkers: (...args: unknown[]) =>
    maybeEscalateAfterBiomarkers(...args),
}));

vi.mock("@/lib/db/queries", () => ({
  findCheckinByVoiceConversationId: (...args: unknown[]) =>
    findCheckinByVoiceConversationId(...args),
  updateCheckinAfterBiomarkers: (...args: unknown[]) =>
    updateCheckinAfterBiomarkers(...args),
}));

vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient: () => getSupabaseClient(),
}));

import {
  clearLiveSessionsForTests,
  getLiveSession,
  updateLiveSession,
  upsertLiveSession,
} from "./live-session";
import {
  clearFinalizeHandoffsForTests,
  runDefaultCheckinAnalyze,
} from "./live-finalize";

const CONVERSATION_ID = "conv_demotion";
const CHECKIN_ID = "checkin-demote";
const SUPABASE = { from: vi.fn() };

const greenDecision = {
  level: "green" as const,
  action: "Continue recovery plan",
  rationale: ["No red flags"],
  firedRules: [] as string[],
};

const amberDecision = {
  level: "amber" as const,
  action: "Call clinic today",
  rationale: ["voice.cognitive_high"],
  firedRules: ["voice.cognitive_high"],
};

const redDecision = {
  level: "red" as const,
  action: "Seek urgent care",
  rationale: ["voice + symptoms"],
  firedRules: ["pe.breathless"],
};

const vitals = {
  timestamp: "2026-07-26T11:00:00.000Z",
  hr: 72,
  source: "manual" as const,
  quality: "ok" as const,
};

const finalRecord = {
  status: "ready" as const,
  phase: "final" as const,
  conversationId: CONVERSATION_ID,
  analyzedAt: "2026-07-26T12:00:00.000Z",
  jobIds: ["job-r", "job-c"],
  mapped: {
    quality: "ok" as const,
    respiratory: { level: "moderate" as const, score: 0.4 },
    cognitive: { level: "high" as const, score: 0.85 },
    source: "amplifier" as const,
  },
};

const triggerArgs = {
  conversationId: CONVERSATION_ID,
  checkinId: CHECKIN_ID,
  dayPostOp: 4,
  symptoms: { breathless: false },
  vitals,
  priorDecision: greenDecision,
};

beforeEach(() => {
  analyzeCheckinVoiceBiomarkers.mockReset();
  findCheckinByVoiceConversationId.mockReset();
  updateCheckinAfterBiomarkers.mockReset().mockResolvedValue(true);
  getSupabaseClient.mockReset().mockReturnValue(SUPABASE);
  maybeEscalateAfterBiomarkers.mockReset().mockResolvedValue(null);
  upsertLiveSession({
    conversationId: CONVERSATION_ID,
    patientId: "margaret-ellison",
  });
  updateLiveSession(CONVERSATION_ID, { status: "finalizing" });
});

afterEach(() => {
  clearLiveSessionsForTests();
  clearFinalizeHandoffsForTests();
});

describe("runDefaultCheckinAnalyze demotion-safe persist", () => {
  it("aborts persist when re-read shows ready+final already landed", async () => {
    analyzeCheckinVoiceBiomarkers.mockResolvedValue({
      record: finalRecord,
      decision: amberDecision,
      decisionChanged: true,
    });
    findCheckinByVoiceConversationId.mockResolvedValue({
      id: CHECKIN_ID,
      decision: amberDecision,
      voice_biomarkers: {
        ...finalRecord,
        analyzedAt: "2026-07-26T11:59:00.000Z",
      },
    });

    await runDefaultCheckinAnalyze(triggerArgs);

    expect(updateCheckinAfterBiomarkers).not.toHaveBeenCalled();
    expect(maybeEscalateAfterBiomarkers).not.toHaveBeenCalled();
    expect(getLiveSession(CONVERSATION_ID)?.status).toBe("completed");
  });

  it("aborts persist when re-read shows pending biomarkers in flight", async () => {
    analyzeCheckinVoiceBiomarkers.mockResolvedValue({
      record: finalRecord,
      decision: amberDecision,
      decisionChanged: true,
    });
    findCheckinByVoiceConversationId.mockResolvedValue({
      id: CHECKIN_ID,
      decision: greenDecision,
      voice_biomarkers: {
        status: "pending",
        phase: "final",
        conversationId: CONVERSATION_ID,
      },
    });

    await runDefaultCheckinAnalyze(triggerArgs);

    expect(updateCheckinAfterBiomarkers).not.toHaveBeenCalled();
    expect(getLiveSession(CONVERSATION_ID)?.status).toBe("completed");
  });

  it("writes biomarkers only when voice would demote a raised concurrent decision", async () => {
    // Stale snapshot was green; concurrent check-in raised to red before persist.
    // Voice result "changed" to amber relative to stale green — must not demote red.
    analyzeCheckinVoiceBiomarkers.mockResolvedValue({
      record: finalRecord,
      decision: amberDecision,
      decisionChanged: true,
    });
    findCheckinByVoiceConversationId.mockResolvedValue({
      id: CHECKIN_ID,
      decision: redDecision,
      voice_biomarkers: {
        status: "during",
        phase: "during",
        conversationId: CONVERSATION_ID,
      },
    });

    await runDefaultCheckinAnalyze({
      ...triggerArgs,
      priorDecision: greenDecision,
    });

    expect(maybeEscalateAfterBiomarkers).not.toHaveBeenCalled();
    expect(updateCheckinAfterBiomarkers).toHaveBeenCalledWith(
      SUPABASE,
      CHECKIN_ID,
      {
        voice_biomarkers: finalRecord,
      },
    );
    expect(getLiveSession(CONVERSATION_ID)?.biomarkers).toEqual(finalRecord);
    expect(getLiveSession(CONVERSATION_ID)?.status).toBe("completed");
  });

  it("can raise decision when re-read allows and patches session with final biomarkers", async () => {
    analyzeCheckinVoiceBiomarkers.mockResolvedValue({
      record: finalRecord,
      decision: amberDecision,
      decisionChanged: true,
    });
    findCheckinByVoiceConversationId.mockResolvedValue({
      id: CHECKIN_ID,
      decision: greenDecision,
      voice_biomarkers: null,
    });
    maybeEscalateAfterBiomarkers.mockResolvedValue("S: raised\nB: day 4");

    await runDefaultCheckinAnalyze(triggerArgs);

    expect(maybeEscalateAfterBiomarkers).toHaveBeenCalled();
    expect(updateCheckinAfterBiomarkers).toHaveBeenCalledWith(
      SUPABASE,
      CHECKIN_ID,
      {
        voice_biomarkers: finalRecord,
        decision: amberDecision,
        sbar: "S: raised\nB: day 4",
      },
    );
    expect(getLiveSession(CONVERSATION_ID)?.biomarkers?.phase).toBe("final");
    expect(getLiveSession(CONVERSATION_ID)?.status).toBe("completed");
  });

  it("writes biomarkers only when decisionChanged is false", async () => {
    analyzeCheckinVoiceBiomarkers.mockResolvedValue({
      record: finalRecord,
      decision: greenDecision,
      decisionChanged: false,
    });
    findCheckinByVoiceConversationId.mockResolvedValue({
      id: CHECKIN_ID,
      decision: greenDecision,
      voice_biomarkers: null,
    });

    await runDefaultCheckinAnalyze(triggerArgs);

    expect(maybeEscalateAfterBiomarkers).not.toHaveBeenCalled();
    expect(updateCheckinAfterBiomarkers).toHaveBeenCalledWith(
      SUPABASE,
      CHECKIN_ID,
      {
        voice_biomarkers: finalRecord,
      },
    );
  });
});
