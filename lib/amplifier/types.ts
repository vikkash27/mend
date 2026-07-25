export type AmplifierDomain = "respiratory" | "cognitive";

export type AmplifierCredentials = {
  apiKey: string;
  accountId: string;
};

export type SubmitAnalyzeResult =
  | { status: "ok"; jobId: string }
  | { status: "error"; reason: string };

export type PollJobResult =
  | { status: "done"; result: unknown }
  | { status: "error"; reason: string }
  | { status: "timeout"; reason: string };

export type VoiceSignalLevel = "low" | "moderate" | "high" | "unknown";

export interface VoiceDomainSignal {
  level: VoiceSignalLevel;
  score?: number;
  label?: string;
}

export interface VoiceBiomarkers {
  quality: "ok" | "insufficient" | "error";
  respiratory: VoiceDomainSignal;
  cognitive: VoiceDomainSignal;
  overallLevel?: string;
  recommendedAction?: string;
  source: "amplifier";
}
