import { afterEach, describe, expect, it } from "vitest";
import {
  getActiveScenario,
  isScenario,
  setActiveScenario,
  SCENARIOS,
} from "./active-scenario";

describe("active scenario store", () => {
  afterEach(() => {
    setActiveScenario("green");
  });

  it("defaults to green", () => {
    expect(getActiveScenario()).toBe("green");
  });

  it("round-trips every declared scenario", () => {
    for (const scenario of SCENARIOS) {
      expect(setActiveScenario(scenario)).toBe(scenario);
      expect(getActiveScenario()).toBe(scenario);
    }
  });

  it("isScenario accepts only the three fixture keys", () => {
    expect(isScenario("green")).toBe(true);
    expect(isScenario("pe")).toBe(true);
    expect(isScenario("drift")).toBe(true);
    expect(isScenario("amber")).toBe(false);
    expect(isScenario("")).toBe(false);
    expect(isScenario(null)).toBe(false);
  });
});
