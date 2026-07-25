import { describe, expect, it } from "vitest";
import { getPhase } from "./recovery-graph";
import { evaluate } from "./red-flag-engine";
import type { EcgReading, Symptoms, VitalsReading } from "./types";

const noSymptoms: Symptoms = {};

function vitals(partial: Partial<VitalsReading> = {}): VitalsReading {
  return {
    timestamp: "2026-07-25T12:00:00.000Z",
    source: "manual",
    quality: "ok",
    ...partial,
  };
}

function ecg(partial: Partial<EcgReading> = {}): EcgReading {
  return {
    recordedAt: "2026-07-25T12:00:00.000Z",
    determination: "normal_sinus_rhythm",
    source: "kardia_6l",
    ...partial,
  };
}

describe("evaluate — vignette table (binding, from task-4-brief.md)", () => {
  it("1: day5, painControlled true, unremarkable vitals -> green", () => {
    const d = evaluate({
      dayPostOp: 5,
      symptoms: { painControlled: true },
      vitals: vitals({ hr: 78, tempC: 37.1, sbp: 128, spo2: 97 }),
    });
    expect(d.level).toBe("green");
    expect(d.condition).toBeUndefined();
  });

  it("2: day2, no symptoms, hr92/tempC37.8 within early envelope -> green", () => {
    const d = evaluate({
      dayPostOp: 2,
      symptoms: noSymptoms,
      vitals: vitals({ hr: 92, tempC: 37.8 }),
    });
    expect(d.level).toBe("green");
  });

  it("3: day21, no symptoms, tempC37.8/hr84 -> amber Possible wound infection", () => {
    const d = evaluate({
      dayPostOp: 21,
      symptoms: noSymptoms,
      vitals: vitals({ tempC: 37.8, hr: 84 }),
    });
    expect(d.level).toBe("amber");
    expect(d.condition).toBe("Possible wound infection");
  });

  it("4: day4, breathless, hr122/spo2 91 -> red Suspected pulmonary embolism", () => {
    const d = evaluate({
      dayPostOp: 4,
      symptoms: { breathless: true },
      vitals: vitals({ hr: 122, spo2: 91 }),
    });
    expect(d.level).toBe("red");
    expect(d.condition).toBe("Suspected pulmonary embolism");
  });

  it("5: day4, breathless, hr122, ECG tachycardia -> red Suspected pulmonary embolism", () => {
    const d = evaluate({
      dayPostOp: 4,
      symptoms: { breathless: true },
      vitals: vitals({ hr: 122 }),
      ecg: ecg({ determination: "tachycardia" }),
    });
    expect(d.level).toBe("red");
    expect(d.condition).toBe("Suspected pulmonary embolism");
    // hr 122 already exceeds day-4's tachycardia threshold (110) on its own,
    // so the vitals-tachycardia rule fires before the ECG-only rule is ever
    // reached. This is documented, correct behaviour (rule array order), but
    // it means this vignette does NOT exercise
    // `pe.breathless_with_ecg_tachycardia` — see the next test for that.
    expect(d.firedRules).toEqual(["pe.breathless_with_tachycardia"]);
  });

  it("5b: day4, breathless, non-tachycardic hr90 (not ECG-derived), ECG tachycardia -> red PE via the ECG-only rule", () => {
    // Unlike vignette 5, hr 90 does NOT exceed day-4's tachycardia threshold
    // (110), so `pe.breathless_with_tachycardia` cannot fire here. This is
    // the case that genuinely exercises `pe.breathless_with_ecg_tachycardia`.
    const d = evaluate({
      dayPostOp: 4,
      symptoms: { breathless: true },
      vitals: vitals({ hr: 90 }),
      ecg: ecg({ determination: "tachycardia" }),
    });
    expect(d.level).toBe("red");
    expect(d.condition).toBe("Suspected pulmonary embolism");
    expect(d.firedRules).toEqual(["pe.breathless_with_ecg_tachycardia"]);
  });

  it("6: day4, no symptoms, spo2 88/hr96 -> red Hypoxia", () => {
    const d = evaluate({
      dayPostOp: 4,
      symptoms: noSymptoms,
      vitals: vitals({ spo2: 88, hr: 96 }),
    });
    expect(d.level).toBe("red");
    expect(d.condition).toBe("Hypoxia");
  });

  it("7: day1, no symptoms, sbp84/hr118 -> red Suspected shock / bleeding", () => {
    const d = evaluate({
      dayPostOp: 1,
      symptoms: noSymptoms,
      vitals: vitals({ sbp: 84, hr: 118 }),
    });
    expect(d.level).toBe("red");
    expect(d.condition).toBe("Suspected shock / bleeding");
  });

  it("8: day10, hip triad symptoms, hr96 -> red Suspected hip dislocation", () => {
    const d = evaluate({
      dayPostOp: 10,
      symptoms: {
        suddenSevereHipPain: true,
        legShortenedOrRotated: true,
        unableToWeightBear: true,
      },
      vitals: vitals({ hr: 96 }),
    });
    expect(d.level).toBe("red");
    expect(d.condition).toBe("Suspected hip dislocation");
  });

  it("9: day6, woundDischarge, tempC38.9/hr124 -> red Possible sepsis", () => {
    const d = evaluate({
      dayPostOp: 6,
      symptoms: { woundDischarge: true },
      vitals: vitals({ tempC: 38.9, hr: 124 }),
    });
    expect(d.level).toBe("red");
    expect(d.condition).toBe("Possible sepsis");
  });

  it("10: day8, calfPainOrSwelling, hr88/tempC37.0 -> amber Possible DVT", () => {
    const d = evaluate({
      dayPostOp: 8,
      symptoms: { calfPainOrSwelling: true },
      vitals: vitals({ hr: 88, tempC: 37.0 }),
    });
    expect(d.level).toBe("amber");
    expect(d.condition).toBe("Possible DVT");
  });

  it("11: day3, painControlled false, hr96 -> amber Uncontrolled pain", () => {
    const d = evaluate({
      dayPostOp: 3,
      symptoms: { painControlled: false },
      vitals: vitals({ hr: 96 }),
    });
    expect(d.level).toBe("amber");
    expect(d.condition).toBe("Uncontrolled pain");
  });

  it("12: day4, breathless, vitals quality poor / no values -> red PE (fail-safe)", () => {
    const d = evaluate({
      dayPostOp: 4,
      symptoms: { breathless: true },
      vitals: vitals({ quality: "poor" }),
    });
    expect(d.level).toBe("red");
    expect(d.condition).toBe("Suspected pulmonary embolism");
  });

  it("13: day7, no symptoms, ECG atrial_fibrillation/hr88 -> amber New atrial fibrillation", () => {
    const d = evaluate({
      dayPostOp: 7,
      symptoms: noSymptoms,
      vitals: vitals({ hr: 88 }),
      ecg: ecg({ determination: "atrial_fibrillation" }),
    });
    expect(d.level).toBe("amber");
    expect(d.condition).toBe("New atrial fibrillation");
  });

  it("14: day5, newConfusion, hr90 -> amber New confusion", () => {
    const d = evaluate({
      dayPostOp: 5,
      symptoms: { newConfusion: true },
      vitals: vitals({ hr: 90 }),
    });
    expect(d.level).toBe("amber");
    expect(d.condition).toBe("New confusion");
  });

  it("15: day5, painControlled true, hr78/spo2 97 -> green with EMPTY firedRules", () => {
    const d = evaluate({
      dayPostOp: 5,
      symptoms: { painControlled: true },
      vitals: vitals({ hr: 78, spo2: 97 }),
    });
    expect(d.level).toBe("green");
    expect(d.firedRules).toEqual([]);
  });
});

