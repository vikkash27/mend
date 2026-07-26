import { analyzeLiveVoiceSnapshot } from "@/lib/amplifier/analyze-live-snapshot";
import { fetchConversationDetails } from "./elevenlabs-conversation";
import { finalizeLiveSession } from "./live-finalize";
import {
  beginTick,
  endTick,
  getLiveSession,
  type LiveCallSession,
  updateLiveSession,
} from "./live-session";

export async function runLiveTick(args: {
  conversationId: string;
  nowIso?: string;
  fetchImpl?: typeof fetch;
  analyzeSnapshot?: typeof analyzeLiveVoiceSnapshot;
  finalizeSession?: typeof finalizeLiveSession;
}): Promise<LiveCallSession | null> {
  const nowIso = args.nowIso ?? new Date().toISOString();

  if (!beginTick(args.conversationId, nowIso)) {
    return getLiveSession(args.conversationId);
  }

  try {
    const session = getLiveSession(args.conversationId);
    if (!session) {
      return null;
    }

    if (session.status === "completed" || session.status === "error") {
      return session;
    }

    const priorBiomarkers = session.biomarkers;
    const wasFinalizing = session.status === "finalizing";

    let skipSnapshot = wasFinalizing;

    const conversation = await fetchConversationDetails({
      conversationId: args.conversationId,
      fetchImpl: args.fetchImpl,
    });

    if (conversation.status === "ok") {
      updateLiveSession(args.conversationId, { turns: conversation.turns });

      if (conversation.ended) {
        updateLiveSession(args.conversationId, { status: "finalizing" });
        skipSnapshot = true;
      }
    }

    if (!skipSnapshot) {
      const analyze = args.analyzeSnapshot ?? analyzeLiveVoiceSnapshot;
      const snapshot = await analyze({
        conversationId: args.conversationId,
        fetchImpl: args.fetchImpl,
      });

      if (
        (snapshot.status === "unavailable" || snapshot.status === "error") &&
        priorBiomarkers?.status === "ready"
      ) {
        updateLiveSession(args.conversationId, {
          error: snapshot.error,
        });
      } else {
        updateLiveSession(args.conversationId, {
          biomarkers: snapshot,
          ...(snapshot.status !== "ready" && snapshot.error
            ? { error: snapshot.error }
            : {}),
        });
      }
    }

    const current = getLiveSession(args.conversationId);
    if (current?.status === "finalizing") {
      const finalize = args.finalizeSession ?? finalizeLiveSession;
      return finalize({
        conversationId: args.conversationId,
        fetchImpl: args.fetchImpl,
        analyzeSnapshot: args.analyzeSnapshot,
      });
    }

    return getLiveSession(args.conversationId);
  } finally {
    endTick(args.conversationId, nowIso);
  }
}
