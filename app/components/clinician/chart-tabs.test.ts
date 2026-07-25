import { describe, expect, it } from "vitest";
import { chartTabHref, parseChartTab } from "./chart-tabs";

describe("parseChartTab", () => {
  it("defaults to overview for null/unknown", () => {
    expect(parseChartTab(null)).toBe("overview");
    expect(parseChartTab("nope")).toBe("overview");
  });

  it("accepts known tabs", () => {
    expect(parseChartTab("readings")).toBe("readings");
    expect(parseChartTab("handoff")).toBe("handoff");
    expect(parseChartTab("billing")).toBe("billing");
    expect(parseChartTab("audit")).toBe("audit");
  });
});

describe("chartTabHref", () => {
  it("omits query for overview", () => {
    expect(chartTabHref("margaret-ellison", "overview")).toBe(
      "/clinician/margaret-ellison",
    );
  });

  it("adds tab query for non-default tabs", () => {
    expect(chartTabHref("margaret-ellison", "billing")).toBe(
      "/clinician/margaret-ellison?tab=billing",
    );
  });
});
