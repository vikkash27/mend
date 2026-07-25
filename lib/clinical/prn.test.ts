import { describe, it, expect } from "vitest";
import { assessPrnRequest } from "./prn";
import {
  DEMO_MEDICATIONS,
  findMedication,
  MedicationAdministration,
  dosesInLast24h,
  dosesInPrior24h,
  hoursSinceLastDose,
  nextDoseDueAt,
} from "./medications";

const NOW = new Date("2026-07-25T14:00:00Z");
const oxycodone = findMedication("oxycodone-5mg")!;
const ibuprofen = findMedication("ibuprofen-400mg")!;
const senna = findMedication("senna-15mg")!;

/** A dose taken `hoursAgo` before NOW. */
const dose = (hoursAgo: number, medicationId = "oxycodone-5mg"): MedicationAdministration => ({
  medicationId,
  takenAt: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(),
  source: "patient_reported",
});

const ask = (
  administrations: MedicationAdministration[],
  extra: Partial<Parameters<typeof assessPrnRequest>[0]> = {},
) =>
  assessPrnRequest({
    medication: oxycodone,
    administrations,
    now: NOW,
    currentSeverity: "green",
    ...extra,
  });

describe("dose arithmetic", () => {
  it("counts only the rolling 24 hours", () => {
    const a = [dose(1), dose(12), dose(25), dose(40)];
    expect(dosesInLast24h("oxycodone-5mg", a, NOW)).toBe(2);
  });

  it("counts the previous 24 hours separately, for comparison", () => {
    const a = [dose(1), dose(30), dose(40)];
    expect(dosesInLast24h("oxycodone-5mg", a, NOW)).toBe(1);
    expect(dosesInPrior24h("oxycodone-5mg", a, NOW)).toBe(2);
  });

  it("does not count another medication's doses", () => {
    expect(dosesInLast24h("oxycodone-5mg", [dose(1, "senna-15mg")], NOW)).toBe(0);
  });

  it("reports hours since the most recent dose, not the first", () => {
    expect(hoursSinceLastDose("oxycodone-5mg", [dose(9), dose(2)], NOW)).toBeCloseTo(2, 5);
    expect(hoursSinceLastDose("oxycodone-5mg", [], NOW)).toBeUndefined();
  });

  it("returns no due-time once the interval has elapsed", () => {
    expect(nextDoseDueAt(oxycodone, [dose(5)], NOW)).toBeUndefined();
    expect(nextDoseDueAt(oxycodone, [dose(1)], NOW)).toBeInstanceOf(Date);
  });

  it("ignores unparseable timestamps rather than throwing", () => {
    const junk: MedicationAdministration[] = [
      { medicationId: "oxycodone-5mg", takenAt: "not-a-date", source: "patient_reported" },
    ];
    expect(dosesInLast24h("oxycodone-5mg", junk, NOW)).toBe(0);
    expect(hoursSinceLastDose("oxycodone-5mg", junk, NOW)).toBeUndefined();
  });
});

describe("assessPrnRequest — the clinical picture outranks the arithmetic", () => {
  /**
   * The rule that motivates the whole module: a patient with an open concern
   * needs assessing, not medicating, however impeccable their dose history.
   */
  it("routes to assessment when a red finding is open, even though the dose is due", () => {
    const a = assessPrnRequest({
      medication: oxycodone,
      administrations: [dose(6)], // interval elapsed, well under the ceiling
      now: NOW,
      currentSeverity: "red",
      firedRules: ["pe.breathless_with_tachycardia"],
    });
    expect(a.outcome).toBe("assess_first");
    expect(a.notify).toBe("urgent");
    expect(a.reasons).toContain("prn.assess_before_analgesia");
    expect(a.clinicianSummary).toContain("pe.breathless_with_tachycardia");
  });

  it("routes to assessment on an open amber too", () => {
    expect(
      ask([dose(6)], { currentSeverity: "amber" }).outcome,
    ).toBe("assess_first");
  });

  it("routes to assessment on severe pain regardless of dose history", () => {
    const a = ask([], { painScore: 9 });
    expect(a.outcome).toBe("assess_first");
    expect(a.reasons).toContain("prn.severe_pain_score");
    expect(a.clinicianSummary).toMatch(/compartment syndrome/i);
  });

  it("routes to assessment when the requirement is climbing day on day", () => {
    // 4 doses today, 1 yesterday — a real change inside a 6-dose ceiling.
    const a = ask([dose(23), dose(18), dose(12), dose(6), dose(30)]);
    expect(a.requirementRising).toBe(true);
    expect(a.outcome).toBe("assess_first");
    expect(a.reasons).toContain("prn.requirement_rising");
  });

  it("does not call a small early increase a rising requirement", () => {
    // 2 today vs 0 yesterday — normal early variation, below the floor.
    const a = ask([dose(20), dose(6)]);
    expect(a.requirementRising).toBe(false);
    expect(a.outcome).not.toBe("assess_first");
  });
});

