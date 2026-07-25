import { describe, expect, it } from "vitest";
import { SCENARIO_META } from "./active-scenario";

describe("SCENARIO_META care pathway labels", () => {
  it("uses product care-pathway names", () => {
    expect(SCENARIO_META.green.label).toBe("Stable recovery");
    expect(SCENARIO_META.pe.label).toBe("Suspected PE pattern");
    expect(SCENARIO_META.drift.label).toBe("Slow HR drift");
  });
});
