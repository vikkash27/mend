import { describe, expect, it } from "vitest";
import { getPhase } from "./recovery-graph";
import { evaluateTrends } from "./trends";
import type { Symptoms, VitalsReading } from "./types";

const phase = getPhase(5); // Early protected: hrMax 100, spo2Min 94, tempCMax 38.0

function isoDay(day: number, hour = 8): string {
  const base = Date.UTC(2026, 6, 1, hour, 0, 0);
  return new Date(base + day * 24 * 60 * 60 * 1000).toISOString();
}

function reading(day: number, partial: Partial<VitalsReading> = {}): VitalsReading {
  return {
    timestamp: isoDay(day),
    source: "manual",
    quality: "ok",
    ...partial,
  };
}

function noSymptoms(): Symptoms {
  return {};
}

describe("evaluateTrends — brief cases", () => {
  it("HR 72->76->81->86 over four days, all inside envelope -> one amber hr finding", () => {
    const history = [
      reading(0, { hr: 72 }),
      reading(1, { hr: 76 }),
      reading(2, { hr: 81 }),
      reading(3, { hr: 86 }),
    ];
    // Sanity: never breaches the phase envelope on its own.
    for (const r of history) {
      expect(r.hr!).toBeLessThan(phase.normalEnvelope.hrMax);
    }

    const findings = evaluateTrends(history, history.map(noSymptoms), phase);

    expect(findings).toHaveLength(1);
    expect(findings[0].metric).toBe("hr");
    expect(findings[0].severity).toBe("amber");
    expect(findings[0].id).toMatch(/^trend\.[a-z_]+\.[a-z_]+$/);
    expect(findings[0].description).toContain("72");
    expect(findings[0].description).toContain("86");
  });

  it("SpO2 97->96->95->94, never below spo2Min -> one amber spo2 finding", () => {
    const history = [
      reading(0, { spo2: 97 }),
      reading(1, { spo2: 96 }),
      reading(2, { spo2: 95 }),
      reading(3, { spo2: 94 }),
    ];
    for (const r of history) {
      expect(r.spo2!).toBeGreaterThanOrEqual(phase.normalEnvelope.spo2Min);
    }

    const findings = evaluateTrends(history, history.map(noSymptoms), phase);

    expect(findings).toHaveLength(1);
    expect(findings[0].metric).toBe("spo2");
    expect(findings[0].severity).toBe("amber");
    expect(findings[0].description).toContain("97");
    expect(findings[0].description).toContain("94");
  });

  it("Pain score 3->5->7 while phase expects improvement -> one amber painScore finding", () => {
    const history = [reading(0), reading(1), reading(2)];
    const symptoms: Symptoms[] = [{ painScore: 3 }, { painScore: 5 }, { painScore: 7 }];

    const findings = evaluateTrends(history, symptoms, phase);

    expect(findings).toHaveLength(1);
    expect(findings[0].metric).toBe("painScore");
    expect(findings[0].severity).toBe("amber");
    expect(findings[0].description).toContain("3");
    expect(findings[0].description).toContain("7");
  });

  it("flat, normal series -> empty array", () => {
    const history = [
      reading(0, { hr: 75, spo2: 97, tempC: 36.8 }),
      reading(1, { hr: 75, spo2: 97, tempC: 36.8 }),
      reading(2, { hr: 75, spo2: 97, tempC: 36.8 }),
      reading(3, { hr: 75, spo2: 97, tempC: 36.8 }),
      reading(4, { hr: 75, spo2: 97, tempC: 36.8 }),
    ];
    const symptoms: Symptoms[] = history.map(() => ({ painScore: 2 }));

    const findings = evaluateTrends(history, symptoms, phase);

    expect(findings).toEqual([]);
  });

  it("fewer than 3 readings -> empty array (never guess from insufficient data)", () => {
    const history = [reading(0, { hr: 72 }), reading(1, { hr: 95 })];

    const findings = evaluateTrends(history, history.map(noSymptoms), phase);

    expect(findings).toEqual([]);
  });
});

describe("evaluateTrends — never returns a Decision, findings only", () => {
  it("returned objects are plain TrendFinding shapes, no level/action/call fields", () => {
    const history = [
      reading(0, { hr: 72 }),
      reading(1, { hr: 76 }),
      reading(2, { hr: 81 }),
      reading(3, { hr: 86 }),
    ];
    const findings = evaluateTrends(history, history.map(noSymptoms), phase);

    for (const f of findings) {
      expect(f).not.toHaveProperty("level");
      expect(f).not.toHaveProperty("action");
      expect(f).not.toHaveProperty("call");
      expect(f).not.toHaveProperty("firedRules");
    }
  });
});

