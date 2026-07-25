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

    const result = usableVitals(reading);

    expect(result).toEqual(reading);
    expect(result.deviceLabel).toBe("Home monitor");
  });

  it("drops physiologic fields from poor readings", () => {
    const result = usableVitals({
      timestamp: "2026-07-25T12:00:00.000Z",
      hr: 82,
      sbp: 124,
      dbp: 76,
      tempC: 36.8,
      spo2: 98,
      respRate: 16,
      source: "ble_heart_rate",
      deviceLabel: "Polar Pacer Pro",
      quality: "poor",
    });

    expect(result).toEqual({
      timestamp: "2026-07-25T12:00:00.000Z",
      source: "ble_heart_rate",
      deviceLabel: "Polar Pacer Pro",
      quality: "poor",
    });
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

  describe.each([
    { field: "hr", min: 20, max: 250 },
    { field: "sbp", min: 50, max: 260 },
    { field: "dbp", min: 20, max: 160 },
    { field: "tempC", min: 30, max: 43 },
    { field: "spo2", min: 50, max: 100 },
    { field: "respRate", min: 4, max: 60 },
  ] as const)("$field plausible range boundaries", ({ field, min, max }) => {
    const baseReading = {
      timestamp: "2026-07-25T12:00:00.000Z",
      source: "manual" as const,
      quality: "ok" as const,
    };

    it.each([
      { value: min, kept: true, label: "minimum" },
      { value: max, kept: true, label: "maximum" },
      { value: min - 1, kept: false, label: "below minimum" },
      { value: max + 1, kept: false, label: "above maximum" },
    ] as const)("$label ($value) is kept=$kept", ({ value, kept }) => {
      const reading = { ...baseReading, [field]: value };
      const result = usableVitals(reading);

      if (kept) {
        expect(result).toEqual(reading);
      } else {
        expect(result).toEqual(baseReading);
        expect(result[field]).toBeUndefined();
      }
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
