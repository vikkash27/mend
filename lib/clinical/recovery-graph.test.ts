import { describe, expect, it } from "vitest";
import { getPhase } from "./recovery-graph";

describe("getPhase", () => {
  it("returns the early protected phase on day 2", () => {
    const p = getPhase(2);
    expect(p.name).toBe("Early protected");
    expect(p.normalEnvelope.tempCMax).toBe(38.0);
    expect(p.weightBearing).toMatch(/frame|walker/i);
  });

  it("tightens the temp envelope by week 3", () => {
    expect(getPhase(21).normalEnvelope.tempCMax).toBe(37.5);
  });

  it("clamps days beyond the graph to the last phase", () => {
    expect(getPhase(999).name).toBe("Strengthening");
  });

  it("every phase declares a threshold source", () => {
    for (const p of [getPhase(2), getPhase(21), getPhase(90)]) {
      expect(p.normalEnvelope.source.length).toBeGreaterThan(0);
    }
  });
});
