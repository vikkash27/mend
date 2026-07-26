import { afterEach, describe, expect, it, vi } from "vitest";

// Constraint: this route must work with no Supabase and no ElevenLabs
// credentials configured, exactly like /api/checkin and /api/triage.
vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient: () => null,
}));

function makeRequest(body?: unknown): Request {
  return new Request("http://localhost/api/call", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

const ENV_KEYS = [
  "DEMO_PATIENT_PHONE",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_AGENT_ID",
  "ELEVENLABS_AGENT_PHONE_NUMBER_ID",
] as const;

describe("POST /api/call", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
    vi.resetModules();
    vi.doUnmock("@/lib/telephony/call");
    vi.doUnmock("@/lib/telephony/live-session");
  });

  it("never throws on a missing body", async () => {
    const { POST } = await import("./route");
    await expect(POST(makeRequest())).resolves.not.toThrow();
  });

  it("never throws on malformed JSON", async () => {
    const { POST } = await import("./route");
    await expect(POST(makeRequest("{not valid json"))).resolves.not.toThrow();
  });

  it("returns 400 with no Supabase patient and no DEMO_PATIENT_PHONE — nothing to dial", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.status).toBe("error");
  });

  it("returns a typed skipped result (503) when a destination number exists but ElevenLabs credentials are absent", async () => {
    process.env.DEMO_PATIENT_PHONE = "+14155551234";
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe("skipped");
  });

  it("accepts an explicit dayPostOp without throwing", async () => {
    process.env.DEMO_PATIENT_PHONE = "+14155551234";
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ dayPostOp: 10 }));
    expect(res.status).toBe(503);
  });

  it("echoes a valid clinician source in the response", async () => {
    process.env.DEMO_PATIENT_PHONE = "+14155551234";
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ source: "clinician" }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.source).toBe("clinician");
  });

  it("echoes a valid patient source in the response", async () => {
    process.env.DEMO_PATIENT_PHONE = "+14155551234";
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ source: "patient" }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.source).toBe("patient");
  });

  it("ignores an invalid source (treats as undefined)", async () => {
    process.env.DEMO_PATIENT_PHONE = "+14155551234";
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ source: "nurse" }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.source).toBeUndefined();
  });

  it("omits source when the body does not include one", async () => {
    process.env.DEMO_PATIENT_PHONE = "+14155551234";
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.source).toBeUndefined();
  });

  it("registers a live session when an outbound call is sent with a conversation id", async () => {
    process.env.DEMO_PATIENT_PHONE = "+14155551234";

    const startCheckInCall = vi.fn().mockResolvedValue({
      status: "sent",
      conversationId: "conv_live",
    });
    const upsertLiveSession = vi.fn();

    vi.doMock("@/lib/telephony/call", async () => {
      const actual = await vi.importActual<typeof import("@/lib/telephony/call")>(
        "@/lib/telephony/call",
      );
      return {
        ...actual,
        startCheckInCall,
      };
    });
    vi.doMock("@/lib/telephony/live-session", () => ({
      upsertLiveSession,
    }));

    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      status: "sent",
      conversationId: "conv_live",
    });
    expect(upsertLiveSession).toHaveBeenCalledWith({
      conversationId: "conv_live",
      patientId: "margaret-ellison",
    });
  });

  it("registers live session with roster hero id even when fetchDemoPatient returns a UUID", async () => {
    process.env.DEMO_PATIENT_PHONE = "+14155551234";

    const startCheckInCall = vi.fn().mockResolvedValue({
      status: "sent",
      conversationId: "conv_uuid_bind",
    });
    const upsertLiveSession = vi.fn();
    const lastCheckinSummary = vi.fn().mockResolvedValue("Prior check-in ok.");
    const fetchDemoPatient = vi.fn().mockResolvedValue({
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      name: "Margaret Ellison",
      phone: "+14155551234",
    });

    vi.doMock("@/lib/db/supabase", () => ({
      getSupabaseClient: () => ({ from: vi.fn() }),
    }));
    vi.doMock("@/lib/db/queries", () => ({
      fetchDemoPatient,
    }));
    vi.doMock("@/lib/memory/last-checkin", () => ({
      lastCheckinSummary,
    }));
    vi.doMock("@/lib/telephony/call", async () => {
      const actual = await vi.importActual<typeof import("@/lib/telephony/call")>(
        "@/lib/telephony/call",
      );
      return {
        ...actual,
        startCheckInCall,
      };
    });
    vi.doMock("@/lib/telephony/live-session", () => ({
      upsertLiveSession,
    }));

    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(200);
    expect(fetchDemoPatient).toHaveBeenCalled();
    expect(lastCheckinSummary).toHaveBeenCalledWith(
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    );
    expect(upsertLiveSession).toHaveBeenCalledWith({
      conversationId: "conv_uuid_bind",
      patientId: "margaret-ellison",
    });
  });
});