describe("evaluateTrends — regresses on actual elapsed time, not array index", () => {
  it("widely irregular final gap dilutes a large index-adjacent jump below threshold", () => {
    // hr: 70, 72, 74, 100 at days 0, 1, 2, 30.
    // Naive (last-first)/(steps) = (100-70)/3 = 10 bpm/"step" -> would wrongly fire amber.
    // Real OLS slope against elapsed days is ~0.97 bpm/day -> must NOT fire.
    const history = [
      reading(0, { hr: 70 }),
      reading(1, { hr: 72 }),
      reading(2, { hr: 74 }),
      reading(30, { hr: 100 }),
    ];

    const findings = evaluateTrends(history, history.map(noSymptoms), phase);

    expect(findings.filter((f) => f.metric === "hr")).toHaveLength(0);
  });

  it("irregular spacing that IS a real fast rise per day still fires", () => {
    // hr: 70, 74, 78, 90 at days 0, 1, 2, 6. Real OLS slope ~3.29 bpm/day -> fires.
    const history = [
      reading(0, { hr: 70 }),
      reading(1, { hr: 74 }),
      reading(2, { hr: 78 }),
      reading(6, { hr: 90 }),
    ];

    const findings = evaluateTrends(history, history.map(noSymptoms), phase);

    const hrFinding = findings.find((f) => f.metric === "hr");
    expect(hrFinding).toBeDefined();
    expect(hrFinding!.severity).toBe("amber");
  });
});

describe("evaluateTrends — missing metric values are skipped, not treated as zero", () => {
  it("a metric present in fewer than 3 readings produces no finding for that metric", () => {
    const history = [
      reading(0, { hr: 75, spo2: 97 }),
      reading(1, { hr: 78 }), // spo2 absent here
      reading(2, { hr: 81 }), // spo2 absent here
      reading(3, { hr: 84 }), // spo2 absent here
      reading(4, { hr: 87, spo2: 96 }),
    ];

    const findings = evaluateTrends(history, history.map(noSymptoms), phase);

    // hr has 5 usable points and a clear rise -> should fire.
    expect(findings.some((f) => f.metric === "hr")).toBe(true);
    // spo2 only has 2 usable points -> must never appear, regardless of direction.
    expect(findings.some((f) => f.metric === "spo2")).toBe(false);
  });

  it("does not fabricate a decline from missing spo2 readings treated as zero", () => {
    const history = [
      reading(0, { spo2: 97 }),
      reading(1), // absent
      reading(2, { spo2: 96 }),
      reading(3), // absent
      reading(4, { spo2: 95 }),
    ];

    const findings = evaluateTrends(history, history.map(noSymptoms), phase);

    // Only 3 usable spo2 points with a gentle -0.5/day slope: below the -1 threshold.
    expect(findings.some((f) => f.metric === "spo2")).toBe(false);
  });
});

describe("evaluateTrends — window bounds", () => {
  it("uses at most the trailing 7 readings", () => {
    // 3 older days at hr 60, then a 7-day climb from 75 to 99 that should be the
    // entire window once the trailing-7 cap is applied.
    const olderDays = [0, 1, 2].map((d) => reading(d, { hr: 60 }));
    const climbDays = [3, 4, 5, 6, 7, 8, 9].map((d, i) =>
      reading(d, { hr: 75 + i * 4 }),
    );
    const history = [...olderDays, ...climbDays];

    const findings = evaluateTrends(history, history.map(noSymptoms), phase);

    const hrFinding = findings.find((f) => f.metric === "hr");
    expect(hrFinding).toBeDefined();
    expect(hrFinding!.description).toContain("75");
    expect(hrFinding!.description).toContain("99");
    // If the older days had leaked into the window, 60 would show up as the start value.
    expect(hrFinding!.description).not.toContain("60");
  });
});

describe("evaluateTrends — temperature", () => {
  it("a sustained low-grade temperature rise inside the envelope fires amber", () => {
    const history = [
      reading(0, { tempC: 36.8 }),
      reading(1, { tempC: 37.0 }),
      reading(2, { tempC: 37.2 }),
      reading(3, { tempC: 37.4 }),
    ];
    for (const r of history) {
      expect(r.tempC!).toBeLessThan(phase.normalEnvelope.tempCMax);
    }

    const findings = evaluateTrends(history, history.map(noSymptoms), phase);

    const tempFinding = findings.find((f) => f.metric === "tempC");
    expect(tempFinding).toBeDefined();
    expect(tempFinding!.severity).toBe("amber");
  });

  it("a trivial temperature wobble does not fire", () => {
    const history = [
      reading(0, { tempC: 36.8 }),
      reading(1, { tempC: 36.85 }),
      reading(2, { tempC: 36.8 }),
      reading(3, { tempC: 36.9 }),
    ];

    const findings = evaluateTrends(history, history.map(noSymptoms), phase);

    expect(findings.some((f) => f.metric === "tempC")).toBe(false);
  });
});
