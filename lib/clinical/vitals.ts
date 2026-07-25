import type { VitalsReading } from "./types";

const isPlausible = (value: number, min: number, max: number): boolean =>
  value >= min && value <= max;

export function usableVitals(v: VitalsReading): VitalsReading {
  if (v.quality !== "ok") {
    return {
      timestamp: v.timestamp,
      quality: v.quality,
      source: v.source,
      deviceLabel: v.deviceLabel,
    };
  }

  return {
    timestamp: v.timestamp,
    source: v.source,
    deviceLabel: v.deviceLabel,
    quality: v.quality,
    ...(v.hr !== undefined && isPlausible(v.hr, 20, 250) ? { hr: v.hr } : {}),
    ...(v.sbp !== undefined && isPlausible(v.sbp, 50, 260)
      ? { sbp: v.sbp }
      : {}),
    ...(v.dbp !== undefined && isPlausible(v.dbp, 20, 160)
      ? { dbp: v.dbp }
      : {}),
    ...(v.tempC !== undefined && isPlausible(v.tempC, 30, 43)
      ? { tempC: v.tempC }
      : {}),
    ...(v.spo2 !== undefined && isPlausible(v.spo2, 50, 100)
      ? { spo2: v.spo2 }
      : {}),
    ...(v.respRate !== undefined && isPlausible(v.respRate, 4, 60)
      ? { respRate: v.respRate }
      : {}),
  };
}
