import { describe, expect, it } from "vitest";
import {
  DEFAULT_ASC_ROI_INPUTS,
  calculateAscRoi,
  formatMoney,
} from "./asc-roi";

describe("calculateAscRoi", () => {
  it("matches the default worksheet economics", () => {
    const r = calculateAscRoi(DEFAULT_ASC_ROI_INPUTS);

    // 60 declined × 35% = 21 cases × $2500
    expect(r.recoveredCases).toBe(21);
    expect(r.capacityGain).toBe(52500);

    // 10h × 52 × 70% = 364h × $55
    expect(r.nurseHours).toBe(364);
    expect(r.labourGain).toBe(20020);

    // 421 monitored × 4% × 20% = 3.368 visits × $1200
    expect(r.monitored).toBe(421);
    expect(r.visitsAvoided).toBeCloseTo(3.368, 3);
    expect(r.rescueGain).toBeCloseTo(4041.6, 1);

    expect(r.cost).toBe(421 * 95);
    expect(r.net).toBeCloseTo(r.gains - r.cost, 5);
    expect(r.net).toBeGreaterThan(0);
  });

  it("turns negative when capacity term is removed", () => {
    const r = calculateAscRoi({
      ...DEFAULT_ASC_ROI_INPUTS,
      declinedPerYear: 0,
    });
    expect(r.capacityGain).toBe(0);
    expect(r.net).toBeLessThan(0);
  });

  it("formats money without cents", () => {
    expect(formatMoney(52500)).toBe("$52,500");
  });
});
