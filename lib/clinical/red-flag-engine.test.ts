import { describe, expect, it } from "vitest";
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
