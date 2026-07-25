import type { Scenario } from "./fixtures";

/**
 * Process-local active demo scenario. The console selector writes here;
 * `/api/checkin`, `/api/triage`, `/family`, and `/call` read it when no
 * explicit query param overrides (and APIs fall back to fixtures with no
 * Supabase / empty tables).
 *
 * Stored on `globalThis` so Next.js's separate bundles for Route Handlers
 * and Server Components share one value in the same Node process. A plain
 * module `let` silently forks into two stores under Turbopack/webpack —
 * the console would update one and `/family` would read the other.
 * Still a single-process demo assumption, not a multi-instance production
 * store.
 */

const GLOBAL_KEY = "__mendActiveScenario" as const;

type MendGlobal = typeof globalThis & {
  [GLOBAL_KEY]?: Scenario;
};

function store(): MendGlobal {
  return globalThis as MendGlobal;
}

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
  return store()[GLOBAL_KEY] ?? "green";
}

export function setActiveScenario(scenario: Scenario): Scenario {
  store()[GLOBAL_KEY] = scenario;
  return scenario;
}