describe("evaluate — additional safety-edge cases beyond the mandated table", () => {
  // Every physiologic field absent (device produced no reading at all) with no
  // reported symptoms. The vitals are technically "quality: ok" but carry zero
  // usable data. Constraint #3 says the engine must fall back to symptom-only
  // rules and must NEVER return green on the basis of a reading it could not
  // trust — but with no symptoms at all, there is also no symptom-only red rule
  // to fall back on. A silent green here would be exactly the kind of false
  // reassurance the fail-safe design forbids, so we assert a non-green (amber)
  // catch-all fires instead, and that it is recorded as a fired rule.
  it("every vitals field absent + no symptoms -> never green (amber fail-safe)", () => {
    const d = evaluate({
      dayPostOp: 5,
      symptoms: noSymptoms,
      vitals: vitals(),
    });
    expect(d.level).not.toBe("green");
    expect(d.level).toBe("amber");
    expect(d.firedRules.length).toBeGreaterThan(0);
  });

  // A red-eligible condition (breathless + tachycardia -> PE) and an
  // amber-eligible condition (calf pain/swelling -> DVT) are simultaneously
  // satisfiable from the same input. Constraint #7 requires all RED rules to
  // be evaluated before any AMBER rule, so red must win outright and the
  // amber DVT rule must never appear in firedRules.
  it("red and amber both satisfiable at once -> red wins outright", () => {
    const d = evaluate({
      dayPostOp: 4,
      symptoms: { breathless: true, calfPainOrSwelling: true },
      vitals: vitals({ hr: 122, spo2: 97 }),
    });
    expect(d.level).toBe("red");
    expect(d.condition).toBe("Suspected pulmonary embolism");
    expect(d.firedRules).toEqual(["pe.breathless_with_tachycardia"]);
  });

  // An ECG determination of "unclassified" must be treated as ABSENT
  // (constraint #6) — it must not be mistaken for atrial_fibrillation or
  // tachycardia, and must not itself trigger any rule.
  it("ECG unclassified is treated as absent, not acted upon", () => {
    const d = evaluate({
      dayPostOp: 5,
      symptoms: noSymptoms,
      vitals: vitals({ hr: 78, spo2: 97 }),
      ecg: ecg({ determination: "unclassified" }),
    });
    expect(d.level).toBe("green");
    expect(d.firedRules).toEqual([]);
  });
});

