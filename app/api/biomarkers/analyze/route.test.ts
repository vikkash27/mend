import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const analyzeMock = vi.fn();
const updateCheckinAfterBiomarkersMock = vi.fn();
const getSupabaseClientMock = vi.fn();
const fetchDemoPatientMock = vi.fn();
const insertEscalationMock = vi.fn();
const linkEscalationCheckinMock = vi.fn();
const notifyCaregiverMock = vi.fn();
const generateSbarMock = vi.fn();

vi.mock("@/lib/amplifier/analyze-checkin", () => ({
  analyzeCheckinVoiceBiomarkers: (...args: unknown[]) => analyzeMock(...args),
}));

vi.mock("@/lib/db/queries", () => ({
  updateCheckinAfterBiomarkers: (...args: unknown[]) =>
    updateCheckinAfterBiomarkersMock(...args),
  fetchDemoPatient: (...args: unknown[]) => fetchDemoPatientMock(...args),
  insertEscalation: (...args: unknown[]) => insertEscalationMock(...args),
  linkEscalationCheckin: (...args: unknown[]) => linkEscalationCheckinMock(...args),
}));

vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient: () => getSupabaseClientMock(),
}));

vi.mock("@/lib/telephony/sms", () => ({
  notifyCaregiver: (...args: unknown[]) => notifyCaregiverMock(...args),
}));

vi.mock("@/lib/llm/sbar", () => ({
  generateSbar: (...args: unknown[]) => generateSbarMock(...args),
}));

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/biomarkers/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const priorDecision = {
  level: "green" as const,
  action: "Continue recovery plan.",
  rationale: ["No red-flag rules fired."],
  firedRules: [] as string[],
};

const validBody = {
  checkinId: "checkin-1",
  conversationId: "conv-abc",
  dayPostOp: 4,
  symptoms: { breathless: false },
  vitals: {
    timestamp: "2026-07-25T12:00:00.000Z",
    hr: 72,
    source: "simulated" as const,
    quality: "ok" as const,
  },
  priorDecision,
};

const amberDecision = {
  ...priorDecision,
  level: "amber" as const,
  firedRules: ["voice.cognitive_high"],
  condition: "Cognitive voice biomarker elevated",
  action: "Contact the surgeon's office today.",
};

const readyRecord = {
  status: "ready" as const,
  conversationId: "conv-abc",
  jobIds: ["job-r", "job-c"],
  analyzedAt: "2026-07-25T12:05:00.000Z",
};

