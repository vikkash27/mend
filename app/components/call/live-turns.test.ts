import { describe, expect, it } from "vitest";
import type { LiveTurn } from "@/lib/telephony/live-session";
import { liveTurnsToEvents } from "./live-turns";

describe("liveTurnsToEvents", () => {
  it("maps agent to mend and user to margaret turn events", () => {
    const turns: LiveTurn[] = [
      { role: "agent", text: "Hello Margaret." },
      { role: "user", text: "I feel short of breath." },
    ];

    expect(liveTurnsToEvents(turns)).toEqual([
      {
        id: "live-0",
        kind: "turn",
        at: 0,
        speaker: "mend",
        text: "Hello Margaret.",
      },
      {
        id: "live-1",
        kind: "turn",
        at: 5,
        speaker: "margaret",
        text: "I feel short of breath.",
      },
    ]);
  });

  it("uses parsed ISO timestamps relative to the first turn when at is present", () => {
    const turns: LiveTurn[] = [
      { role: "agent", text: "Hi", at: "2026-07-26T10:00:00.000Z" },
      { role: "user", text: "Hello", at: "2026-07-26T10:00:12.000Z" },
    ];

    const events = liveTurnsToEvents(turns);
    expect(events[0]?.at).toBe(0);
    expect(events[1]?.at).toBe(12);
  });

  it("returns an empty list for no turns", () => {
    expect(liveTurnsToEvents([])).toEqual([]);
  });
});
