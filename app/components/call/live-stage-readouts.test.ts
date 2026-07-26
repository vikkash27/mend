import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { VoiceBiomarkersRecord } from "@/lib/amplifier/types";
import type { CallLogRow } from "@/lib/telephony/call-log";
import { CallLogCompact } from "./CallLogCompact";
import { LiveBiomarkersReadout } from "./LiveBiomarkersReadout";
import {
  compactCallLogRows,
  hasLiveTranscript,
  transcriptEventsForStage,
} from "./call-stage-live";
import type { CallEvent } from "./timeline";

const SCRIPTED_EVENTS: CallEvent[] = [
  {
    id: "scripted-0",
    kind: "turn",
    at: 0,
    speaker: "mend",
    text: "Good morning, Margaret.",
  },
];

const RECENT_CALLS: CallLogRow[] = [
  {
    id: "conv_live",
    at: "2026-07-26T10:00:00.000Z",
    summary: "Call in progress",
    inProgress: true,
    biomarkersStatus: "pending",
    biomarkersPhase: "during",
    conversationId: "conv_live",
  },
  {
    id: "chk_1",
    at: "2026-07-25T09:30:00.000Z",
    dayPostOp: 4,
    summary: "Still breathless walking to the bathroom.",
    decisionLevel: "amber",
    biomarkersStatus: "ready",
    biomarkersPhase: "final",
    inProgress: false,
    conversationId: "conv_prev",
  },
];

const READY_RECORD: VoiceBiomarkersRecord = {
  status: "ready",
  phase: "during",
  conversationId: "conv_live",
  analyzedAt: "2026-07-26T10:01:00.000Z",
  mapped: {
    source: "amplifier",
    quality: "ok",
    overallLevel: "moderate",
    respiratory: {
      level: "high",
      score: 0.87,
    },
    cognitive: {
      level: "moderate",
      score: 0.46,
    },
  },
};

describe("call stage live helpers", () => {
  it("switches to live transcript events only while an active or finalizing call has turns", () => {
    const activeFeed = {
      status: "active" as const,
      analyzing: true,
      recentCalls: RECENT_CALLS,
      session: {
        conversationId: "conv_live",
        patientId: "margaret-ellison",
        callStatus: "active" as const,
        turns: [
          { role: "agent" as const, text: "How are you feeling?" },
          { role: "user" as const, text: "Short of breath today." },
        ],
        biomarkers: READY_RECORD,
        updatedAt: "2026-07-26T10:01:00.000Z",
        tickInFlight: true,
      },
    };

    expect(hasLiveTranscript(activeFeed)).toBe(true);
    expect(transcriptEventsForStage(SCRIPTED_EVENTS, activeFeed)).toEqual([
      {
        id: "live-0",
        kind: "turn",
        at: 0,
        speaker: "mend",
        text: "How are you feeling?",
      },
      {
        id: "live-1",
        kind: "turn",
        at: 5,
        speaker: "margaret",
        text: "Short of breath today.",
      },
    ]);

    const waitingFeed = {
      ...activeFeed,
      status: "finalizing" as const,
      session: {
        ...activeFeed.session,
        callStatus: "finalizing" as const,
        turns: [],
      },
    };
    expect(hasLiveTranscript(waitingFeed)).toBe(false);
    expect(transcriptEventsForStage(SCRIPTED_EVENTS, waitingFeed)).toEqual(
      SCRIPTED_EVENTS,
    );

    const completedFeed = {
      ...activeFeed,
      status: "completed" as const,
      session: {
        ...activeFeed.session,
        callStatus: "completed" as const,
      },
    };
    expect(hasLiveTranscript(completedFeed)).toBe(false);
  });
});

describe("CallLogCompact", () => {
  it("filters out the in-progress row and renders the past-call summary", () => {
    expect(compactCallLogRows(RECENT_CALLS)).toEqual([RECENT_CALLS[1]]);

    const html = renderToStaticMarkup(React.createElement(CallLogCompact, { rows: RECENT_CALLS }));
    expect(html).toContain("Past calls");
    expect(html).toContain("Still breathless walking to the bathroom.");
    expect(html).not.toContain("Call in progress");
  });
});

describe("LiveBiomarkersReadout", () => {
  it("renders the Amplifier heading, phase, and mapped domains", () => {
    const html = renderToStaticMarkup(
      React.createElement(LiveBiomarkersReadout, { record: READY_RECORD }),
    );

    expect(html).toContain("Amplifier readout");
    expect(html).toContain("during call");
    expect(html).toContain("Respiratory");
    expect(html).toContain("Cognitive");
  });
});
