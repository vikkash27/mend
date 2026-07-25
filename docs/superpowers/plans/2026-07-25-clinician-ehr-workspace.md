# Clinician EHR Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `/clinician` into a dashboard + worklist hub and `/clinician/[patientId]` into a tabbed EHR patient workspace with denser clinical chrome, without breaking Live/Ops demo wiring.

**Architecture:** Pure helpers for tab parsing and needs-attention selection; hub becomes ActionBoard + NeedsAttention + Worklist + Ops (no side chart); patient page hosts a client `PatientChart` (tabs, Live pane, Call now, Ops) with a persistent roster column at `xl+`. Call now from hub navigates to Margaret’s chart in Live mode. Shell and LiveCallStrip update for the new Live home.

**Tech Stack:** Next.js App Router, existing clinician components (`Worklist`, `SbarCard`, `LatestReading`, `TrendChart`, `BillingPanel`, `DecisionAudit`, `HubOpsPanel`, `CallStage`), `live-call` store, Vitest, Tailwind tokens from `app/globals.css`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-25-clinician-ehr-workspace-design.md` — binding.
- LLM never chooses escalation; only `evaluate()` in `lib/clinical/red-flag-engine.ts`.
- Fail-safe toward escalation; synthetic data only; medical-advice disclaimer on clinician surfaces.
- US English only (ER, 911, care team, nurse line).
- Severity never by colour alone — use `SeverityChip` / `SeverityPanel` from `lib/ui/severity.ts`.
- Twilio trial keypress tip wherever a call is placed.
- No Thymia / RTM adherence fields; no real auth; no fake hospital logos.
- TypeScript strict; no `any` in `lib/clinical/**`.
- Prefer reuse over rewrite of chart body components.
- Verify `git branch --show-current` before every commit.

---

## File structure

| Path | Role |
|---|---|
| `app/components/clinician/chart-tabs.ts` | Tab id type, labels, `parseChartTab`, `chartTabHref` |
| `app/components/clinician/chart-tabs.test.ts` | Unit tests for tab parsing / hrefs |
| `app/components/clinician/needs-attention.ts` | `pickNeedsAttention(patients, limit)` |
| `app/components/clinician/needs-attention.test.ts` | Unit tests for shortlist |
| `app/components/clinician/NeedsAttention.tsx` | Priority strip UI |
| `app/components/clinician/ActionBoard.tsx` | PracticeSummary + Call now / Family + Twilio tip |
| `app/components/clinician/PatientChart.tsx` | Client: tabs, Live mode, Call now, Ops, patient header |
| `app/components/clinician/ClinicianHub.tsx` | Hub-only composition (no side chart) |
| `app/components/clinician/ClinicianShell.tsx` | Denser EHR app bar |
| `app/components/clinician/LiveCallStrip.tsx` | Return → default patient `?live=1`; hide on live pane |
| `app/clinician/[patientId]/page.tsx` | Server: roster + patient → layout + PatientChart |
| `app/clinician/page.tsx` | Unchanged data load; thinner hub |
| `docs/demo-runbook.md` | Hub → patient chart → Live sequence tweak if needed |

---

### Task 1: Chart tab helpers

**Files:**
- Create: `app/components/clinician/chart-tabs.ts`
- Create: `app/components/clinician/chart-tabs.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:

```ts
export type ChartTabId =
  | "overview"
  | "readings"
  | "handoff"
  | "billing"
  | "audit";

export const CHART_TABS: ReadonlyArray<{ id: ChartTabId; label: string }>;

export function parseChartTab(raw: string | null | undefined): ChartTabId;
export function chartTabHref(patientId: string, tab: ChartTabId): string;
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { chartTabHref, parseChartTab } from "./chart-tabs";

describe("parseChartTab", () => {
  it("defaults to overview for null/unknown", () => {
    expect(parseChartTab(null)).toBe("overview");
    expect(parseChartTab("nope")).toBe("overview");
  });

  it("accepts known tabs", () => {
    expect(parseChartTab("readings")).toBe("readings");
    expect(parseChartTab("handoff")).toBe("handoff");
    expect(parseChartTab("billing")).toBe("billing");
    expect(parseChartTab("audit")).toBe("audit");
  });
});

describe("chartTabHref", () => {
  it("omits query for overview", () => {
    expect(chartTabHref("margaret-ellison", "overview")).toBe(
      "/clinician/margaret-ellison",
    );
  });

  it("adds tab query for non-default tabs", () => {
    expect(chartTabHref("margaret-ellison", "billing")).toBe(
      "/clinician/margaret-ellison?tab=billing",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/components/clinician/chart-tabs.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/components/clinician/chart-tabs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/components/clinician/chart-tabs.ts app/components/clinician/chart-tabs.test.ts
git commit -m "$(cat <<'EOF'
feat(clinician): add chart tab helpers for patient workspace

EOF
)"
```

---

### Task 2: Needs-attention shortlist helper

**Files:**
- Create: `app/components/clinician/needs-attention.ts`
- Create: `app/components/clinician/needs-attention.test.ts`

**Interfaces:**
- Consumes: `RosterPatient` shape `{ id: string; latest: { decision: { level: Severity } } }` (minimal)
- Produces:

```ts
export function pickNeedsAttention<
  T extends { latest: { decision: { level: "green" | "amber" | "red" } } },
>(patients: ReadonlyArray<T>, limit = 5): T[];
```

Assumes `patients` are already severity-sorted (as `buildRoster` returns). Filters to `red` and `amber` only, then `slice(0, limit)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { pickNeedsAttention } from "./needs-attention";

function p(id: string, level: "green" | "amber" | "red") {
  return { id, latest: { decision: { level } } };
}

describe("pickNeedsAttention", () => {
  it("keeps only red and amber, in given order, up to limit", () => {
    const input = [
      p("a", "red"),
      p("b", "amber"),
      p("c", "green"),
      p("d", "amber"),
    ];
    expect(pickNeedsAttention(input, 2).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("returns empty when panel is all green", () => {
    expect(pickNeedsAttention([p("a", "green")], 5)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/components/clinician/needs-attention.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```ts
type Level = "green" | "amber" | "red";

export function pickNeedsAttention<
  T extends { latest: { decision: { level: Level } } },
>(patients: ReadonlyArray<T>, limit = 5): T[] {
  return patients
    .filter((p) => p.latest.decision.level !== "green")
    .slice(0, Math.max(0, limit));
}
```

- [ ] **Step 4: Run tests PASS**

Run: `npx vitest run app/components/clinician/needs-attention.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/components/clinician/needs-attention.ts app/components/clinician/needs-attention.test.ts
git commit -m "$(cat <<'EOF'
feat(clinician): add needs-attention shortlist helper

EOF
)"
```

---

### Task 3: NeedsAttention UI + ActionBoard

**Files:**
- Create: `app/components/clinician/NeedsAttention.tsx`
- Create: `app/components/clinician/ActionBoard.tsx`
- Modify: `app/components/clinician/ClinicianHub.tsx` (wire these; strip side chart — full strip in Task 4 if needed, but prefer finishing hub shape here)

**Interfaces:**
- Consumes: `pickNeedsAttention`, `chartTabHref`, `PracticeSummary`, `pickDefaultPatientId`, `startLiveCall`, Button, existing CallStatus pattern from hub
- Produces:
  - `<NeedsAttention patients={RosterPatient[]} />` — links via `chartTabHref(id, "overview")`
  - `<ActionBoard patients={RosterPatient[]} onCallPlaced?: () => void />` — Call now posts `/api/call`, `startLiveCall`, then `router.push(`/clinician/${id}?live=1`)` where `id = pickDefaultPatientId(patients)`

**ActionBoard Call now behavior (binding):**

```ts
const id = pickDefaultPatientId(patients);
// after successful startLiveCall(...)
if (id) router.push(`/clinician/${id}?live=1`);
```

Include Twilio trial tip and Open family → `/family` (same copy as current hub strip).

**NeedsAttention UI:** Compact bordered list (not a card pile of marketing). Each row: name, procedure/day, `SeverityChip`, link to Overview. If empty: one meta line “No patients need attention right now.”

- [ ] **Step 1: Implement `NeedsAttention.tsx` and `ActionBoard.tsx`** using the patterns above; extract CallStatus helper into ActionBoard or a tiny shared local function copied from current `ClinicianHub` (keep identical messages).
- [ ] **Step 2: Slim `ClinicianHub`** to:

```
header (title + date/persistence)
<ActionBoard patients={patients} />
<NeedsAttention patients={patients} />
Worklist (no onSelect — use default Link navigation)
Ops disclosure (unchanged #ops behavior)
footer note
```

Remove: side-by-side `ChartSummary`, `focusLive` / embedded `CallStage` on hub, selectedId state for chart. Keep Ops `#ops` hash effect.

Worklist usage:

```tsx
<Worklist patients={patients} now={now} />
```

(no `selectedId` / `onSelect` — rows navigate via existing `Link`)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add app/components/clinician/NeedsAttention.tsx app/components/clinician/ActionBoard.tsx app/components/clinician/ClinicianHub.tsx
git commit -m "$(cat <<'EOF'
feat(clinician): hub action board and needs-attention shortlist

EOF
)"
```

---

### Task 4: PatientChart client workspace (tabs + Live + Ops)

**Files:**
- Create: `app/components/clinician/PatientChart.tsx`
- Modify: `app/clinician/[patientId]/page.tsx`
- Modify: `app/components/clinician/LiveCallStrip.tsx`

**Interfaces:**
- Consumes: `parseChartTab`, `CHART_TABS`, `chartTabHref`, `CallStage`, live-call store, existing chart panels (`SeverityPanel`, `LatestReading`, `SbarCard`, `ChartNotes`, `TrendChart` + `buildTrendSeries` / `TREND_METRICS`, `BillingPanel`, `DecisionAudit`, envelope/rehab/precautions blocks from current page), `HubOpsPanel`, `Worklist` (for xl sidebar — may live in page instead)
- Produces: `<PatientChart patient={RosterPatient} patients={RosterPatient[]} nowIso={string} callStageProps={...} initialTab={ChartTabId} initialLiveFocus={boolean} />`

**PatientChart behavior:**
1. Patient header: identity meta + severity chip + Call now (in-place Live; do **not** navigate away).
2. Tab bar: `Link` or `router.replace` to `chartTabHref(patient.id, tab)`; `aria-current` on active.
3. Tab panels — move JSX from current `[patientId]/page.tsx` into switches:
   - `overview` — SeverityPanel + LatestReading + envelope/rehab/precautions grid
   - `readings` — trends section (heading + charts)
   - `handoff` — SBAR Panel + ChartNotes
   - `billing` — BillingPanel
   - `audit` — DecisionAudit list
4. Live: if `liveActive && focusLive`, show `CallStage variant="hub"` instead of tabs; “Show chart” clears focus (`setFocusLive(false)` + `router.replace` without `live=1`).
5. `useEffect`: if `initialLiveFocus && liveActive` → `setFocusLive(true)`; if `liveActive` becomes true while on this page after Call now → `setFocusLive(true)`.
6. Ops disclosure at bottom (same `#ops` pattern as hub — listen for hash).
7. Below `xl`: show “Back to hub” link to `/clinician`. At `xl+`: page wraps with left `Worklist` (`selectedId={patient.id}`, `onSelect` → `router.push(chartTabHref(id, activeTab))`).

**Page layout (`[patientId]/page.tsx`):**

```tsx
const patients = buildRoster(now);
const patient = findPatient(patientId, now);
// read searchParams tab + live
<ClinicianShell active="/clinician" breadcrumb={patient.name}>
  <div className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
    <aside className="hidden xl:block">
      <Worklist ... selectable ... />
    </aside>
    <PatientChart ... />
  </div>
</ClinicianShell>
```

Page must be able to read `searchParams` (`tab`, `live`). Use Next.js page props `searchParams: Promise<{ tab?: string; live?: string }>`.

**LiveCallStrip updates:**
- Import `pickDefaultPatientId` — for href use preferred id `"margaret-ellison"` (constant already in hub-selection) even without roster: `const returnHref = `/clinician/margaret-ellison?live=1``.
- Hide strip when live pane is showing: pathname matches `/clinician/[id]` **and** (`useSearchParams().get("live") === "1"` OR pathname is patient chart — actually only hide when `live=1` so Overview-during-call still shows strip **or** rely on in-chart banner). Spec: strip when away from live pane. So:

```ts
const params = useSearchParams();
const onPatientLive =
  /^\/clinician\/[^/]+$/.test(pathname) && params.get("live") === "1";
if (!active || onPatientLive) return null;
// Remove old: pathname === "/clinician" hide
// Return link: `/clinician/margaret-ellison?live=1`
```

When Call now focuses Live without keeping `?live=1` in the URL, also `router.replace` to add `live=1` so the strip stays hidden and deep links work.

- [ ] **Step 1: Create `PatientChart.tsx`** moving tab bodies from the current patient page; wire Call now + Live + Ops + tabs.
- [ ] **Step 2: Rewrite `[patientId]/page.tsx`** to load roster + searchParams and compose sidebar + PatientChart. Pass `callStageProps` via `loadCallStageProps()` (same as hub page).
- [ ] **Step 3: Update `LiveCallStrip`** return href + hide condition.
- [ ] **Step 4: Run**

```bash
npx tsc --noEmit
npx vitest run app/components/clinician/
```

Expected: clean / PASS

- [ ] **Step 5: Commit**

```bash
git add app/components/clinician/PatientChart.tsx app/clinician/\[patientId\]/page.tsx app/components/clinician/LiveCallStrip.tsx
git commit -m "$(cat <<'EOF'
feat(clinician): tabbed patient chart with live mode and roster

EOF
)"
```

---

### Task 5: Densify ClinicianShell EHR chrome

**Files:**
- Modify: `app/components/clinician/ClinicianShell.tsx`
- Optionally tighten `Panel` radius classes used on clinician surfaces (same file)

**Visual changes (binding from spec §4):**
- App bar: keep sticky; make nav feel like EHR tabs (slightly stronger selected wash); show “Ridgeview Orthopedics · nurse line” as clinic context near brand (visible from `md` up, not only `lg`).
- Reduce vertical padding on header; keep 44px touch targets on nav links.
- `Panel`: use `rounded-lg` instead of `rounded-xl` for denser clinical cards (clinician-only — this component is clinician-scoped).
- Do **not** change family/call design tokens globally.

No new fonts. Keep MendLogo lockup.

- [ ] **Step 1: Apply shell densification** in `ClinicianShell.tsx` as above.
- [ ] **Step 2: Smoke**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add app/components/clinician/ClinicianShell.tsx
git commit -m "$(cat <<'EOF'
style(clinician): densify shell toward EHR app chrome

EOF
)"
```

---

### Task 6: Demo runbook + end-to-end verification

**Files:**
- Modify: `docs/demo-runbook.md` (hub-first sequence: open hub → pick patient / Call now lands on Margaret Live → tabs for dig-deeper → engine)

**Verification checklist (run and record):**
1. `/clinician` — action board, needs-attention, full worklist; **no** side chart summary
2. Click worklist row → `/clinician/<id>` Overview tab
3. Switch tabs via UI; URL `?tab=` updates; refresh preserves tab
4. At `xl+` width, roster sidebar switches patients keeping current tab when using `onSelect` → `chartTabHref(id, activeTab)`
5. Call now from hub → navigates to Margaret + Live; strip hidden on live pane; strip appears on `/clinician/engine`
6. Call now from patient → Live in place; Show chart returns
7. `#ops` on hub and patient opens Ops
8. `npx tsc --noEmit` clean
9. `npm test` green (or at least clinician + related suites)

- [ ] **Step 1: Update runbook** stage steps that still say hub has embedded live beside worklist — point Call now at patient Live; tabs for dig-deeper.
- [ ] **Step 2: Run full verification commands**

```bash
npx tsc --noEmit
npm test
```

Expected: tsc clean; vitest suite green

- [ ] **Step 3: Commit**

```bash
git add docs/demo-runbook.md
git commit -m "$(cat <<'EOF'
docs: align demo runbook with EHR clinician workspace

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| Hub action board + shortlist + worklist, no side chart | 3 |
| Five patient tabs + `?tab=` | 1, 4 |
| Hybrid roster `xl+` | 4 |
| Live mode of chart pane; hub Call now → Margaret Live | 3, 4 |
| Ops on hub and patient; `#ops` | 3, 4 |
| EHR densification of shell | 5 |
| Live strip return path updated | 4 |
| Runbook / verification | 6 |
| No new clinical engine / auth / Thymia | respected (out of scope) |

## Placeholder scan

None intentionally left. Implementers must not invent new clinical fields or parallel console.

## Type consistency

- `ChartTabId` / `parseChartTab` / `chartTabHref` defined in Task 1; used in Tasks 3–4.
- `pickNeedsAttention` Task 2 → `NeedsAttention` Task 3.
- Default patient id remains `margaret-ellison` via `pickDefaultPatientId`.
- Live return href uses `/clinician/margaret-ellison?live=1`.
