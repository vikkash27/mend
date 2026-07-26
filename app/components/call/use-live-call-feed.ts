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

async function fetchLiveCallFeed(): Promise<LiveCallFeed> {
  const response = await fetch("/api/live-call");
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
    let cancelled = false;

    async function refresh() {
      try {
        const next = await fetchLiveCallFeed();
        if (!cancelled) {
          setFeed(next);
        }
      } catch {
        // Keep the last good snapshot on transient poll failures.
      }
    }

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, pollMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pollMs]);

  return feed;
}
