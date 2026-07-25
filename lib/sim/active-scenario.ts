import type { Scenario } from "./fixtures";

/**
 * Process-local active demo scenario. The console selector writes here;
 * `/api/checkin` and `/api/triage` read it when falling back to fixtures
 * (no Supabase / empty tables). Single-process demo assumption — fine for
 * the hackathon stage box, not a multi-instance production store.
 */
let active: Scenario = "green";

export const SCENARIOS = ["green", "pe", "drift"] as const satisfies readonly Scenario[];

export const SCENARIO_META: Record<
  Scenario,
  { label: string; summary: string }
> = {
  green: {
    label: "Green",
    summary: "Well patient, POD 4 — nothing remarkable.",
  },
  pe: {
    label: "PE",
    summary: "Acute PE-pattern: hypoxic, tachycardic, ECG tachycardia.",
  },
  drift: {
    label: "Drift",
    summary: "In-range vitals; resting HR climbing ~3 bpm/day.",
  },
};

export function isScenario(value: unknown): value is Scenario {
  return value === "green" || value === "pe" || value === "drift";
}

export function getActiveScenario(): Scenario {
  return active;
}

export function setActiveScenario(scenario: Scenario): Scenario {
  active = scenario;
  return active;
}