describe("POST /api/biomarkers/analyze", () => {
  beforeEach(() => {
    analyzeMock.mockReset();
    updateCheckinAfterBiomarkersMock.mockReset().mockResolvedValue(true);
    getSupabaseClientMock.mockReset().mockReturnValue(null);
    fetchDemoPatientMock.mockReset();
    insertEscalationMock.mockReset().mockResolvedValue("esc-1");
    linkEscalationCheckinMock.mockReset().mockResolvedValue(true);
    notifyCaregiverMock.mockReset().mockResolvedValue({ status: "sent", sid: "SM_test" });
    generateSbarMock.mockReset().mockResolvedValue("S: biomarker raised.\nB: day 4.\nA: amber.\nR: call office.");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 on malformed JSON", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest("{not valid json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Expected/);
  });

  it("returns 400 when dayPostOp is not a number", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ ...validBody, dayPostOp: "four" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when priorDecision is missing", async () => {
    const { POST } = await import("./route");
    const { priorDecision: _prior, ...withoutPrior } = validBody;
    const res = await POST(makeRequest(withoutPrior));
    expect(res.status).toBe(400);
  });

  it("happy path: mocks analyze, skips persist without Supabase, returns record/decision/decisionChanged", async () => {
    analyzeMock.mockResolvedValue({
      record: readyRecord,
      decision: amberDecision,
      decisionChanged: true,
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(analyzeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv-abc",
        dayPostOp: 4,
        symptoms: validBody.symptoms,
        vitals: validBody.vitals,
        priorDecision,
      }),
    );
    expect(updateCheckinAfterBiomarkersMock).not.toHaveBeenCalled();

    const json = await res.json();
    expect(json.record).toEqual(readyRecord);
    expect(json.decision).toEqual(amberDecision);
    expect(json.decisionChanged).toBe(true);
  });

  it("persists via updateCheckinAfterBiomarkers when Supabase is available", async () => {
    const supabase = { from: vi.fn() };
    getSupabaseClientMock.mockReturnValue(supabase);

    const decision = priorDecision;
    const record = {
      status: "unavailable" as const,
      conversationId: "conv-abc",
      error: "audio_not_ready",
    };
    analyzeMock.mockResolvedValue({
      record,
      decision,
      decisionChanged: false,
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(updateCheckinAfterBiomarkersMock).toHaveBeenCalledWith(
      supabase,
      "checkin-1",
      {
        voice_biomarkers: record,
        decision,
      },
    );
    const json = await res.json();
    expect(json.decisionChanged).toBe(false);
  });

  it("notifies caregiver when decision rises green→amber", async () => {
    analyzeMock.mockResolvedValue({
      record: readyRecord,
      decision: amberDecision,
      decisionChanged: true,
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(generateSbarMock).toHaveBeenCalledTimes(1);
    expect(notifyCaregiverMock).toHaveBeenCalledTimes(1);
    const [, decisionArg, sbarArg] = notifyCaregiverMock.mock.calls[0]!;
    expect((decisionArg as { level: string }).level).toBe("amber");
    expect(typeof sbarArg).toBe("string");
  });

  it("does not notify when priorDecision was already the same amber level", async () => {
    const priorAmber = { ...amberDecision, firedRules: ["dvt.calf_pain_or_swelling"] };
    analyzeMock.mockResolvedValue({
      record: readyRecord,
      decision: { ...amberDecision, firedRules: ["dvt.calf_pain_or_swelling", "voice.cognitive_high"] },
      decisionChanged: true,
    });

    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({
        ...validBody,
        priorDecision: priorAmber,
      }),
    );

    expect(res.status).toBe(200);
    expect(notifyCaregiverMock).not.toHaveBeenCalled();
    expect(generateSbarMock).not.toHaveBeenCalled();
  });

  it("notifies when level rises amber→red", async () => {
    const redDecision = {
      ...amberDecision,
      level: "red" as const,
      firedRules: ["voice.respiratory_high"],
      condition: "Respiratory voice biomarker critical",
      call: "911" as const,
      action: "Call 911 now.",
    };
    analyzeMock.mockResolvedValue({
      record: readyRecord,
      decision: redDecision,
      decisionChanged: true,
    });

    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({
        ...validBody,
        priorDecision: amberDecision,
      }),
    );

    expect(res.status).toBe(200);
    expect(notifyCaregiverMock).toHaveBeenCalledTimes(1);
    expect((notifyCaregiverMock.mock.calls[0]![1] as { level: string }).level).toBe("red");
  });

  it("fail-open: notifyCaregiver error still returns 200 with analysis", async () => {
    notifyCaregiverMock.mockResolvedValue({ status: "error", reason: "Twilio down" });
    analyzeMock.mockResolvedValue({
      record: readyRecord,
      decision: amberDecision,
      decisionChanged: true,
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.decisionChanged).toBe(true);
    expect(json.decision).toEqual(amberDecision);
  });

  it("links escalation audit when notify succeeds and Supabase is available", async () => {
    const supabase = { from: vi.fn() };
    getSupabaseClientMock.mockReturnValue(supabase);
    fetchDemoPatientMock.mockResolvedValue({
      id: "patient-1",
      name: "Margaret Chen",
      procedure: "hip hemiarthroplasty",
      surgeryDate: "2026-07-20",
      caregiverPhone: "+15551234567",
    });
    insertEscalationMock.mockResolvedValue("esc-early-1");

    analyzeMock.mockResolvedValue({
      record: readyRecord,
      decision: amberDecision,
      decisionChanged: true,
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(insertEscalationMock).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        patient_id: "patient-1",
        checkin_id: null,
        level: "amber",
      }),
    );
    expect(linkEscalationCheckinMock).toHaveBeenCalledWith(supabase, "esc-early-1", "checkin-1");
    expect(updateCheckinAfterBiomarkersMock).toHaveBeenCalledWith(
      supabase,
      "checkin-1",
      expect.objectContaining({
        voice_biomarkers: readyRecord,
        decision: amberDecision,
        sbar: expect.any(String),
      }),
    );
  });
});

describe("shouldNotifyCaregiverForBiomarkerDecision", () => {
  it("only notifies on level rise into amber/red", async () => {
    const { shouldNotifyCaregiverForBiomarkerDecision } = await import("./route");

    expect(
      shouldNotifyCaregiverForBiomarkerDecision({
        decisionChanged: true,
        priorLevel: "green",
        newLevel: "amber",
      }),
    ).toBe(true);
    expect(
      shouldNotifyCaregiverForBiomarkerDecision({
        decisionChanged: true,
        priorLevel: "amber",
        newLevel: "amber",
      }),
    ).toBe(false);
    expect(
      shouldNotifyCaregiverForBiomarkerDecision({
        decisionChanged: true,
        priorLevel: "amber",
        newLevel: "red",
      }),
    ).toBe(true);
    expect(
      shouldNotifyCaregiverForBiomarkerDecision({
        decisionChanged: false,
        priorLevel: "green",
        newLevel: "amber",
      }),
    ).toBe(false);
    expect(
      shouldNotifyCaregiverForBiomarkerDecision({
        decisionChanged: true,
        priorLevel: "red",
        newLevel: "amber",
      }),
    ).toBe(false);
  });
});
