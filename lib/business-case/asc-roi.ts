/**
 * ASC per-center ROI model — inputs are user-supplied; defaults are illustrative.
 * Ported from docs/business-case-asc.html.
 */

export type AscRoiInputs = {
  casesPerYear: number;
  marginPerCase: number;
  declinedPerYear: number;
  acceptSharePct: number;
  nurseHoursPerWeek: number;
  nurseCostPerHour: number;
  absorbSharePct: number;
  visitRatePct: number;
  visitReductionPct: number;
  costPerVisit: number;
  pricePerCase: number;
};

export type AscRoiResult = {
  recoveredCases: number;
  capacityGain: number;
  nurseHours: number;
  labourGain: number;
  monitored: number;
  visitsAvoided: number;
  rescueGain: number;
  gains: number;
  cost: number;
  net: number;
  roi: number;
  breakeven: number;
};

export const DEFAULT_ASC_ROI_INPUTS: AscRoiInputs = {
  casesPerYear: 400,
  marginPerCase: 2500,
  declinedPerYear: 60,
  acceptSharePct: 35,
  nurseHoursPerWeek: 10,
  nurseCostPerHour: 55,
  absorbSharePct: 70,
  visitRatePct: 4,
  visitReductionPct: 20,
  costPerVisit: 1200,
  pricePerCase: 95,
};

export function calculateAscRoi(inputs: AscRoiInputs): AscRoiResult {
  const recoveredCases = inputs.declinedPerYear * (inputs.acceptSharePct / 100);
  const capacityGain = recoveredCases * inputs.marginPerCase;

  const nurseHours = inputs.nurseHoursPerWeek * 52 * (inputs.absorbSharePct / 100);
  const labourGain = nurseHours * inputs.nurseCostPerHour;

  const monitored = inputs.casesPerYear + recoveredCases;
  const visitsAvoided =
    monitored * (inputs.visitRatePct / 100) * (inputs.visitReductionPct / 100);
  const rescueGain = visitsAvoided * inputs.costPerVisit;

  const gains = capacityGain + labourGain + rescueGain;
  const cost = monitored * inputs.pricePerCase;
  const net = gains - cost;
  const roi = cost > 0 ? gains / cost : Number.POSITIVE_INFINITY;
  const breakeven = monitored > 0 ? gains / monitored : 0;

  return {
    recoveredCases,
    capacityGain,
    nurseHours,
    labourGain,
    monitored,
    visitsAvoided,
    rescueGain,
    gains,
    cost,
    net,
    roi,
    breakeven,
  };
}

export function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function formatNum(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
