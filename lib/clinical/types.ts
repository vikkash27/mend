export type { VoiceBiomarkers, VoiceDomainSignal } from "@/lib/amplifier/types";

export type Severity = "green" | "amber" | "red";

export type EcgDetermination =
  | "normal_sinus_rhythm"
  | "atrial_fibrillation"
  | "tachycardia"
  | "bradycardia"
  | "unclassified";

export interface Symptoms {
  breathless?: boolean;
  chestPain?: boolean;
  calfPainOrSwelling?: boolean;
  woundDischarge?: boolean;
  /**
   * Reserved: not yet read by any red-flag rule. The engine currently acts
   * only on device temperature (`VitalsReading.tempC`) via `fevered`, never
   * on a subjective report alone. Documented gap, not an oversight — wire
   * this in deliberately if subjective-only fever is meant to be actionable.
   */
  feverSubjective?: boolean;
  suddenSevereHipPain?: boolean;
  legShortenedOrRotated?: boolean;
  unableToWeightBear?: boolean;
  painControlled?: boolean;
  newConfusion?: boolean;
  /**
   * 0-10. Not read by any red-flag-engine rule — consumed exclusively by the
   * trend engine (`evaluateTrends` in `trends.ts`), which watches its slope
   * over time rather than any single-reading threshold.
   */
  painScore?: number;
}

export type VitalsSource =
  | "ble_heart_rate"
  | "manual"
  | "kardia_6l"
  | "simulated";

export interface VitalsReading {
  timestamp: string;
  hr?: number;
  sbp?: number;
  dbp?: number;
  tempC?: number;
  spo2?: number;
  respRate?: number;
  /**
   * 0-10 pain score captured alongside this reading. Optional because BLE
   * heart-rate ticks and device spot-checks do not carry pain; voice
   * check-ins do. The trend engine prefers this per-row value over a
   * parallel symptoms array so the pain slope is computed from genuinely
   * distinct timepoints on real (non-fixture) history.
   */
  painScore?: number;
  source: VitalsSource;
  deviceLabel?: string;
  quality: "ok" | "poor" | "stale";
}

/** Output of the KardiaMobile 6L, consumed as-is. Mend never re-derives it. */
export interface EcgReading {
  recordedAt: string;
  determination: EcgDetermination;
  bpm?: number;
  source: "kardia_6l";
  pdfUrl?: string;
}

export interface Phase {
  name: string;
  dayStart: number;
  dayEnd: number;
  normalEnvelope: {
    tempCMax: number;
    hrMax: number;
    spo2Min: number;
    source: string;
  };
  rehab: string[];
  precautions: string[];
  weightBearing: string;
}

export interface Decision {
  level: Severity;
  condition?: string;
  action: string;
  call?: "911" | "ER" | "surgeon_office" | "nurse_line";
  rationale: string[];
  firedRules: string[];
}

export interface TrendFinding {
  id: string;
  metric: "hr" | "spo2" | "tempC" | "painScore";
  description: string;
  severity: Severity;
}
