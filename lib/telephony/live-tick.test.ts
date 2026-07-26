import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginTick,
  clearLiveSessionsForTests,
  getLiveSession,
  updateLiveSession,
  upsertLiveSession,
} from "./live-session";
import { runLiveTick } from "./live-tick";

const CONVERSATION_ID = "conv_1";
const NOW = "2026-07-26T10:00:00.000Z";

const readyBiomarkers = {
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

afterEach(() => {
  delete process.env.ELEVENLABS_API_KEY;
  clearLiveSessionsForTests();
});

describe("runLiveTick", () => {
  it("coalesced tick does not call fetch", async () => {
    upsertLiveSession({
      conversationId: CONVERSATION_ID,
      patientId: "margaret-ellison",
    });
    beginTick(CONVERSATION_ID, NOW);

    const fetchImpl = vi.fn();
    const analyzeSnapshot = vi.fn();

    await runLiveTick({
      conversationId: CONVERSATION_ID,
      nowIso: NOW,
      fetchImpl,
      analyzeSnapshot,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(analyzeSnapshot).not.toHaveBeenCalled();
  });

  it("updates turns from conversation", async () => {
    process.env.ELEVENLABS_API_KEY = "xi_test";
    upsertLiveSession({
      conversationId: CONVERSATION_ID,
      patientId: "margaret-ellison",
    });

    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          conversation_id: CONVERSATION_ID,
          status: "in_progress",
          transcript: [
            { role: "agent", message: "Hello" },
            { role: "user", message: "Hi there" },
          ],
        }),
        { status: 200 },
      ),
    );
    const analyzeSnapshot = vi.fn().mockResolvedValue(readyBiomarkers);

    await runLiveTick({
      conversationId: CONVERSATION_ID,
      nowIso: NOW,
      fetchImpl,
      analyzeSnapshot,
    });

    expect(getLiveSession(CONVERSATION_ID)?.turns).toEqual([
      { role: "agent", text: "Hello" },
      { role: "user", text: "Hi there" },
    ]);
    expect(analyzeSnapshot).toHaveBeenCalledWith({
      conversationId: CONVERSATION_ID,
      fetchImpl,
    });
  });

  it("sets finalizing when ended", async () => {
    process.env.ELEVENLABS_API_KEY = "xi_test";
    upsertLiveSession({
      conversationId: CONVERSATION_ID,
      patientId: "margaret-ellison",
    });

    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          conversation_id: CONVERSATION_ID,
          status: "done",
          transcript: [{ role: "agent", message: "Goodbye" }],
        }),
        { status: 200 },
      ),
    );
    const analyzeSnapshot = vi.fn();

    await runLiveTick({
      conversationId: CONVERSATION_ID,
      nowIso: NOW,
      fetchImpl,
      analyzeSnapshot,
    });

    expect(getLiveSession(CONVERSATION_ID)?.status).toBe("finalizing");
    expect(analyzeSnapshot).not.toHaveBeenCalled();
  });

  it("runs snapshot when conversation fetch fails and keeps prior ready biomarkers", async () => {
    process.env.ELEVENLABS_API_KEY = "xi_test";
    upsertLiveSession({
      conversationId: CONVERSATION_ID,
      patientId: "margaret-ellison",
    });
    updateLiveSession(CONVERSATION_ID, { biomarkers: readyBiomarkers });

    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("upstream error", { status: 503 }),
    );
    const analyzeSnapshot = vi.fn().mockResolvedValue({
      status: "unavailable",
      conversationId: CONVERSATION_ID,
      error: "no audio",
      phase: "during",
    });

    await runLiveTick({
      conversationId: CONVERSATION_ID,
      nowIso: NOW,
      fetchImpl,
      analyzeSnapshot,
    });

    expect(analyzeSnapshot).toHaveBeenCalledWith({
      conversationId: CONVERSATION_ID,
      fetchImpl,
    });
    expect(getLiveSession(CONVERSATION_ID)?.biomarkers).toEqual(readyBiomarkers);
  });

  it("keeps prior ready biomarkers when snapshot returns unavailable", async () => {
    process.env.ELEVENLABS_API_KEY = "xi_test";
    upsertLiveSession({
      conversationId: CONVERSATION_ID,
      patientId: "margaret-ellison",
    });
    updateLiveSession(CONVERSATION_ID, { biomarkers: readyBiomarkers });

    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          conversation_id: CONVERSATION_ID,
          status: "in_progress",
          transcript: [],
        }),
        { status: 200 },
      ),
    );
    const analyzeSnapshot = vi.fn().mockResolvedValue({
      status: "unavailable",
      conversationId: CONVERSATION_ID,
      error: "no audio",
      phase: "during",
    });

    await runLiveTick({
      conversationId: CONVERSATION_ID,
      nowIso: NOW,
      fetchImpl,
      analyzeSnapshot,
    });

    expect(getLiveSession(CONVERSATION_ID)?.biomarkers).toEqual(readyBiomarkers);
  });
});