describe("assessPrnRequest — dosing limits", () => {
  it("blocks and escalates at the 24-hour ceiling", () => {
    // Six yesterday as well, so this is a patient sitting at their ceiling
    // rather than a climbing requirement — the rising-requirement rule
    // deliberately outranks this one, so it must not also be true here.
    const a = ask([
      dose(23), dose(19), dose(15), dose(11), dose(7), dose(5),
      dose(47), dose(43), dose(39), dose(35), dose(31), dose(27),
    ]);
    expect(a.dosesUsedIn24h).toBe(6);
    expect(a.outcome).toBe("blocked_max_daily");
    // Being capped while still in pain is itself a reason to involve someone.
    expect(a.notify).toBe("urgent");
  });

  it("blocks when the interval has not elapsed, and says when it will", () => {
    const a = ask([dose(1)]);
    expect(a.outcome).toBe("blocked_interval");
    expect(a.nextDoseDueAt).toBeDefined();
    expect(a.patientMessage).toMatch(/minute/);
    expect(a.notify).toBe("routine");
  });

  it("honours a recorded contraindication without reasoning around it", () => {
    const a = assessPrnRequest({
      medication: ibuprofen,
      administrations: [],
      now: NOW,
      currentSeverity: "green",
    });
    expect(a.outcome).toBe("contraindicated");
    expect(a.clinicianSummary).toMatch(/enoxaparin/i);
  });

  it("recognises a regular medication asked for as needed", () => {
    const a = assessPrnRequest({
      medication: senna,
      administrations: [],
      now: NOW,
      currentSeverity: "green",
    });
    expect(a.outcome).toBe("not_prn");
  });
});

describe("assessPrnRequest — never approves", () => {
  it("sends a clean, in-limits opioid request to a clinician rather than granting it", () => {
    const a = ask([dose(6)]);
    expect(a.outcome).toBe("awaiting_clinician");
    expect(a.notify).toBe("urgent"); // opioid
    expect(a.reasons).toContain("prn.opioid_requires_approval");
    expect(a.clinicianSummary).toMatch(/requires your approval/i);
  });

  it("never tells the patient they may take the dose", () => {
    const outcomes = [
      ask([dose(6)]),
      ask([dose(1)]),
      ask([], { painScore: 9 }),
      ask([dose(6)], { currentSeverity: "amber" }),
    ];
    for (const a of outcomes) {
      expect(a.patientMessage).not.toMatch(/\b(go ahead|you can take|approved|yes,? take)\b/i);
    }
  });

  it("has no outcome that means approved", () => {
    const a = ask([dose(6)]);
    expect(a.outcome).not.toMatch(/approved|granted|allowed/);
  });

  it("always carries a machine-readable reason and something for each reader", () => {
    for (const med of DEMO_MEDICATIONS) {
      const a = assessPrnRequest({
        medication: med,
        administrations: [],
        now: NOW,
        currentSeverity: "green",
      });
      expect(a.reasons.length).toBeGreaterThan(0);
      expect(a.patientMessage.length).toBeGreaterThan(0);
      expect(a.clinicianSummary.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic", () => {
    const a = [dose(6), dose(13)];
    expect(ask(a)).toEqual(ask(a));
  });
});
