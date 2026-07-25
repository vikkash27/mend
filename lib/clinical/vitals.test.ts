import { describe, expect, it } from "vitest";
import { usableVitals } from "./vitals";

describe("usableVitals", () => {
  it("passes through plausible readings with ok quality", () => {
    const reading = {
      timestamp: "2026-07-25T12:00:00.000Z",
      hr: 82,
      sbp: 124,
      dbp: 76,
      tempC: 36.8,
      spo2: 98,
      respRate: 16,
      source: "manual" as const,
      deviceLabel: "Home monitor",
      quality: "ok" as const,
    };

    expect(usableVitals(reading)).toEqual(reading);
  });

  it("drops physiologic fields from stale readings", () => {
    const result = usableVitals({
      timestamp: "2026-07-25T12:00:00.000Z",
      hr: 82,
      tempC: 36.8,
      spo2: 98,
      source: "ble_heart_rate",
      deviceLabel: "Polar Pacer Pro",
      quality: "stale",
    });

    expect(result).toEqual({
      timestamp: "2026-07-25T12:00:00.000Z",
      source: "ble_heart_rate",
      deviceLabel: "Polar Pacer Pro",
      quality: "stale",
    });
  });

  it("drops implausible fields from otherwise usable readings", () => {
    const result = usableVitals({
      timestamp: "2026-07-25T12:00:00.000Z",
      hr: 300,
      sbp: 120,
      dbp: 80,
      tempC: 12,
      spo2: 130,
      respRate: 16,
      source: "manual",
      quality: "ok",
    });

    expect(result).toEqual({
      timestamp: "2026-07-25T12:00:00.000Z",
      sbp: 120,
      dbp: 80,
      respRate: 16,
      source: "manual",
      quality: "ok",
    });
  });

  it("always preserves source and timestamp", () => {
    const result = usableVitals({
      timestamp: "2026-07-25T12:00:00.000Z",
      hr: 300,
      source: "simulated",
      quality: "poor",
    });

    expect(result.timestamp).toBe("2026-07-25T12:00:00.000Z");
    expect(result.source).toBe("simulated");
  });
});
