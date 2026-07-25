import type {
  VoiceBiomarkers,
  VoiceDomainSignal,
  VoiceSignalLevel,
} from "./types";

export type { VoiceBiomarkers, VoiceDomainSignal, VoiceSignalLevel } from "./types";

const KNOWN_LEVELS = new Set<VoiceSignalLevel>(["low", "moderate", "high"]);

const LEVEL_RANK: Record<VoiceSignalLevel, number> = {
  unknown: 0,
  low: 1,
  moderate: 2,
  high: 3,
};

type RawSignal = {
  level?: unknown;
  score?: unknown;
  label?: unknown;
};

type ParsedDomain = {
  usable: boolean;
  signal: VoiceDomainSignal;
  overallLevel?: string;
  recommendedAction?: string;
  insufficientSpeech: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeLevel(raw: unknown): VoiceSignalLevel {
  if (typeof raw !== "string") return "unknown";
  const level = raw.trim().toLowerCase();
  if (KNOWN_LEVELS.has(level as VoiceSignalLevel)) {
    return level as VoiceSignalLevel;
  }
  return "unknown";
}

function extractResult(input: unknown): Record<string, unknown> | null {
  if (!isRecord(input)) return null;
  if (isRecord(input.result)) return input.result;
  if ("signals" in input || "summary" in input || "audio_quality" in input) {
    return input;
  }
  return null;
}

function pickWorstSignal(signals: RawSignal[]): RawSignal | undefined {
  let best: RawSignal | undefined;
  let bestRank = -1;
  for (const signal of signals) {
    const rank = LEVEL_RANK[normalizeLevel(signal.level)];
    if (rank > bestRank) {
      best = signal;
      bestRank = rank;
    }
  }
  return best;
}

function parseDomain(input: unknown): ParsedDomain {
  const result = extractResult(input);
  if (!result) {
    return {
      usable: false,
      signal: { level: "unknown" },
      insufficientSpeech: false,
    };
  }

  const summary = isRecord(result.summary) ? result.summary : {};
  const audioQuality = isRecord(result.audio_quality) ? result.audio_quality : {};
  const issues = Array.isArray(audioQuality.issues) ? audioQuality.issues : [];
  const insufficientSpeech = issues.some(
    (issue) => typeof issue === "string" && issue === "insufficient_speech",
  );

  const signals = Array.isArray(result.signals)
    ? (result.signals.filter(isRecord) as RawSignal[])
    : [];
  const worst = pickWorstSignal(signals);

  const summaryLevel =
    typeof summary.overall_level === "string"
      ? normalizeLevel(summary.overall_level)
      : undefined;
  const signalLevel = worst ? normalizeLevel(worst.level) : "unknown";
  const level =
    summaryLevel && summaryLevel !== "unknown"
      ? summaryLevel
      : signalLevel !== "unknown"
        ? signalLevel
        : summaryLevel ?? "unknown";

  const signal: VoiceDomainSignal = { level };
  if (typeof worst?.score === "number" && Number.isFinite(worst.score)) {
    signal.score = worst.score;
  }
  if (typeof worst?.label === "string" && worst.label.length > 0) {
    signal.label = worst.label;
  } else if (signals[0] && typeof signals[0].label === "string") {
    signal.label = signals[0].label;
  }

  return {
    usable: true,
    signal,
    overallLevel:
      typeof summary.overall_level === "string"
        ? summary.overall_level
        : undefined,
    recommendedAction:
      typeof summary.recommended_action === "string"
        ? summary.recommended_action
        : undefined,
    insufficientSpeech,
  };
}

function displayOverall(domain: ParsedDomain): string | undefined {
  if (domain.signal.level !== "unknown") return domain.signal.level;
  if (domain.overallLevel !== undefined) {
    return domain.overallLevel.trim().toLowerCase();
  }
  return undefined;
}

function worseOverall(
  a: ParsedDomain,
  b: ParsedDomain,
): { overallLevel?: string; recommendedAction?: string } {
  const aRank = LEVEL_RANK[a.signal.level];
  const bRank = LEVEL_RANK[b.signal.level];
  if (bRank > aRank) {
    return {
      overallLevel: displayOverall(b),
      recommendedAction: b.recommendedAction,
    };
  }
  if (aRank > bRank) {
    return {
      overallLevel: displayOverall(a),
      recommendedAction: a.recommendedAction,
    };
  }
  return {
    overallLevel: displayOverall(a) ?? displayOverall(b),
    recommendedAction: a.recommendedAction ?? b.recommendedAction,
  };
}

function resolveQuality(
  respiratory: ParsedDomain,
  cognitive: ParsedDomain,
): VoiceBiomarkers["quality"] {
  if (!respiratory.usable && !cognitive.usable) return "error";
  if (
    respiratory.insufficientSpeech ||
    cognitive.insufficientSpeech ||
    (respiratory.signal.level === "unknown" &&
      cognitive.signal.level === "unknown")
  ) {
    return "insufficient";
  }
  return "ok";
}

export function mapAmplifierResults(args: {
  respiratory: unknown;
  cognitive: unknown;
}): VoiceBiomarkers {
  const respiratory = parseDomain(args.respiratory);
  const cognitive = parseDomain(args.cognitive);
  const aggregate = worseOverall(respiratory, cognitive);

  const mapped: VoiceBiomarkers = {
    quality: resolveQuality(respiratory, cognitive),
    respiratory: respiratory.signal,
    cognitive: cognitive.signal,
    source: "amplifier",
  };

  if (aggregate.overallLevel !== undefined) {
    mapped.overallLevel = aggregate.overallLevel;
  }
  if (aggregate.recommendedAction !== undefined) {
    mapped.recommendedAction = aggregate.recommendedAction;
  }

  return mapped;
}
