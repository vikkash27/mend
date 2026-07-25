/**
 * The patient's analgesia, and the arithmetic for whether a dose is due.
 *
 * Deliberately narrow. This models what has been prescribed and what has been
 * taken — it does not prescribe, adjust, or approve. Every judgement it
 * supports is bounded arithmetic (has the interval elapsed, are they at the
 * daily ceiling), because those are the only questions software should answer
 * unaided.
 */

export type MedicationRoute = "oral" | "topical" | "subcutaneous";
export type MedicationSchedule = "regular" | "prn";

export interface Medication {
  id: string;
  /** Generic name, US convention. */
  name: string;
  dose: string;
  route: MedicationRoute;
  schedule: MedicationSchedule;
  /** Plain-English timing, shown to the patient. */
  frequency: string;
  indication: string;
  /** PRN only: shortest gap between doses. */
  minIntervalHours?: number;
  /** PRN only: ceiling in a rolling 24 hours. */
  maxDosesIn24h?: number;
  /** Controlled substances always need a human decision, however far from the ceiling. */
  isOpioid?: boolean;
  /** Why this must not be given — surfaced verbatim, never reasoned around. */
  contraindicationNote?: string;
}

export interface MedicationAdministration {
  medicationId: string;
  /** ISO timestamp. */
  takenAt: string;
  /** Self-reported doses are the norm at home, and are labelled as such. */
  source: "patient_reported" | "clinician_recorded";
}

/**
 * Margaret's regimen — synthetic, and typical of a hip-fracture
 * hemiarthroplasty discharged on day 3.
 */
export const DEMO_MEDICATIONS: Medication[] = [
  {
    id: "acetaminophen-1g",
    name: "Acetaminophen",
    dose: "1 g",
    route: "oral",
    schedule: "regular",
    frequency: "Four times a day, at least 4 hours apart",
    indication: "Background pain relief",
  },
  {
    id: "oxycodone-5mg",
    name: "Oxycodone (immediate release)",
    dose: "5 mg",
    route: "oral",
    schedule: "prn",
    frequency: "Every 4 hours as needed",
    indication: "Breakthrough pain",
    minIntervalHours: 4,
    maxDosesIn24h: 6,
    isOpioid: true,
  },
  {
    id: "senna-15mg",
    name: "Senna",
    dose: "15 mg",
    route: "oral",
    schedule: "regular",
    frequency: "At night",
    indication: "Prevents constipation from the oxycodone",
  },
  {
    id: "enoxaparin-40mg",
    name: "Enoxaparin",
    dose: "40 mg",
    route: "subcutaneous",
    schedule: "regular",
    frequency: "Once daily",
    indication: "Clot prevention after hip surgery",
  },
  {
    id: "ibuprofen-400mg",
    name: "Ibuprofen",
    dose: "400 mg",
    route: "oral",
    schedule: "prn",
    frequency: "Not currently prescribed",
    indication: "Breakthrough pain",
    minIntervalHours: 6,
    maxDosesIn24h: 3,
    contraindicationNote:
      "Withheld: on enoxaparin, and an NSAID raises bleeding risk. Do not offer without the surgical team's agreement.",
  },
];

const HOUR_MS = 3_600_000;

export function findMedication(
  id: string,
  meds: readonly Medication[] = DEMO_MEDICATIONS,
): Medication | undefined {
  return meds.find((m) => m.id === id);
}

function timesFor(
  medicationId: string,
  administrations: readonly MedicationAdministration[],
): number[] {
  return administrations
    .filter((a) => a.medicationId === medicationId)
    .map((a) => Date.parse(a.takenAt))
    .filter((t) => Number.isFinite(t));
}

/** Doses of one medication in the rolling 24 hours before `now`. */
export function dosesInLast24h(
  medicationId: string,
  administrations: readonly MedicationAdministration[],
  now: Date,
): number {
  const cutoff = now.getTime() - 24 * HOUR_MS;
  return timesFor(medicationId, administrations).filter(
    (t) => t > cutoff && t <= now.getTime(),
  ).length;
}

/**
 * Doses in the 24 hours *before* last. Compared with the current 24, a rising
 * requirement is the signal worth noticing — more so than the absolute count.
 */
export function dosesInPrior24h(
  medicationId: string,
  administrations: readonly MedicationAdministration[],
  now: Date,
): number {
  const end = now.getTime() - 24 * HOUR_MS;
  const start = end - 24 * HOUR_MS;
  return timesFor(medicationId, administrations).filter(
    (t) => t > start && t <= end,
  ).length;
}

/** Hours since the most recent dose, or undefined if never taken. */
export function hoursSinceLastDose(
  medicationId: string,
  administrations: readonly MedicationAdministration[],
  now: Date,
): number | undefined {
  const times = timesFor(medicationId, administrations).filter(
    (t) => t <= now.getTime(),
  );
  if (times.length === 0) return undefined;
  return (now.getTime() - Math.max(...times)) / HOUR_MS;
}

/** When the next dose becomes due on interval alone; undefined if due now. */
export function nextDoseDueAt(
  medication: Medication,
  administrations: readonly MedicationAdministration[],
  now: Date,
): Date | undefined {
  const since = hoursSinceLastDose(medication.id, administrations, now);
  const interval = medication.minIntervalHours;
  if (since === undefined || interval === undefined || since >= interval) {
    return undefined;
  }
  return new Date(now.getTime() + (interval - since) * HOUR_MS);
}
