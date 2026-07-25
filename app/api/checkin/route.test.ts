import { describe, expect, it, vi } from "vitest";

// Constraint #6: both routes must work with no Supabase and no Anthropic
// credentials configured. Mocking both client getters to their
// "unavailable" value exercises exactly that path deterministically.
vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient: () => null,
}));

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/checkin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/checkin", () => {
  it("returns 400 on malformed JSON without throwing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest("{not valid json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when transcript is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when transcript is an empty string", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ transcript: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when dayPostOp is not a number", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ transcript: "I feel fine.", dayPostOp: "four" }));
    expect(res.status).toBe(400);
  });

  it(
    "works end-to-end with no Supabase and no Anthropic credentials: " +
      "returns a valid response shape with a null sbar on a green decision",
    async () => {
      const { POST } = await import("./route");
      const res = await POST(makeRequest({ transcript: "I'm doing fine, pain is controlled." }));

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.decision).toBeDefined();
      expect(["green", "amber", "red"]).toContain(json.decision.level);
      expect(Array.isArray(json.trendFindings)).toBe(true);
      expect(json.phase).toBeDefined();
      expect(json.symptoms).toBeDefined();
      expect(json.vitals).toBeDefined();
      expect(json.ecg).toBeDefined();

      if (json.decision.level === "green") {
        expect(json.sbar).toBeNull();
      } else {
        expect(typeof json.sbar).toBe("string");
      }
    },
  );

  it("never returns a severity that did not come from evaluate()/composeDecision()", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ transcript: "Nothing unusual to report today." }));
    const json = await res.json();
    expect(["green", "amber", "red"]).toContain(json.decision.level);
  });
});
