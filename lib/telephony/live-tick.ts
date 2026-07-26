import { analyzeLiveVoiceSnapshot } from "@/lib/amplifier/analyze-live-snapshot";
import { fetchConversationDetails } from "./elevenlabs-conversation";
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

    const priorBiomarkers = session.biomarkers;

    const conversation = await fetchConversationDetails({
      conversationId: args.conversationId,
      fetchImpl: args.fetchImpl,
    });

    let skipSnapshot = false;

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

    return getLiveSession(args.conversationId);
  } finally {
    endTick(args.conversationId, nowIso);
  }
}
