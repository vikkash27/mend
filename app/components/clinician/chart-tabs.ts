export type ChartTabId =
  | "overview"
  | "readings"
  | "handoff"
  | "billing"
  | "audit";

export const CHART_TABS = [
  { id: "overview", label: "Overview" },
  { id: "readings", label: "Readings & trends" },
  { id: "handoff", label: "Handoff" },
  { id: "billing", label: "Billing" },
  { id: "audit", label: "Audit" },
] as const satisfies ReadonlyArray<{ id: ChartTabId; label: string }>;

const TAB_IDS = new Set<string>(CHART_TABS.map((t) => t.id));

export function parseChartTab(raw: string | null | undefined): ChartTabId {
  if (raw && TAB_IDS.has(raw)) return raw as ChartTabId;
  return "overview";
}

export function chartTabHref(patientId: string, tab: ChartTabId): string {
  const base = `/clinician/${patientId}`;
  return tab === "overview" ? base : `${base}?tab=${tab}`;
}
