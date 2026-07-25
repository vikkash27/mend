import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const analyzeMock = vi.fn();
const updateCheckinAfterBiomarkersMock = vi.fn();
const getSupabaseClientMock = vi.fn();

vi.mock("@/lib/amplifier/analyze-checkin", () => ({
  analyzeCheckinVoiceBiomarkers: (...args: unknown[]) => analyzeMock(...args),
}));

vi.mock("@/lib/db/queries", () => ({
  updateCheckinAfterBiomarkers: (...args: unknown[]) =>
    updateCheckinAfterBiomarkersMock(...args),
}));

vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient: () => getSupabaseClientMock(),
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

describe("POST /api/biomarkers/analyze", () => {
  beforeEach(() => {
    analyzeMock.mockReset();
    updateCheckinAfterBiomarkersMock.mockReset().mockResolvedValue(true);
    getSupabaseClientMock.mockReset().mockReturnValue(null);
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
    const decision = {
      ...priorDecision,
      level: "amber" as const,
      firedRules: ["voice.cognitive_high"],
      condition: "Cognitive voice biomarker elevated",
    };
    const record = {
      status: "ready" as const,
      conversationId: "conv-abc",
      jobIds: ["job-r", "job-c"],
      analyzedAt: "2026-07-25T12:05:00.000Z",
    };
    analyzeMock.mockResolvedValue({
      record,
      decision,
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
    expect(json.record).toEqual(record);
    expect(json.decision).toEqual(decision);
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
});
