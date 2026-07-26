import { fetchConversationAudio } from "../telephony/elevenlabs-recording";
import { pollJob, submitAnalyze } from "./client";
import { mapAmplifierResults } from "./map-to-engine";
import type { VoiceBiomarkersRecord } from "./types";

function failOpen(args: {
  conversationId: string;
  status: "unavailable" | "error";
  error: string;
  jobIds?: string[];
}): VoiceBiomarkersRecord {
  return {
    status: args.status,
    conversationId: args.conversationId,
    error: args.error,
    phase: "during",
    ...(args.jobIds ? { jobIds: args.jobIds } : {}),
  };
}

/**
 * During-call Amplifier orchestration: fetch conversation audio → analyze both
 * domains → map. Does not evaluate or mutate clinical decisions.
 */
export async function analyzeLiveVoiceSnapshot(args: {
  conversationId: string;
  fetchImpl?: typeof fetch;
}): Promise<VoiceBiomarkersRecord> {
  const fetchImpl = args.fetchImpl;

  const audio = await fetchConversationAudio({
    conversationId: args.conversationId,
    fetchImpl,
  });

  if (audio.status !== "ok") {
    return failOpen({
      conversationId: args.conversationId,
      status: "unavailable",
      error: audio.reason,
    });
  }

  const [respiratorySubmit, cognitiveSubmit] = await Promise.all([
    submitAnalyze({
      domain: "respiratory",
      audio: audio.bytes,
      contentType: audio.contentType,
      fetchImpl,
    }),
    submitAnalyze({
      domain: "cognitive",
      audio: audio.bytes,
      contentType: audio.contentType,
      fetchImpl,
    }),
  ]);

  if (respiratorySubmit.status !== "ok") {
    return failOpen({
      conversationId: args.conversationId,
      status: "error",
      error: respiratorySubmit.reason,
    });
  }
  if (cognitiveSubmit.status !== "ok") {
    return failOpen({
      conversationId: args.conversationId,
      status: "error",
      error: cognitiveSubmit.reason,
      jobIds: [respiratorySubmit.jobId],
    });
  }

  const jobIds = [respiratorySubmit.jobId, cognitiveSubmit.jobId];

  const [respiratoryPoll, cognitivePoll] = await Promise.all([
    pollJob({ jobId: respiratorySubmit.jobId, fetchImpl }),
    pollJob({ jobId: cognitiveSubmit.jobId, fetchImpl }),
  ]);

  if (respiratoryPoll.status !== "done") {
    return failOpen({
      conversationId: args.conversationId,
      status: "error",
      error: respiratoryPoll.reason,
      jobIds,
    });
  }
  if (cognitivePoll.status !== "done") {
    return failOpen({
      conversationId: args.conversationId,
      status: "error",
      error: cognitivePoll.reason,
      jobIds,
    });
  }

  const mapped = mapAmplifierResults({
    respiratory: respiratoryPoll.result,
    cognitive: cognitivePoll.result,
  });

  return {
    status: "ready",
    conversationId: args.conversationId,
    jobIds,
    analyzedAt: new Date().toISOString(),
    phase: "during",
    raw: {
      respiratory: respiratoryPoll.result,
      cognitive: cognitivePoll.result,
    },
    mapped,
  };
}
