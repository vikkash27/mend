import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginTick,
  clearLiveSessionsForTests,
  endTick,
  getLiveSession,
  LIVE_COMPLETED_VISIBLE_MS,
  LIVE_TICK_INTERVAL_MS,
  updateLiveSession,
  upsertLiveSession,
} from "./live-session";

afterEach(() => {
  clearLiveSessionsForTests();
  vi.useRealTimers();
});

describe("live-session store", () => {
  it("upserts an active session and retrieves it as current", () => {
    const s = upsertLiveSession({
      conversationId: "conv_1",
      patientId: "margaret-ellison",
    });
    expect(s.status).toBe("active");
    expect(getLiveSession()?.conversationId).toBe("conv_1");
    expect(getLiveSession("conv_1")?.patientId).toBe("margaret-ellison");
  });

  it("coalesces ticks within 15s and while in flight", () => {
    upsertLiveSession({ conversationId: "conv_1", patientId: "margaret-ellison" });
    const t0 = "2026-07-26T10:00:00.000Z";
    expect(beginTick("conv_1", t0)).toBe(true);
    expect(beginTick("conv_1", t0)).toBe(false); // in flight
    endTick("conv_1", t0);
    const t1 = new Date(Date.parse(t0) + LIVE_TICK_INTERVAL_MS - 1).toISOString();
    expect(beginTick("conv_1", t1)).toBe(false);
    const t2 = new Date(Date.parse(t0) + LIVE_TICK_INTERVAL_MS).toISOString();
    expect(beginTick("conv_1", t2)).toBe(true);
  });

  it("patches biomarkers and turns", () => {
    upsertLiveSession({ conversationId: "conv_1", patientId: "margaret-ellison" });
    updateLiveSession("conv_1", {
      turns: [{ role: "agent", text: "Hi Margaret" }],
      biomarkers: {
        status: "ready",
        phase: "during",
        conversationId: "conv_1",
        mapped: {
          quality: "ok",
          respiratory: { level: "moderate", score: 0.4 },
          cognitive: { level: "low", score: 0.2 },
          source: "amplifier",
        },
      },
    });
    expect(getLiveSession("conv_1")?.turns).toHaveLength(1);
    expect(getLiveSession("conv_1")?.biomarkers?.phase).toBe("during");
  });

  it("returns the latest completed session when none are active or finalizing", () => {
    upsertLiveSession({
      conversationId: "conv_done",
      patientId: "margaret-ellison",
    });
    updateLiveSession("conv_done", {
      status: "completed",
      biomarkers: {
        status: "ready",
        phase: "final",
        conversationId: "conv_done",
        mapped: {
          quality: "ok",
          respiratory: { level: "moderate", score: 0.4 },
          cognitive: { level: "low", score: 0.2 },
          source: "amplifier",
        },
      },
    });

    expect(getLiveSession()?.conversationId).toBe("conv_done");
    expect(getLiveSession()?.biomarkers?.phase).toBe("final");
  });

  it("stops returning completed sessions after the visibility TTL (idle for API)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T10:00:00.000Z"));

    upsertLiveSession({
      conversationId: "conv_done",
      patientId: "margaret-ellison",
    });
    updateLiveSession("conv_done", {
      status: "completed",
      biomarkers: {
        status: "ready",
        phase: "final",
        conversationId: "conv_done",
        mapped: {
          quality: "ok",
          respiratory: { level: "moderate", score: 0.4 },
          cognitive: { level: "low", score: 0.2 },
          source: "amplifier",
        },
      },
    });

    expect(getLiveSession()?.conversationId).toBe("conv_done");

    vi.setSystemTime(
      new Date(Date.parse("2026-07-26T10:00:00.000Z") + LIVE_COMPLETED_VISIBLE_MS - 1),
    );
    expect(getLiveSession()?.conversationId).toBe("conv_done");

    vi.setSystemTime(
      new Date(Date.parse("2026-07-26T10:00:00.000Z") + LIVE_COMPLETED_VISIBLE_MS),
    );
    expect(getLiveSession()).toBeNull();
    // By-id lookup still sees the stored session (finalize/tick/chart bind).
    expect(getLiveSession("conv_done")?.status).toBe("completed");
  });

  it("prefers active then finalizing over a still-visible completed session", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T10:00:00.000Z"));

    upsertLiveSession({
      conversationId: "conv_done",
      patientId: "margaret-ellison",
    });
    updateLiveSession("conv_done", { status: "completed" });

    vi.setSystemTime(new Date("2026-07-26T10:00:01.000Z"));
    upsertLiveSession({
      conversationId: "conv_finalizing",
      patientId: "margaret-ellison",
    });
    updateLiveSession("conv_finalizing", { status: "finalizing" });

    expect(getLiveSession()?.conversationId).toBe("conv_finalizing");

    vi.setSystemTime(new Date("2026-07-26T10:00:02.000Z"));
    upsertLiveSession({
      conversationId: "conv_active",
      patientId: "margaret-ellison",
    });

    expect(getLiveSession()?.conversationId).toBe("conv_active");
  });
});
