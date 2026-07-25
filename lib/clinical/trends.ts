import type { Phase, Symptoms, TrendFinding, VitalsReading } from "./types";

/**
 * Escalation on trajectory, not on any single threshold breach. `evaluate()`
 * (red-flag-engine.ts) decides the level for a single reading; this module
 * only ever produces findings — composing them into a Decision happens
 * elsewhere (Task 12), where trend findings may raise green to amber but may
 * never lower any level.
 */

const MAX_WINDOW = 7;
const MIN_POINTS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Fixed, defensible per-day rate thresholds. HR/SpO2/painScore values are
 * given verbatim by the brief. Temperature is not specified by the brief, so
 * we choose +0.15C/day: sustained at that rate it adds up to roughly 1C of
 * drift across the 7-day window cap, well before any single reading would
 * cross the phase's absolute tempCMax (the red-flag-engine's own fever
 * rule) — which is exactly the gap a trajectory-only escalation is meant to
 * close. A single day-to-day thermometer wobble of a few tenths of a degree
 * will not sustain that slope across >=3 points, so this does not fire on
 * ordinary noise (see trends.test.ts "trivial temperature wobble").
 */
const TEMP_SLOPE_THRESHOLD_C_PER_DAY = 0.15;
const HR_SLOPE_THRESHOLD_BPM_PER_DAY = 3;
const SPO2_SLOPE_THRESHOLD_PCT_PER_DAY = -1;
const PAIN_SLOPE_THRESHOLD_PER_DAY = 1;

interface WindowPoint {
  reading: VitalsReading;
  symptoms: Symptoms;
}

interface RegressionPoint {
  tDays: number;
  value: number;
}

interface RegressionResult {
  slope: number;
  first: RegressionPoint;
  last: RegressionPoint;
  spanDays: number;
}

/** Pairs each reading with its parallel symptoms entry, sorts by actual
 * timestamp (never assumed pre-sorted), then keeps at most the trailing
 * MAX_WINDOW entries. */
function toWindow(history: VitalsReading[], symptoms: Symptoms[]): WindowPoint[] {
  const paired: WindowPoint[] = history.map((reading, i) => ({
    reading,
    symptoms: symptoms[i] ?? {},
  }));

  const sorted = [...paired].sort(
    (a, b) => Date.parse(a.reading.timestamp) - Date.parse(b.reading.timestamp),
  );

  return sorted.slice(Math.max(0, sorted.length - MAX_WINDOW));
}

/** Extracts usable (non-missing) points for one metric, deriving elapsed
 * days from each reading's own timestamp relative to the first usable point
 * for THIS metric — never from array index, and never guessing a value for
 * a reading where the metric is absent. */
function extractPoints(
  window: WindowPoint[],
  getValue: (p: WindowPoint) => number | undefined,
): RegressionPoint[] {
  const usable = window
    .map((p) => ({ p, value: getValue(p) }))
    .filter((x): x is { p: WindowPoint; value: number } => x.value !== undefined);

  if (usable.length < MIN_POINTS) {
    return [];
  }

  const t0 = Date.parse(usable[0].p.reading.timestamp);
  return usable.map((x) => ({
    tDays: (Date.parse(x.p.reading.timestamp) - t0) / MS_PER_DAY,
    value: x.value,
  }));
}

/** Ordinary least-squares slope of value regressed on elapsed days.
 * Returns undefined when there is no time variance to regress against
 * (all usable points share the same timestamp) rather than dividing by
 * zero. */
function leastSquaresSlope(points: RegressionPoint[]): number | undefined {
  const n = points.length;
  const tMean = points.reduce((sum, p) => sum + p.tDays, 0) / n;
  const yMean = points.reduce((sum, p) => sum + p.value, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (const p of points) {
    const dt = p.tDays - tMean;
    numerator += dt * (p.value - yMean);
    denominator += dt * dt;
  }

  if (denominator === 0) {
    return undefined;
  }

  return numerator / denominator;
}

function regress(points: RegressionPoint[]): RegressionResult | undefined {
  if (points.length < MIN_POINTS) {
    return undefined;
  }

  const slope = leastSquaresSlope(points);
  if (slope === undefined) {
    return undefined;
  }

  const first = points[0];
  const last = points[points.length - 1];
  return { slope, first, last, spanDays: last.tDays - first.tDays };
}

function formatSpan(spanDays: number): string {
  const rounded = Math.round(spanDays);
  if (rounded <= 0) {
    return "under a day";
  }
  return `${rounded} day${rounded === 1 ? "" : "s"}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function hrFinding(window: WindowPoint[]): TrendFinding | undefined {
  const result = regress(extractPoints(window, (p) => p.reading.hr));
  if (!result || result.slope < HR_SLOPE_THRESHOLD_BPM_PER_DAY) {
    return undefined;
  }

  return {
    id: "trend.hr.rising",
    metric: "hr",
    severity: "amber",
    description:
      `Resting heart rate has risen from ${result.first.value} to ${result.last.value} bpm ` +
      `over ${formatSpan(result.spanDays)} (+${round1(result.slope)} bpm/day).`,
  };
}

function spo2Finding(window: WindowPoint[]): TrendFinding | undefined {
  const result = regress(extractPoints(window, (p) => p.reading.spo2));
  if (!result || result.slope > SPO2_SLOPE_THRESHOLD_PCT_PER_DAY) {
    return undefined;
  }

  return {
    id: "trend.spo2.falling",
    metric: "spo2",
    severity: "amber",
    description:
      `Oxygen saturation has fallen from ${result.first.value}% to ${result.last.value}% ` +
      `over ${formatSpan(result.spanDays)} (${round1(result.slope)} %/day).`,
  };
}

function tempFinding(window: WindowPoint[]): TrendFinding | undefined {
  const result = regress(extractPoints(window, (p) => p.reading.tempC));
  if (!result || result.slope < TEMP_SLOPE_THRESHOLD_C_PER_DAY) {
    return undefined;
  }

  return {
    id: "trend.tempc.rising",
    metric: "tempC",
    severity: "amber",
    description:
      `Temperature has risen from ${result.first.value}\u00B0C to ${result.last.value}\u00B0C ` +
      `over ${formatSpan(result.spanDays)} (+${round1(result.slope)}\u00B0C/day).`,
  };
}

function painScoreFinding(window: WindowPoint[]): TrendFinding | undefined {
  const result = regress(extractPoints(window, (p) => p.symptoms.painScore));
  if (!result || result.slope < PAIN_SLOPE_THRESHOLD_PER_DAY) {
    return undefined;
  }

  return {
    id: "trend.pain_score.rising",
    metric: "painScore",
    severity: "amber",
    description:
      `Reported pain score has risen from ${result.first.value} to ${result.last.value} ` +
      `over ${formatSpan(result.spanDays)} (+${round1(result.slope)}/day).`,
  };
}

/**
 * Findings only — this function NEVER returns a Decision and never decides
 * an escalation level on its own. `phase` is accepted for signature
 * consistency with the rest of the clinical layer and future phase-aware
 * thresholds; the fixed per-day rate thresholds here are phase-independent
 * by design (a given rate of change is equally concerning at any recovery
 * stage), so it is not read.
 */
export function evaluateTrends(
  history: VitalsReading[],
  symptoms: Symptoms[],
  _phase: Phase,
): TrendFinding[] {
  const window = toWindow(history, symptoms);
  if (window.length < MIN_POINTS) {
    return [];
  }

  return [hrFinding(window), spo2Finding(window), tempFinding(window), painScoreFinding(window)].filter(
    (f): f is TrendFinding => f !== undefined,
  );
}