describe("evaluate — rationale threshold values are the single source of truth (no duplicated offsets)", () => {
  // The tachycardia threshold (phase.normalEnvelope.hrMax + 10) is computed
  // once in buildContext and must stay consistent with the rationale text.
  // The boundary assertions below prove the decision logic uses it; the
  // rationale assertions prove the prose describes the same arithmetic.
  //
  // The rationale deliberately cites the envelope maximum plus the margin
  // rather than the summed threshold: "expected maximum" means the phase
  // envelope bound everywhere else in the codebase (trends.ts, the vitals
  // tiles), so applying that phrase to hrMax + 10 made two surfaces state
  // different numbers for the same clinical concept.
  it("tachycardia boundary: hr == threshold does not fire; hr == threshold+1 fires and rationale describes the same arithmetic", () => {
    const day = 4;
    const envelopeMax = getPhase(day).normalEnvelope.hrMax; // 100
    const margin = 10;
    const expectedThreshold = envelopeMax + margin; // 110

    const atBoundary = evaluate({
      dayPostOp: day,
      symptoms: { breathless: true },
      vitals: vitals({ hr: expectedThreshold }),
    });
    expect(atBoundary.level).not.toBe("red");

    const justOver = evaluate({
      dayPostOp: day,
      symptoms: { breathless: true },
      vitals: vitals({ hr: expectedThreshold + 1 }),
    });
    expect(justOver.level).toBe("red");
    expect(justOver.condition).toBe("Suspected pulmonary embolism");
    expect(justOver.firedRules).toEqual(["pe.breathless_with_tachycardia"]);
    // Both operands must appear, so a reader can reconstruct the threshold the
    // logic actually applied, and neither can drift without failing here.
    expect(justOver.rationale[0]).toContain(`${envelopeMax}`);
    expect(justOver.rationale[0]).toContain(`${margin} bpm`);
  });

  // Same regression, for the PE low-SpO2 floor (phase.normalEnvelope.spo2Min - 2).
  it("PE low-SpO2 boundary: spo2 == floor does not fire; spo2 == floor-1 fires and rationale cites the exact same floor", () => {
    const day = 4;
    const expectedFloor = getPhase(day).normalEnvelope.spo2Min - 2; // 92

    const atBoundary = evaluate({
      dayPostOp: day,
      symptoms: { breathless: true },
      vitals: vitals({ spo2: expectedFloor }),
    });
    // At the boundary the PE-spo2 rule must not fire, and spo2 92 is still
    // >= 90 so isolated hypoxia won't fire either, and no other rule is
    // satisfied by this input -> falls all the way through to green.
    expect(atBoundary.level).toBe("green");

    const justUnder = evaluate({
      dayPostOp: day,
      symptoms: { breathless: true },
      vitals: vitals({ spo2: expectedFloor - 1 }),
    });
    expect(justUnder.level).toBe("red");
    expect(justUnder.condition).toBe("Suspected pulmonary embolism");
    expect(justUnder.firedRules).toEqual(["pe.breathless_with_low_spo2"]);
    expect(justUnder.rationale[0]).toContain(`${expectedFloor}`);
  });
});

