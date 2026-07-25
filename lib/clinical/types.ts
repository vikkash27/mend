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
  feverSubjective?: boolean;
  suddenSevereHipPain?: boolean;
  legShortenedOrRotated?: boolean;
  unableToWeightBear?: boolean;
  painControlled?: boolean;
  newConfusion?: boolean;
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
