import { afterEach, describe, expect, it, vi } from "vitest";

const getSupabaseClient = vi.fn();
const fetchDemoPatient = vi.fn();
const fetchRecentCheckins = vi.fn();
const getLiveSession = vi.fn();
const runLiveTick = vi.fn();
const findPatient = vi.fn();

vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient,
}));

vi.mock("@/lib/db/queries", () => ({
  fetchDemoPatient,
  fetchRecentCheckins,
}));

vi.mock("@/lib/telephony/live-session", () => ({
  getLiveSession,
}));

vi.mock("@/lib/telephony/live-tick", () => ({
  runLiveTick,
}));

vi.mock("@/lib/sim/roster", () => ({
  findPatient,
}));

function makeRequest(query = ""): Request {
  return new Request(`http://localhost/api/live-call${query}`, {
    method: "GET",
  });
}

afterEach(() => {
  getSupabaseClient.mockReset().mockReturnValue(null);
  fetchDemoPatient.mockReset();
  fetchRecentCheckins.mockReset();
  getLiveSession.mockReset().mockReturnValue(null);
  runLiveTick.mockReset().mockResolvedValue(null);
  findPatient.mockReset().mockReturnValue(undefined);
});

describe("GET /api/live-call", () => {
  it("returns idle with recent roster calls when no live session exists", async () => {
    findPatient.mockReturnValue({
      id: "margaret-ellison",
      checkins: [
        {
          id: "chk_roster_1",
          at: "2026-07-26T09:00:00.000Z",
          dayPostOp: 4,
          said: "I still get winded walking to the bathroom.",
          decision: { level: "amber" },
          voiceBiomarkers: {
            status: "ready",
            phase: "final",
            conversationId: "conv_roster_1",
          },
        },
      ],
    });

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      status: "idle",
      session: null,
      recentCalls: [
        {
          id: "chk_roster_1",
          at: "2026-07-26T09:00:00.000Z",
          dayPostOp: 4,
          summary: "I still get winded walking to the bathroom.",
          decisionLevel: "amber",
          biomarkersStatus: "ready",
          biomarkersPhase: "final",
          conversationId: "conv_roster_1",
          inProgress: false,
        },
      ],
    });
    expect(runLiveTick).not.toHaveBeenCalled();
  });

  it("returns an active session, prepends it to recent calls, and starts a live tick", async () => {
    getSupabaseClient.mockReturnValue({ from: vi.fn() });
    fetchDemoPatient.mockResolvedValue({
      id: "db-margaret",
      name: "Margaret (demo, synthetic)",
      procedure: "Hip hemiarthroplasty",
      surgeryDate: "2026-07-22",
      phone: undefined,
      caregiverPhone: undefined,
    });
    fetchRecentCheckins.mockResolvedValue([
      {
        id: "chk_db_1",
        created_at: "2026-07-26T08:45:00.000Z",
        day_post_op: 3,
        transcript: "Yesterday's call was reassuring.",
        decision: { level: "green" },
        voice_biomarkers: {
          status: "ready",
          phase: "final",
          conversationId: "conv_prev",
        },
      },
    ]);
    getLiveSession.mockReturnValue({
      conversationId: "conv_live",
      patientId: "margaret-ellison",
      status: "active",
      startedAt: "2026-07-26T10:00:00.000Z",
      updatedAt: "2026-07-26T10:01:00.000Z",
      turns: [
        { role: "agent", text: "How are you feeling today?" },
        { role: "user", text: "A little more short of breath." },
      ],
      biomarkers: {
        status: "pending",
        phase: "during",
        conversationId: "conv_live",
      },
      lastTickAt: null,
      tickInFlight: true,
    });

    const { GET } = await import("./route");
    const res = await GET(makeRequest("?conversationId=conv_live"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("active");
    expect(json.session).toMatchObject({
      conversationId: "conv_live",
      patientId: "margaret-ellison",
      callStatus: "active",
      updatedAt: "2026-07-26T10:01:00.000Z",
      tickInFlight: true,
      biomarkers: {
        status: "pending",
        phase: "during",
        conversationId: "conv_live",
      },
    });
    expect(json.session.turns).toEqual([
      { role: "agent", text: "How are you feeling today?" },
      { role: "user", text: "A little more short of breath." },
    ]);
    expect(json.recentCalls[0]).toMatchObject({
      id: "conv_live",
      conversationId: "conv_live",
      inProgress: true,
      biomarkersStatus: "pending",
      biomarkersPhase: "during",
    });
    expect(json.recentCalls[0].summary).toContain("short of breath");
    expect(json.recentCalls[1]).toMatchObject({
      id: "chk_db_1",
      decisionLevel: "green",
      inProgress: false,
    });
    expect(runLiveTick).toHaveBeenCalledWith({ conversationId: "conv_live" });
  });
});
