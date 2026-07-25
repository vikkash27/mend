import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Optional conversationId plumbing: pending voice_biomarkers on insert +
 * fire-and-forget analyzeCheckinVoiceBiomarkers (lib orchestration, not HTTP).
 */

const insertCheckin = vi.fn().mockResolvedValue("checkin-vb-1");
const insertVitals = vi.fn().mockResolvedValue(undefined);
const insertEscalation = vi.fn().mockResolvedValue(undefined);
const linkEscalationCheckin = vi.fn().mockResolvedValue(true);
const updateCheckinAfterBiomarkers = vi.fn().mockResolvedValue(true);

const analyzeMock = vi.fn().mockResolvedValue({
  record: {
    status: "ready",
    conversationId: "conv-abc",
    mapped: {
      quality: "ok",
      respiratory: { level: "low" },
      cognitive: { level: "low" },
      source: "amplifier",
    },
  },
  decision: {
    level: "amber",
    condition: "Possible DVT",
    action: "Contact the surgeon's office today.",
    call: "surgeon_office",
    rationale: ["Calf pain"],
    firedRules: ["dvt.calf_pain_or_swelling"],
  },
  decisionChanged: false,
});

const maybeEscalateMock = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient: () => ({ from: () => ({}) }),
}));

vi.mock("@/lib/db/queries", () => ({
  fetchDemoPatient: async () => ({
    id: "patient-1",
    name: "Margaret (demo, synthetic)",
    procedure: "hip hemiarthroplasty",
    surgeryDate: "2026-07-21",
    phone: undefined,
    caregiverPhone: undefined,
  }),
  fetchLatestEcg: async () => undefined,
  fetchLatestVitals: async () => undefined,
  fetchVitalsHistory: async () => [],
  fetchRecentCheckins: async () => [],
  insertCheckin,
  insertEscalation,
  insertVitals,
  linkEscalationCheckin,
  updateCheckinAfterBiomarkers,
}));

vi.mock("@/lib/amplifier/analyze-checkin", () => ({
  analyzeCheckinVoiceBiomarkers: (...args: unknown[]) => analyzeMock(...args),
}));

vi.mock("@/lib/amplifier/caregiver-escalate", () => ({
  maybeEscalateAfterBiomarkers: (...args: unknown[]) => maybeEscalateMock(...args),
}));

vi.mock("@/lib/telephony/sms", () => ({
  notifyCaregiver: vi.fn().mockResolvedValue({ status: "skipped", reason: "no phone" }),
}));

