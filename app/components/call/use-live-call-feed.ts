"use client";

import { useEffect, useState } from "react";
import type { VoiceBiomarkersRecord } from "@/lib/amplifier/types";
import type { CallLogRow } from "@/lib/telephony/call-log";
import type { LiveTurn } from "@/lib/telephony/live-session";

type LiveCallSessionPayload = {
  conversationId: string;
  patientId: string;
  callStatus: "active" | "finalizing" | "completed" | "error";
  turns: LiveTurn[];
  biomarkers: VoiceBiomarkersRecord | null;
  updatedAt: string;
  tickInFlight: boolean;
};

export type LiveCallFeed =
  | {
      status: "idle";
      session: null;
      recentCalls: CallLogRow[];
      analyzing: false;
    }
  | {
      status: "active" | "finalizing" | "completed" | "error";
      session: LiveCallSessionPayload;
      recentCalls: CallLogRow[];
      analyzing: boolean;
    };

const idleFeed: LiveCallFeed = {
  status: "idle",
  session: null,
  recentCalls: [],
  analyzing: false,
};

function isAnalyzing(session: LiveCallSessionPayload): boolean {
  return session.tickInFlight || session.biomarkers?.status === "pending";
}

/** Only apply poll results when this refresh is still the latest generation. */
export function shouldApplyPollResponse(
  responseGeneration: number,
  latestGeneration: number,
): boolean {
  return responseGeneration === latestGeneration;
}

async function fetchLiveCallFeed(signal?: AbortSignal): Promise<LiveCallFeed> {
  const response = await fetch("/api/live-call", { signal });
  if (!response.ok) {
    throw new Error(`live-call poll failed with status ${response.status}`);
  }

  const body = (await response.json()) as LiveCallFeed;
  if (body.status === "idle") {
    return {
      status: "idle",
      session: null,
      recentCalls: body.recentCalls ?? [],
      analyzing: false,
    };
  }

  return {
    status: body.status,
    session: body.session,
    recentCalls: body.recentCalls ?? [],
    analyzing: isAnalyzing(body.session),
  };
}

export function useLiveCallFeed(pollMs = 2500): LiveCallFeed {
  const [feed, setFeed] = useState<LiveCallFeed>(idleFeed);

  useEffect(() => {
    let latestGeneration = 0;
    let inFlight: AbortController | null = null;

    async function refresh() {
      if (inFlight) {
        return;
      }

      const controller = new AbortController();
      inFlight = controller;
      const generation = ++latestGeneration;

      try {
        const next = await fetchLiveCallFeed(controller.signal);
        if (!shouldApplyPollResponse(generation, latestGeneration)) {
          return;
        }
        setFeed(next);
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        // Keep the last good snapshot on transient poll failures.
      } finally {
        if (inFlight === controller) {
          inFlight = null;
        }
      }
    }

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, pollMs);

    return () => {
      latestGeneration += 1;
      inFlight?.abort();
      window.clearInterval(timer);
    };
  }, [pollMs]);

  return feed;
}
