import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mapAmplifierResults } from "./map-to-engine";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));
}

function jobWithSignals(opts: {
  overall_level?: string;
  recommended_action?: string;
  signals: Array<{
    level: string;
    score?: number;
    label?: string;
    flagged?: boolean;
    model_id?: string;
  }>;
  issues?: string[];
}): unknown {
  return {
    status: "done",
    result: {
      audio_quality: {
        voice_percentage: 80,
        issues: opts.issues ?? [],
        audio_clarity: 4,
      },
      signals: opts.signals,
      summary: {
        overall_level: opts.overall_level,
        recommended_action: opts.recommended_action,
      },
    },
  };
}

describe("mapAmplifierResults", () => {
  it("maps spike fixtures to unknown levels and insufficient quality", () => {
    const respiratory = loadFixture("sample-job-done.json");
    const cognitive = loadFixture("sample-cognitive-done.json");

    const mapped = mapAmplifierResults({ respiratory, cognitive });

    expect(mapped.source).toBe("amplifier");
    expect(mapped.respiratory.level).toBe("unknown");
    expect(mapped.cognitive.level).toBe("unknown");
    expect(mapped.quality).toBe("insufficient");
    expect(mapped.overallLevel).toBe("inconclusive");
    expect(mapped.recommendedAction).toBe("inconclusive");
    expect(mapped.respiratory.label).toBe("COPD");
    expect(mapped.cognitive.label).toBe("Cognitive Impairment");
  });

  it("accepts bare result objects (not only full job wrappers)", () => {
    const respiratoryJob = loadFixture("sample-job-done.json") as {
      result: unknown;
    };
    const cognitiveJob = loadFixture("sample-cognitive-done.json") as {
      result: unknown;
    };

    const mapped = mapAmplifierResults({
      respiratory: respiratoryJob.result,
      cognitive: cognitiveJob.result,
    });

    expect(mapped.respiratory.level).toBe("unknown");
    expect(mapped.cognitive.level).toBe("unknown");
    expect(mapped.quality).toBe("insufficient");
  });

  it("normalizes high/moderate/low case-insensitively and sets quality ok", () => {
    const mapped = mapAmplifierResults({
      respiratory: jobWithSignals({
        overall_level: "HIGH",
        recommended_action: "follow_up",
        signals: [{ level: "HIGH", score: 0.9, label: "COPD" }],
      }),
      cognitive: jobWithSignals({
        overall_level: "Low",
        recommended_action: "monitor",
        signals: [{ level: "Low", score: 0.2, label: "Cognitive Impairment" }],
      }),
    });

    expect(mapped.respiratory).toMatchObject({
      level: "high",
      score: 0.9,
      label: "COPD",
    });
    expect(mapped.cognitive).toMatchObject({
      level: "low",
      score: 0.2,
      label: "Cognitive Impairment",
    });
    expect(mapped.quality).toBe("ok");
    expect(mapped.overallLevel).toBe("high");
    expect(mapped.recommendedAction).toBe("follow_up");
  });

  it("maps moderate respiratory with unknown cognitive to quality ok", () => {
    const mapped = mapAmplifierResults({
      respiratory: jobWithSignals({
        overall_level: "moderate",
        signals: [{ level: "moderate", score: 0.55, label: "Allergy" }],
      }),
      cognitive: jobWithSignals({
        overall_level: "inconclusive",
        signals: [{ level: "inconclusive", score: 0, label: "Cognitive Impairment" }],
      }),
    });

    expect(mapped.respiratory.level).toBe("moderate");
    expect(mapped.cognitive.level).toBe("unknown");
    expect(mapped.quality).toBe("ok");
  });

  it("sets quality insufficient when audio_quality.issues includes insufficient_speech", () => {
    const mapped = mapAmplifierResults({
      respiratory: jobWithSignals({
        overall_level: "high",
        signals: [{ level: "high", score: 0.8, label: "COPD" }],
        issues: ["insufficient_speech"],
      }),
      cognitive: jobWithSignals({
        overall_level: "low",
        signals: [{ level: "low", score: 0.1, label: "Cognitive Impairment" }],
      }),
    });

    expect(mapped.respiratory.level).toBe("high");
    expect(mapped.cognitive.level).toBe("low");
    expect(mapped.quality).toBe("insufficient");
  });

  it("maps missing or unusable inputs to unknown levels and quality error", () => {
    const mapped = mapAmplifierResults({
      respiratory: null,
      cognitive: "not-a-job",
    });

    expect(mapped.source).toBe("amplifier");
    expect(mapped.respiratory.level).toBe("unknown");
    expect(mapped.cognitive.level).toBe("unknown");
    expect(mapped.quality).toBe("error");
  });

  it("picks the highest severity signal when summary overall_level is absent", () => {
    const mapped = mapAmplifierResults({
      respiratory: {
        result: {
          audio_quality: { issues: [] },
          signals: [
            { level: "low", score: 0.2, label: "Allergy" },
            { level: "high", score: 0.88, label: "COPD" },
          ],
          summary: {},
        },
      },
      cognitive: {
        result: {
          audio_quality: { issues: [] },
          signals: [{ level: "moderate", score: 0.5, label: "Cognitive Impairment" }],
          summary: {},
        },
      },
    });

    expect(mapped.respiratory).toMatchObject({
      level: "high",
      score: 0.88,
      label: "COPD",
    });
    expect(mapped.cognitive.level).toBe("moderate");
    expect(mapped.quality).toBe("ok");
  });
});