vi.mock("@/lib/clinical/red-flag-engine", () => ({
  evaluate: () => ({
    level: "amber",
    condition: "Possible DVT",
    action: "Contact the surgeon's office today for an urgent DVT assessment.",
    call: "surgeon_office",
    rationale: ["Calf pain or swelling reported."],
    firedRules: ["dvt.calf_pain_or_swelling"],
  }),
}));

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/checkin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/checkin — conversationId / voice biomarkers", () => {
  beforeEach(() => {
    insertCheckin.mockReset().mockResolvedValue("checkin-vb-1");
    insertVitals.mockReset().mockResolvedValue(undefined);
    insertEscalation.mockReset().mockResolvedValue(undefined);
    linkEscalationCheckin.mockReset().mockResolvedValue(true);
    updateCheckinAfterBiomarkers.mockReset().mockResolvedValue(true);
    analyzeMock.mockClear();
    maybeEscalateMock.mockClear().mockResolvedValue(null);
    vi.resetModules();
  });

  it("returns 400 when conversationId is empty or not a string", async () => {
    const { POST } = await import("./route");

    const empty = await POST(
      makeRequest({ transcript: "I feel fine.", conversationId: "   " }),
    );
    expect(empty.status).toBe(400);

    const wrongType = await POST(
      makeRequest({ transcript: "I feel fine.", conversationId: 123 }),
    );
    expect(wrongType.status).toBe(400);
  });

  it("does not set voice_biomarkers or call analyze when conversationId is omitted", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ transcript: "My calf hurts and is swollen." }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.checkinId).toBe("checkin-vb-1");
    expect(json.conversationId).toBeUndefined();

    const insertArg = insertCheckin.mock.calls[0]![1] as Record<string, unknown>;
    expect(insertArg).not.toHaveProperty("voice_biomarkers");
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it("inserts pending voice_biomarkers and fire-and-forgets analyze when conversationId present", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({
        transcript: "My calf hurts and is swollen.",
        conversationId: "  conv-abc  ",
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.checkinId).toBe("checkin-vb-1");
    expect(json.conversationId).toBe("conv-abc");

    expect(insertCheckin).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        voice_biomarkers: { status: "pending", conversationId: "conv-abc" },
      }),
    );

    // Fire-and-forget: analyze may start after the response is built.
    await vi.waitFor(() => {
      expect(analyzeMock).toHaveBeenCalledTimes(1);
    });
    expect(analyzeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv-abc",
        dayPostOp: expect.any(Number),
        priorDecision: expect.objectContaining({ level: "amber" }),
      }),
    );

    await vi.waitFor(() => {
      expect(updateCheckinAfterBiomarkers).toHaveBeenCalledTimes(1);
    });
    expect(updateCheckinAfterBiomarkers).toHaveBeenCalledWith(
      expect.anything(),
      "checkin-vb-1",
      expect.objectContaining({
        voice_biomarkers: expect.objectContaining({ status: "ready" }),
      }),
    );

    expect(maybeEscalateMock).toHaveBeenCalledTimes(1);
    expect(maybeEscalateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        checkinId: "checkin-vb-1",
        decisionChanged: false,
        priorDecision: expect.objectContaining({ level: "amber" }),
      }),
    );
  });

  it("shares caregiver escalate on fire-and-forget when decisionChanged", async () => {
    analyzeMock.mockResolvedValue({
      record: {
        status: "ready",
        conversationId: "conv-raise",
        mapped: {
          quality: "ok",
          respiratory: { level: "low" },
          cognitive: { level: "high" },
          source: "amplifier",
        },
      },
      decision: {
        level: "red",
        condition: "Respiratory voice biomarker critical",
        action: "Call 911 now.",
        call: "911",
        rationale: ["High respiratory voice biomarker."],
        firedRules: ["voice.respiratory_high"],
      },
      decisionChanged: true,
    });
    maybeEscalateMock.mockResolvedValue("S: raised.\nB: day 4.\nA: red.\nR: call 911.");

    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({
        transcript: "My calf hurts and is swollen.",
        conversationId: "conv-raise",
      }),
    );

    expect(res.status).toBe(200);

    await vi.waitFor(() => {
      expect(analyzeMock).toHaveBeenCalledTimes(1);
    });
    await vi.waitFor(() => {
      expect(maybeEscalateMock).toHaveBeenCalledTimes(1);
    });
    expect(maybeEscalateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        checkinId: "checkin-vb-1",
        decisionChanged: true,
        priorDecision: expect.objectContaining({ level: "amber" }),
        decision: expect.objectContaining({ level: "red" }),
      }),
    );

    await vi.waitFor(() => {
      expect(updateCheckinAfterBiomarkers).toHaveBeenCalledWith(
        expect.anything(),
        "checkin-vb-1",
        expect.objectContaining({
          sbar: "S: raised.\nB: day 4.\nA: red.\nR: call 911.",
          decision: expect.objectContaining({ level: "red" }),
        }),
      );
    });
  });

  it("does not call analyze when insertCheckin fails even if conversationId is present", async () => {
    insertCheckin.mockResolvedValue(undefined);

    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({
        transcript: "My calf hurts and is swollen.",
        conversationId: "conv-abc",
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.checkinId).toBeUndefined();
    // Give the event loop a tick — analyze must still not run.
    await Promise.resolve();
    expect(analyzeMock).not.toHaveBeenCalled();
  });
});
