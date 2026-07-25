import { describe, it, expect } from "vitest";
import { assessNovelty, worklistRank, PriorDecision } from "./novelty";
import { Severity } from "./types";

const prior = (dayPostOp: number, level: Severity, ...firedRules: string[]): PriorDecision => ({
  dayPostOp,
  level,
  firedRules,
});

const today = (level: Severity, ...firedRules: string[]) => ({ level, firedRules });

describe("assessNovelty", () => {
  it("reports unknown on a first check-in rather than guessing", () => {
    const f = assessNovelty(today("red", "pe.breathless_with_tachycardia"), []);
    expect(f.novelty).toBe("unknown");
    expect(f.label).toMatch(/first check-in/i);
  });

  it("calls a finding new when its rule did not fire last time", () => {
    const f = assessNovelty(today("red", "pe.breathless_with_tachycardia"), [
      prior(8, "green"),
    ]);
    expect(f.novelty).toBe("new");
    expect(f.newRules).toEqual(["pe.breathless_with_tachycardia"]);
    expect(f.consecutiveCheckins).toBe(0);
  });

  /**
   * The case that motivated this module: the same abnormal reading on day one
   * and on day four must not read identically to a clinician.
   */
  it("distinguishes a newly abnormal patient from one abnormal for days", () => {
    const rule = "afib.new_atrial_fibrillation";
    const newlyAbnormal = assessNovelty(today("amber", rule), [
      prior(5, "green"),
      prior(6, "green"),
      prior(7, "green"),
    ]);
    const chronicallyAbnormal = assessNovelty(today("amber", rule), [
      prior(5, "amber", rule),
      prior(6, "amber", rule),
      prior(7, "amber", rule),
    ]);

    expect(newlyAbnormal.novelty).toBe("new");
    expect(chronicallyAbnormal.novelty).toBe("persisting");
    expect(chronicallyAbnormal.consecutiveCheckins).toBe(3);
    // Same severity — the distinction is in how it reads, not in what it is.
    expect(newlyAbnormal.label).not.toBe(chronicallyAbnormal.label);
  });

  it("counts consecutive check-ins back to the first break", () => {
    const rule = "wound_infection.fever";
    const f = assessNovelty(today("amber", rule), [
      prior(3, "amber", rule),
      prior(4, "green"), // the break
      prior(5, "amber", rule),
      prior(6, "amber", rule),
    ]);
    expect(f.consecutiveCheckins).toBe(2);
  });

  it("calls a rising severity escalating, even when the rule already fired", () => {
    const f = assessNovelty(today("red", "fever.persistent"), [
      prior(6, "amber", "wound_infection.fever"),
    ]);
    expect(f.novelty).toBe("escalating");
    expect(f.label).toMatch(/amber at the last check-in, red now/i);
  });

  it("prefers escalating over new when both apply", () => {
    const f = assessNovelty(today("red", "shock.hypotension"), [prior(4, "amber", "pain.uncontrolled")]);
    expect(f.novelty).toBe("escalating");
    expect(f.newRules).toContain("shock.hypotension");
  });

  it("reports resolving when yesterday's finding has cleared", () => {
    const f = assessNovelty(today("green"), [prior(9, "amber", "dvt.calf_pain_or_swelling")]);
    expect(f.novelty).toBe("resolving");
    expect(f.clearedRules).toEqual(["dvt.calf_pain_or_swelling"]);
  });

  it("reports stable when nothing fired today or last time", () => {
    const f = assessNovelty(today("green"), [prior(9, "green")]);
    expect(f.novelty).toBe("stable");
    expect(f.consecutiveCheckins).toBe(0);
  });

  it("reports improving when severity falls but a rule still fires", () => {
    const rule = "pain.uncontrolled";
    const f = assessNovelty(today("amber", rule), [prior(9, "red", rule, "shock.hypotension")]);
    expect(f.novelty).toBe("resolving");
    expect(f.clearedRules).toContain("shock.hypotension");
  });

  it("never alters severity — it only describes it", () => {
    const f = assessNovelty(today("red", "sepsis.fever_with_tachycardia"), [
      prior(5, "red", "sepsis.fever_with_tachycardia"),
      prior(6, "red", "sepsis.fever_with_tachycardia"),
    ]);
    expect(f.novelty).toBe("persisting");
    // Nothing in the finding can be mistaken for a verdict.
    expect(f).not.toHaveProperty("level");
    expect(f).not.toHaveProperty("severity");
  });

  it("tolerates unordered history", () => {
    const rule = "dvt.calf_pain_or_swelling";
    const shuffled = assessNovelty(today("amber", rule), [
      prior(7, "amber", rule),
      prior(5, "green"),
      prior(6, "amber", rule),
    ]);
    expect(shuffled.novelty).toBe("persisting");
    expect(shuffled.consecutiveCheckins).toBe(2);
  });
});

describe("worklistRank", () => {
  it("puts red above amber above green regardless of novelty", () => {
    const redPersisting = worklistRank("red", { novelty: "persisting" });
    const amberEscalating = worklistRank("amber", { novelty: "escalating" });
    expect(redPersisting).toBeLessThan(amberEscalating);
  });

  it("puts a new red above one unchanged for days", () => {
    expect(worklistRank("red", { novelty: "new" })).toBeLessThan(
      worklistRank("red", { novelty: "persisting" }),
    );
  });

  it("puts escalating at the very top of its severity band", () => {
    const band = (["escalating", "new", "unknown", "persisting", "resolving", "stable"] as const).map(
      (n) => worklistRank("amber", { novelty: n }),
    );
    expect(Math.min(...band)).toBe(band[0]);
  });
});
