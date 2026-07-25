import type { Phase } from "./types";

const THRESHOLD_SOURCE =
  "Plausible-but-uncited: general post-op physiology. Needs NEWS2/AAOS citation before clinical use.";

export const HIP_RECOVERY: Phase[] = [
  {
    name: "Early protected",
    dayStart: 0,
    dayEnd: 13,
    normalEnvelope: {
      tempCMax: 38.0,
      hrMax: 100,
      spo2Min: 94,
      source: THRESHOLD_SOURCE,
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
      source: THRESHOLD_SOURCE,
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
      source: THRESHOLD_SOURCE,
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
