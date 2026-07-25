import type { Phase } from "./types";

/**
 * Provenance for the envelope numbers. Adjudicated 2026-07-25 —
 * see docs/adjudicated/news2-vital-thresholds.md.
 *
 * These are deliberately two strings rather than one, because the numbers they
 * cover do not share a provenance. SpO2 and the early-phase temperature line sit
 * exactly on NEWS2 boundaries; the heart-rate lines and the tightened late-phase
 * temperature do not, and saying so is the whole point of carrying a source
 * string at all. A single constant spanning both would assert a citation for
 * numbers that have none.
 *
 * Note also what this is NOT: Mend borrows individual NEWS2 boundaries, it does
 * not compute a NEWS2 aggregate — respiratory rate and level of consciousness
 * are not obtainable over a phone call. NEWS2's discrimination comes from the
 * aggregate, so this is the weaker claim of the two, on purpose.
 *
 * AAOS is absent by correction, not omission. The AAOS VTE guideline
 * (PMID 22134209) is about prophylaxis and contains no vital-sign cut-points; it
 * underwrites the enoxaparin in the regimen and the existence of the PE rules,
 * never the numbers they compare against.
 */
const NEWS2 =
  "NEWS2 (Royal College of Physicians 2017; PMID 31092526). " +
  "SpO2 94 is the foot of the 1-point band, so below it scores >=2. ";

const EARLY_SOURCE =
  NEWS2 +
  "Temperature 38.0 C is the exact top of the NEWS2 zero-score band (36.1-38.0). " +
  "Heart rate 100 is NOT a NEWS2 boundary - NEWS2 steps at 90 and 110 - and remains " +
  "plausible-but-uncited post-op physiology.";

const LATE_SOURCE =
  NEWS2 +
  "Temperature 37.5 C is tighter than NEWS2, which scores zero to 38.0; it encodes " +
  "post-op day, which NEWS2 has no notion of (late fever OR 23.3 after POD 3, " +
  "PMID 20452174 - see docs/adjudicated/postop-fever-envelope.md). Both it and the " +
  "heart-rate line of 95 remain plausible-but-uncited.";

export const HIP_RECOVERY: Phase[] = [
  {
    name: "Early protected",
    dayStart: 0,
    dayEnd: 13,
    normalEnvelope: {
      tempCMax: 38.0,
      hrMax: 100,
      spo2Min: 94,
      source: EARLY_SOURCE,
    },
    weightBearing: "Weight-bear as tolerated with a frame/walker",
    rehab: [
      "Ankle pumps hourly",
      "Static quads",
      "Assisted sit-to-stand",
      "Short walks with frame/walker",
    ],
    precautions: [
      "No hip flexion past 90 degrees",
      "No crossing legs / adduction past midline",
      "No twisting on the operated leg",
    ],
  },
  {
    name: "Progressive mobility",
    dayStart: 14,
    dayEnd: 41,
    normalEnvelope: {
      tempCMax: 37.5,
      hrMax: 95,
      spo2Min: 94,
      source: LATE_SOURCE,
    },
    weightBearing: "Weight-bear as tolerated, wean walking aid",
    rehab: [
      "Progress to a single stick",
      "Hip abduction (side-lying)",
      "Standing hip extension",
      "Stairs one step at a time",
    ],
    precautions: ["Maintain hip precautions", "Avoid low chairs and deep sofas"],
  },
  {
    name: "Strengthening",
    dayStart: 42,
    dayEnd: 999,
    normalEnvelope: {
      tempCMax: 37.5,
      hrMax: 95,
      spo2Min: 94,
      source: LATE_SOURCE,
    },
    weightBearing: "Full weight-bearing",
    rehab: [
      "Resistance band abduction",
      "Mini squats to a chair",
      "Balance work",
      "Stationary cycling",
    ],
    precautions: ["Return to driving only when cleared by your surgeon"],
  },
];

export function getPhase(dayPostOp: number): Phase {
  if (dayPostOp < HIP_RECOVERY[0].dayStart) {
    return HIP_RECOVERY[0];
  }

  return (
    HIP_RECOVERY.find(
      (phase) =>
        dayPostOp >= phase.dayStart && dayPostOp <= phase.dayEnd,
    ) ?? HIP_RECOVERY[HIP_RECOVERY.length - 1]
  );
}
