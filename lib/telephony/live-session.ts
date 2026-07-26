import type { VoiceBiomarkersRecord } from "@/lib/amplifier/types";

export type LiveTurn = { role: "agent" | "user"; text: string; at?: string };

export type LiveSessionStatus = "active" | "finalizing" | "completed" | "error";

export type LiveCallSession = {
  conversationId: string;
  patientId: string;
  status: LiveSessionStatus;
  startedAt: string;
  updatedAt: string;
  turns: LiveTurn[];
  biomarkers: VoiceBiomarkersRecord | null;
  lastTickAt: string | null;
  tickInFlight: boolean;
  error?: string;
};

export const LIVE_TICK_INTERVAL_MS = 15_000;

/** How long a completed session stays visible via getLiveSession() (no id). */
export const LIVE_COMPLETED_VISIBLE_MS = 45_000;

const sessions = new Map<string, LiveCallSession>();

function nowIso(): string {
  return new Date().toISOString();
}

function isCompletedVisible(session: LiveCallSession, nowMs: number): boolean {
  if (session.status !== "completed") {
    return false;
  }
  const completedAt = Date.parse(session.updatedAt);
  if (Number.isNaN(completedAt)) {
    return false;
  }
  return nowMs - completedAt < LIVE_COMPLETED_VISIBLE_MS;
}

export function upsertLiveSession(args: {
  conversationId: string;
  patientId: string;
}): LiveCallSession {
  const existing = sessions.get(args.conversationId);
  if (existing) {
    return existing;
  }

  const ts = nowIso();
  const session: LiveCallSession = {
    conversationId: args.conversationId,
    patientId: args.patientId,
    status: "active",
    startedAt: ts,
    updatedAt: ts,
    turns: [],
    biomarkers: null,
    lastTickAt: null,
    tickInFlight: false,
  };
  sessions.set(args.conversationId, session);
  return session;
}

export function getLiveSession(conversationId?: string): LiveCallSession | null {
  if (conversationId) {
    return sessions.get(conversationId) ?? null;
  }

  const nowMs = Date.now();
  let bestActive: LiveCallSession | null = null;
  let bestFinalizing: LiveCallSession | null = null;
  let bestCompleted: LiveCallSession | null = null;

  for (const session of sessions.values()) {
    if (session.status === "active") {
      if (!bestActive || session.startedAt > bestActive.startedAt) {
        bestActive = session;
      }
    } else if (session.status === "finalizing") {
      if (!bestFinalizing || session.startedAt > bestFinalizing.startedAt) {
        bestFinalizing = session;
      }
    } else if (isCompletedVisible(session, nowMs)) {
      // Briefly keep completed visible so PatientChart can bind phase:final
      // biomarkers and router.refresh(); then fall back to idle/fixture.
      if (!bestCompleted || session.startedAt > bestCompleted.startedAt) {
        bestCompleted = session;
      }
    }
  }

  return bestActive ?? bestFinalizing ?? bestCompleted;
}

export function updateLiveSession(
  conversationId: string,
  patch: Partial<Omit<LiveCallSession, "conversationId">>,
): LiveCallSession | null {
  const session = sessions.get(conversationId);
  if (!session) {
    return null;
  }

  Object.assign(session, patch, { updatedAt: nowIso() });
  return session;
}

export function beginTick(conversationId: string, nowIsoStr: string): boolean {
  const session = sessions.get(conversationId);
  if (!session) {
    return false;
  }

  if (session.tickInFlight) {
    return false;
  }

  if (session.lastTickAt) {
    const elapsed = Date.parse(nowIsoStr) - Date.parse(session.lastTickAt);
    if (elapsed < LIVE_TICK_INTERVAL_MS) {
      return false;
    }
  }

  session.tickInFlight = true;
  session.updatedAt = nowIsoStr;
  return true;
}

export function endTick(conversationId: string, nowIsoStr: string): void {
  const session = sessions.get(conversationId);
  if (!session) {
    return;
  }

  session.tickInFlight = false;
  session.lastTickAt = nowIsoStr;
  session.updatedAt = nowIsoStr;
}

export function clearLiveSessionsForTests(): void {
  sessions.clear();
}
