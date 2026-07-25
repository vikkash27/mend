import { composeDecision } from "../clinical/compose";
import { evaluate } from "../clinical/red-flag-engine";
import type {
  Decision,
  EcgReading,
  Symptoms,
  VitalsReading,
} from "../clinical/types";
import { fetchConversationAudio } from "../telephony/elevenlabs-recording";
import { pollJob, submitAnalyze } from "./client";
import { mapAmplifierResults } from "./map-to-engine";
import type { VoiceBiomarkersRecord } from "./types";

function firedRulesDiffer(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return true;
  return a.some((id, i) => id !== b[i]);
}

function decisionsDiffer(a: Decision, b: Decision): boolean {
  return a.level !== b.level || firedRulesDiffer(a.firedRules, b.firedRules);
}

function failOpen(args: {
  conversationId: string;
  priorDecision: Decision;
  status: "unavailable" | "error";
  error: string;
  jobIds?: string[];
}): {
  record: VoiceBiomarkersRecord;
  decision: Decision;
  decisionChanged: false;
} {
  return {
    record: {
      status: args.status,
      conversationId: args.conversationId,
      error: args.error,
      ...(args.jobIds ? { jobIds: args.jobIds } : {}),
    },
    decision: args.priorDecision,
    decisionChanged: false,
  };
}

/**
 * Post-call Amplifier orchestration: fetch conversation audio → analyze both
 * domains → map → re-evaluate. Fail-open: audio/credentials/job failures keep
 * `priorDecision` and never invent escalation.
 */
export async function analyzeCheckinVoiceBiomarkers(args: {
  conversationId: string;
  dayPostOp: number;
  symptoms: Symptoms;
  vitals: VitalsReading;
  ecg?: EcgReading;
  priorDecision: Decision;
  fetchImpl?: typeof fetch;
}): Promise<{
  record: VoiceBiomarkersRecord;
  decision: Decision;
  decisionChanged: boolean;
}> {
  const fetchImpl = args.fetchImpl;

  const audio = await fetchConversationAudio({
    conversationId: args.conversationId,
    fetchImpl,
  });

  if (audio.status !== "ok") {
    return failOpen({
      conversationId: args.conversationId,
      priorDecision: args.priorDecision,
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
      priorDecision: args.priorDecision,
      status: "error",
      error: respiratorySubmit.reason,
    });
  }
  if (cognitiveSubmit.status !== "ok") {
    return failOpen({
      conversationId: args.conversationId,
      priorDecision: args.priorDecision,
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
      priorDecision: args.priorDecision,
      status: "error",
      error: respiratoryPoll.reason,
      jobIds,
    });
  }
  if (cognitivePoll.status !== "done") {
    return failOpen({
      conversationId: args.conversationId,
      priorDecision: args.priorDecision,
      status: "error",
      error: cognitivePoll.reason,
      jobIds,
    });
  }

  const mapped = mapAmplifierResults({
    respiratory: respiratoryPoll.result,
    cognitive: cognitivePoll.result,
  });

  const evaluated = evaluate({
    dayPostOp: args.dayPostOp,
    symptoms: args.symptoms,
    vitals: args.vitals,
    ecg: args.ecg,
    voiceBiomarkers: mapped,
  });

  // Caller supplies no trends here; compose with empty list (no-op unless green+findings).
  const decision = composeDecision(evaluated, []);
  const decisionChanged = decisionsDiffer(decision, args.priorDecision);

  const record: VoiceBiomarkersRecord = {
    status: "ready",
    conversationId: args.conversationId,
    jobIds,
    analyzedAt: new Date().toISOString(),
    raw: {
      respiratory: respiratoryPoll.result,
      cognitive: cognitivePoll.result,
    },
    mapped,
  };

  return { record, decision, decisionChanged };
}
