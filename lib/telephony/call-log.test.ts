import { describe, expect, it } from "vitest";
import type { LiveCallSession } from "./live-session";
import { callLogFromCheckins, prependActiveSession } from "./call-log";

const longTranscript = "A".repeat(150);

describe("callLogFromCheckins", () => {
  it("maps checkin transcript to a truncated summary (~120 chars)", () => {
    const rows = callLogFromCheckins([
      {
        id: "chk_1",
        created_at: "2026-07-26T10:00:00.000Z",
        day_post_op: 4,
        transcript: longTranscript,
        decision: { level: "amber" },
        voice_biomarkers: {
          status: "ready",
          phase: "final",
          conversationId: "conv_1",
        },
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "chk_1",
      at: "2026-07-26T10:00:00.000Z",
      dayPostOp: 4,
      decisionLevel: "amber",
      biomarkersStatus: "ready",
      biomarkersPhase: "final",
      conversationId: "conv_1",
      inProgress: false,
    });
    expect(rows[0].summary.length).toBeLessThanOrEqual(120);
    expect(rows[0].summary).toMatch(/^A+…$/);
  });

  it("keeps short transcripts intact", () => {
    const rows = callLogFromCheckins([
      {
        id: "chk_2",
        created_at: "2026-07-26T09:00:00.000Z",
        transcript: "Feeling a bit breathless today.",
      },
    ]);

    expect(rows[0].summary).toBe("Feeling a bit breathless today.");
  });
});

describe("prependActiveSession", () => {
  it("prepends an in-progress row from an active live session", () => {
    const existing = callLogFromCheckins([
      {
        id: "chk_1",
        created_at: "2026-07-26T09:00:00.000Z",
        transcript: "Earlier call.",
      },
    ]);

    const session: LiveCallSession = {
      conversationId: "conv_live",
      patientId: "margaret-ellison",
      status: "active",
      startedAt: "2026-07-26T10:05:00.000Z",
      updatedAt: "2026-07-26T10:06:00.000Z",
      turns: [
        { role: "agent", text: "Hi Margaret, how are you feeling?" },
        { role: "user", text: "A little short of breath." },
      ],
      biomarkers: { status: "ready", phase: "during", conversationId: "conv_live" },
      lastTickAt: null,
      tickInFlight: false,
    };

    const rows = prependActiveSession(existing, session);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "conv_live",
      at: "2026-07-26T10:05:00.000Z",
      inProgress: true,
      conversationId: "conv_live",
      biomarkersStatus: "ready",
      biomarkersPhase: "during",
    });
    expect(rows[0].summary).toContain("short of breath");
    expect(rows[1]).toEqual(existing[0]);
  });

  it("returns rows unchanged when session is null", () => {
    const existing = callLogFromCheckins([
      { id: "chk_1", created_at: "2026-07-26T09:00:00.000Z", transcript: "Done." },
    ]);

    expect(prependActiveSession(existing, null)).toEqual(existing);
  });
});
