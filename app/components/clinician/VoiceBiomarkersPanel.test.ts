import { describe, expect, it } from "vitest";
import {
  voiceLevelLabel,
  voiceLevelSeverity,
  voiceStatusPresentation,
} from "./VoiceBiomarkersPanel";

describe("voiceLevelSeverity / voiceLevelLabel", () => {
  it("maps signal levels to severity tokens with readable labels", () => {
    // High biomarker ≠ PE red — amber/neutral presentation only.
    expect(voiceLevelSeverity("high")).toBe("amber");
    expect(voiceLevelLabel("high")).toBe("High");
    expect(voiceLevelSeverity("moderate")).toBe("amber");
    expect(voiceLevelLabel("moderate")).toBe("Moderate");
    expect(voiceLevelSeverity("low")).toBe("green");
    expect(voiceLevelLabel("low")).toBe("Low");
    expect(voiceLevelSeverity("unknown")).toBe("green");
    expect(voiceLevelLabel("unknown")).toBe("Unknown");
  });
});

describe("voiceStatusPresentation", () => {
  it("covers pending, ready, error, and unavailable with icon + text", () => {
    for (const status of ["pending", "ready", "error", "unavailable"] as const) {
      const presentation = voiceStatusPresentation(status);
      expect(presentation.label.length).toBeGreaterThan(0);
      expect(presentation.description.length).toBeGreaterThan(0);
      expect(presentation.icon).toBeTruthy();
    }
  });

  it("labels pending and ready for the chart status strip", () => {
    expect(voiceStatusPresentation("pending").label).toBe("Pending");
    expect(voiceStatusPresentation("ready").label).toBe("Ready");
    expect(voiceStatusPresentation("error").label).toBe("Error");
    expect(voiceStatusPresentation("unavailable").label).toBe("Unavailable");
  });
});