describe("evaluate — failed symptom extraction must never yield green", () => {
  it("scary transcript context with extraction failed + unremarkable vitals -> amber, not green", () => {
    // Empty symptoms here are what extractSymptoms returns on failure — without
    // symptomsUnusable the engine would incorrectly read this as green.
    const d = evaluate({
      dayPostOp: 4,
      symptoms: noSymptoms,
      vitals: vitals({ hr: 76, spo2: 97, tempC: 36.9, sbp: 122 }),
      symptomsUnusable: true,
    });
    expect(d.level).not.toBe("green");
    expect(d.level).toBe("amber");
    expect(d.condition).toBe("Symptom extraction unavailable");
    expect(d.firedRules).toEqual(["symptoms.extraction_failed"]);
    expect(d.rationale[0]).toMatch(/extraction/i);
  });

  it("successful empty extract + unremarkable vitals -> still green", () => {
    const d = evaluate({
      dayPostOp: 4,
      symptoms: noSymptoms,
      vitals: vitals({ hr: 76, spo2: 97, tempC: 36.9, sbp: 122 }),
      symptomsUnusable: false,
    });
    expect(d.level).toBe("green");
    expect(d.firedRules).toEqual([]);
  });

  it("omitted symptomsUnusable preserves prior evaluate() callers (empty symptoms can still be green)", () => {
    const d = evaluate({
      dayPostOp: 4,
      symptoms: noSymptoms,
      vitals: vitals({ hr: 76, spo2: 97, tempC: 36.9, sbp: 122 }),
    });
    expect(d.level).toBe("green");
  });
});

describe("evaluate — co-occurring findings are surfaced consistently in rationale", () => {
  it("wound_infection.fever mentions co-occurring wound discharge, matching sepsis.fever_with_tachycardia's style", () => {
    // Fever without tachycardia -> wound_infection.fever (amber), not sepsis.
    const d = evaluate({
      dayPostOp: 21,
      symptoms: { woundDischarge: true },
      vitals: vitals({ tempC: 37.8, hr: 84 }),
    });
    expect(d.level).toBe("amber");
    expect(d.condition).toBe("Possible wound infection");
    expect(d.firedRules).toEqual(["wound_infection.fever"]);
    expect(d.rationale[0]).toContain("wound discharge also reported");
  });

  it("wound_infection.fever omits the discharge clause when discharge was not reported", () => {
    const d = evaluate({
      dayPostOp: 21,
      symptoms: noSymptoms,
      vitals: vitals({ tempC: 37.8, hr: 84 }),
    });
    expect(d.firedRules).toEqual(["wound_infection.fever"]);
    expect(d.rationale[0]).not.toContain("wound discharge");
  });
});
