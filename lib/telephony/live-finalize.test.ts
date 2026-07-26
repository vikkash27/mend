import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearLiveSessionsForTests,
  getLiveSession,
  updateLiveSession,
  upsertLiveSession,
} from "./live-session";
import { finalizeLiveSession } from "./live-finalize";

const CONVERSATION_ID = "conv_finalize";

const readyDuring = {
  status: "ready" as const,
  phase: "during" as const,
  conversationId: CONVERSATION_ID,
  mapped: {
    quality: "ok" as const,
    respiratory: { level: "moderate" as const, score: 0.4 },
    cognitive: { level: "low" as const, score: 0.2 },
    source: "amplifier" as const,
  },
};

const readyFinalSnapshot = {
  ...readyDuring,
  analyzedAt: "2026-07-26T12:00:00.000Z",
  jobIds: ["job-r", "job-c"],
};

const priorDecision = {
  level: "green" as const,
  action: "Continue recovery plan",
  rationale: ["No red flags"],
  firedRules: [] as string[],
};

const checkinMatch = {
  checkinId: "checkin-42",
  dayPostOp: 4,
  symptoms: { breathless: false },
  vitals: {
    timestamp: "2026-07-26T11:00:00.000Z",
    hr: 72,
    source: "manual" as const,
    quality: "ok" as const,
  },
  priorDecision,
};

afterEach(() => {
  clearLiveSessionsForTests();
});

describe("finalizeLiveSession", () => {
  it("attempts final snapshot then marks session completed", async () => {
    upsertLiveSession({
      conversationId: CONVERSATION_ID,
      patientId: "margaret-ellison",
    });
    updateLiveSession(CONVERSATION_ID, { status: "finalizing" });

    const analyzeSnapshot = vi.fn().mockResolvedValue(readyFinalSnapshot);
    const findCheckin = vi.fn().mockResolvedValue(null);
    const triggerAnalyze = vi.fn();

    const session = await finalizeLiveSession({
      conversationId: CONVERSATION_ID,
      analyzeSnapshot,
      findCheckinByConversationId: findCheckin,
      triggerCheckinAnalyze: triggerAnalyze,
    });

    expect(analyzeSnapshot).toHaveBeenCalledWith({
      conversationId: CONVERSATION_ID,
      fetchImpl: undefined,
    });
    expect(session?.status).toBe("completed");
    expect(session?.biomarkers).toEqual(readyFinalSnapshot);
    expect(getLiveSession(CONVERSATION_ID)?.status).toBe("completed");
    expect(triggerAnalyze).not.toHaveBeenCalled();
  });

  it("keeps prior ready biomarkers when final snapshot fails", async () => {
    upsertLiveSession({
      conversationId: CONVERSATION_ID,
      patientId: "margaret-ellison",
    });
    updateLiveSession(CONVERSATION_ID, {
      status: "finalizing",
      biomarkers: readyDuring,
    });

    const analyzeSnapshot = vi.fn().mockResolvedValue({
      status: "unavailable",
      conversationId: CONVERSATION_ID,
      error: "no audio yet",
      phase: "during",
    });

    await finalizeLiveSession({
      conversationId: CONVERSATION_ID,
      analyzeSnapshot,
      findCheckinByConversationId: vi.fn().mockResolvedValue(null),
      triggerCheckinAnalyze: vi.fn(),
    });

    expect(getLiveSession(CONVERSATION_ID)?.biomarkers).toEqual(readyDuring);
    expect(getLiveSession(CONVERSATION_ID)?.status).toBe("completed");
  });

  it("fire-and-forgets check-in analyze when matching conversationId exists", async () => {
    upsertLiveSession({
      conversationId: CONVERSATION_ID,
      patientId: "margaret-ellison",
    });
    updateLiveSession(CONVERSATION_ID, { status: "finalizing" });

    const analyzeSnapshot = vi.fn().mockResolvedValue(readyFinalSnapshot);
    const findCheckin = vi.fn().mockResolvedValue(checkinMatch);
    const triggerAnalyze = vi.fn();

    await finalizeLiveSession({
      conversationId: CONVERSATION_ID,
      analyzeSnapshot,
      findCheckinByConversationId: findCheckin,
      triggerCheckinAnalyze: triggerAnalyze,
    });

    expect(findCheckin).toHaveBeenCalledWith(CONVERSATION_ID);
    expect(triggerAnalyze).toHaveBeenCalledWith({
      ...checkinMatch,
      conversationId: CONVERSATION_ID,
    });
    expect(getLiveSession(CONVERSATION_ID)?.status).toBe("completed");
  });

  it("skips analyze when check-in already has ready+final biomarkers", async () => {
    upsertLiveSession({
      conversationId: CONVERSATION_ID,
      patientId: "margaret-ellison",
    });
    updateLiveSession(CONVERSATION_ID, { status: "finalizing" });

    const analyzeSnapshot = vi.fn().mockResolvedValue(readyFinalSnapshot);
    const findCheckin = vi.fn().mockResolvedValue({
      ...checkinMatch,
      priorDecision: {
        level: "amber" as const,
        action: "Call clinic today",
        rationale: ["voice.cognitive_high"],
        firedRules: ["voice.cognitive_high"],
      },
      voiceBiomarkersStatus: "ready" as const,
      voiceBiomarkersPhase: "final" as const,
    });
    const triggerAnalyze = vi.fn();

    await finalizeLiveSession({
      conversationId: CONVERSATION_ID,
      analyzeSnapshot,
      findCheckinByConversationId: findCheckin,
      triggerCheckinAnalyze: triggerAnalyze,
    });

    expect(findCheckin).toHaveBeenCalledWith(CONVERSATION_ID);
    expect(triggerAnalyze).not.toHaveBeenCalled();
    expect(getLiveSession(CONVERSATION_ID)?.status).toBe("completed");
  });

  it("skips analyze when check-in biomarkers are still pending", async () => {
    upsertLiveSession({
      conversationId: CONVERSATION_ID,
      patientId: "margaret-ellison",
    });
    updateLiveSession(CONVERSATION_ID, { status: "finalizing" });

    const triggerAnalyze = vi.fn();
    await finalizeLiveSession({
      conversationId: CONVERSATION_ID,
      analyzeSnapshot: vi.fn().mockResolvedValue(readyFinalSnapshot),
      findCheckinByConversationId: vi.fn().mockResolvedValue({
        ...checkinMatch,
        voiceBiomarkersStatus: "pending" as const,
      }),
      triggerCheckinAnalyze: triggerAnalyze,
    });

    expect(triggerAnalyze).not.toHaveBeenCalled();
  });

  it("is a no-op when session is already completed", async () => {
    upsertLiveSession({
      conversationId: CONVERSATION_ID,
      patientId: "margaret-ellison",
    });
    updateLiveSession(CONVERSATION_ID, {
      status: "completed",
      biomarkers: readyDuring,
    });

    const analyzeSnapshot = vi.fn();
    const findCheckin = vi.fn();
    const triggerAnalyze = vi.fn();

    const session = await finalizeLiveSession({
      conversationId: CONVERSATION_ID,
      analyzeSnapshot,
      findCheckinByConversationId: findCheckin,
      triggerCheckinAnalyze: triggerAnalyze,
    });

    expect(analyzeSnapshot).not.toHaveBeenCalled();
    expect(findCheckin).not.toHaveBeenCalled();
    expect(triggerAnalyze).not.toHaveBeenCalled();
    expect(session?.status).toBe("completed");
  });
});
