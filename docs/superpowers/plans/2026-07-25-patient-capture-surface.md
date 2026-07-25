# Patient Capture Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote Ops from a bottom Show/Hide drawer into a patient-scoped Capture page (`/clinician/[patientId]/capture`) with a slim chart strip, product care-pathway labels, and legacy `/console` + shortcut redirects to Margaret’s Capture.

**Architecture:** Extract `HubOpsPanel` into `PatientCapture` with `patientId` + `density: "full" | "strip"`. Full page is a clinical desk layout; chart embeds the strip. Care pathway still uses global `active-scenario` keys (`green`/`pe`/`drift`) with product labels. Vitals/ECG POST include `patientId`.

**Tech Stack:** Next.js App Router, existing clinician shell/roster, `/api/vitals` + `/api/ecg` + `/api/scenario` + `/api/checkin` + `/api/demo-status`, Vitest, Tailwind design tokens already in app.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-25-patient-capture-surface-design.md` — binding.
- Product language only on Capture UI — never “demo controls”, “demo phone”, or “Ops” as the surface name.
- Care pathway labels (verbatim): Stable recovery / Suspected PE pattern / Slow HR drift; keys stay `green` / `pe` / `drift`.
- Default capture URL: `/clinician/margaret-ellison/capture`.
- Pass `patientId` on vitals JSON and ECG FormData.
- deviceLabel for vitals: `Capture (operator)` (not “Clinician hub Ops”).
- Status OK: `Services connected`; bad: `Some services unavailable` + named gaps.
- Strip: vitals fields + Save + Choose PDF + Open capture — no pathway, no transcript, no `<details>`.
- Remove Ops drawers from Hub and Patients directory; chart drawer → strip.
- LLM never chooses escalation; synthetic data; US English; no Thymia.
- Prefer reuse of HubOpsPanel logic over rewrite; follow existing Panel/Button/cn patterns.
- Commit after each task; run focused tests then `npm test` before commit.
- Implementer model preference: Grok 4.5 (`cursor-grok-4.5-high-fast`).

---

## File structure

| Path | Role |
|---|---|
| `lib/ui/capture-route.ts` | `DEFAULT_CAPTURE_HREF`, `captureHref(patientId)` |
| `lib/ui/capture-route.test.ts` | Unit tests for helpers |
| `lib/sim/active-scenario.ts` | Update `SCENARIO_META` labels/summaries |
| `app/components/clinician/PatientCapture.tsx` | Shared Capture UI (`full` \| `strip`) |
| `app/clinician/[patientId]/capture/page.tsx` | Server page for Capture |
| `app/components/clinician/PatientChart.tsx` | Strip; remove Ops drawer + `#ops` open logic |
| `app/components/clinician/ClinicianHub.tsx` | Remove Ops drawer |
| `app/components/clinician/PatientsDirectory.tsx` | Remove Ops drawer |
| `app/components/clinician/Worklist.tsx` | Per-row Capture link |
| `app/console/page.tsx` | Redirect → `DEFAULT_CAPTURE_HREF` |
| `app/components/ConsoleShortcut.tsx` | Navigate → `DEFAULT_CAPTURE_HREF` |
| `app/components/landing/copy.ts` + `Integrations.tsx` | Ops → Capture copy/hrefs |
| `app/components/clinician/HubOpsPanel.tsx` | Delete after call sites gone (or thin re-export deleted in same task) |

---

### Task 1: Capture route helpers + care pathway labels + redirects

**Files:**
- Create: `lib/ui/capture-route.ts`
- Create: `lib/ui/capture-route.test.ts`
- Modify: `lib/sim/active-scenario.ts` (`SCENARIO_META` only)
- Modify: `app/console/page.tsx`
- Modify: `app/components/ConsoleShortcut.tsx`
- Ensure present on branch: `docs/superpowers/specs/2026-07-25-patient-capture-surface-design.md` and this plan file if missing

**Interfaces:**
- Produces:
  - `export const DEFAULT_CAPTURE_PATIENT_ID = "margaret-ellison"`
  - `export const DEFAULT_CAPTURE_HREF = "/clinician/margaret-ellison/capture"`
  - `export function captureHref(patientId: string): string` → `/clinician/${patientId}/capture`
- Consumes: none

- [ ] **Step 1: Write failing tests** in `lib/ui/capture-route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAPTURE_HREF,
  DEFAULT_CAPTURE_PATIENT_ID,
  captureHref,
} from "./capture-route";

describe("capture routes", () => {
  it("defaults to Margaret Capture", () => {
    expect(DEFAULT_CAPTURE_PATIENT_ID).toBe("margaret-ellison");
    expect(DEFAULT_CAPTURE_HREF).toBe("/clinician/margaret-ellison/capture");
  });

  it("builds a patient-scoped capture href", () => {
    expect(captureHref("margaret-ellison")).toBe(
      "/clinician/margaret-ellison/capture",
    );
    expect(captureHref("other-patient")).toBe("/clinician/other-patient/capture");
  });
});
```

Also add/adjust a small test in an existing active-scenario test file if one exists that asserts labels; otherwise add assertions in a new `lib/sim/active-scenario-meta.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SCENARIO_META } from "./active-scenario";

describe("SCENARIO_META care pathway labels", () => {
  it("uses product care-pathway names", () => {
    expect(SCENARIO_META.green.label).toBe("Stable recovery");
    expect(SCENARIO_META.pe.label).toBe("Suspected PE pattern");
    expect(SCENARIO_META.drift.label).toBe("Slow HR drift");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run lib/ui/capture-route.test.ts lib/sim/active-scenario-meta.test.ts
```

- [ ] **Step 3: Implement**

`lib/ui/capture-route.ts`:

```ts
export const DEFAULT_CAPTURE_PATIENT_ID = "margaret-ellison";

export const DEFAULT_CAPTURE_HREF =
  `/clinician/${DEFAULT_CAPTURE_PATIENT_ID}/capture` as const;

export function captureHref(patientId: string): string {
  return `/clinician/${patientId}/capture`;
}
```

Update `SCENARIO_META` in `lib/sim/active-scenario.ts`:

```ts
green: {
  label: "Stable recovery",
  summary: "Well patient, POD 4 — nothing remarkable.",
},
pe: {
  label: "Suspected PE pattern",
  summary: "Hypoxic, tachycardic; ECG tachycardia.",
},
drift: {
  label: "Slow HR drift",
  summary: "In-range vitals; resting HR climbing ~3 bpm/day.",
},
```

`app/console/page.tsx`:

```ts
import { redirect } from "next/navigation";
import { DEFAULT_CAPTURE_HREF } from "@/lib/ui/capture-route";

/** Legacy operator URL — Capture lives on the patient chart route. */
export default function ConsolePage() {
  redirect(DEFAULT_CAPTURE_HREF);
}
```

`ConsoleShortcut.tsx`: import `DEFAULT_CAPTURE_HREF`; push that URL; skip navigation if already on that pathname (ignore hash).

- [ ] **Step 4: Run tests — expect PASS**; `npm test`

- [ ] **Step 5: Commit**

```bash
git add lib/ui/capture-route.ts lib/ui/capture-route.test.ts lib/sim/active-scenario.ts lib/sim/active-scenario-meta.test.ts app/console/page.tsx app/components/ConsoleShortcut.tsx docs/superpowers/specs/2026-07-25-patient-capture-surface-design.md docs/superpowers/plans/2026-07-25-patient-capture-surface.md
git commit -m "$(cat <<'EOF'
feat: point console shortcut at patient Capture route

EOF
)"
```

---

### Task 2: `PatientCapture` component (full + strip)

**Files:**
- Create: `app/components/clinician/PatientCapture.tsx` (move/adapt from `HubOpsPanel.tsx`)
- Modify or delete: `app/components/clinician/HubOpsPanel.tsx` — temporarily re-export `PatientCapture` without patientId only if needed for compile; prefer deleting after Task 3–4 remove call sites. For this task, keep `HubOpsPanel` as:

```ts
export { PatientCapture as HubOpsPanel } from "./PatientCapture";
```

  only if Hub still imports it (it will until Task 4). `PatientCapture` must require `patientId`; re-export wrapper can hardcode Margaret for legacy compile OR Task 2 updates HubOpsPanel to accept optional patientId defaulting to Margaret — **prefer:** `HubOpsPanel` becomes:

```tsx
"use client";
import { DEFAULT_CAPTURE_PATIENT_ID } from "@/lib/ui/capture-route";
import { PatientCapture } from "./PatientCapture";
export function HubOpsPanel() {
  return <PatientCapture patientId={DEFAULT_CAPTURE_PATIENT_ID} density="full" />;
}
```

**Interfaces:**
- Consumes: `captureHref`, `SCENARIO_META`, existing APIs
- Produces:

```ts
export function PatientCapture(props: {
  patientId: string;
  density: "full" | "strip";
  /** Optional patient display for full header */
  patientName?: string;
  dayPostOp?: number;
  procedure?: string;
}): JSX.Element
```

- [ ] **Step 1: Implement `PatientCapture`** by adapting `HubOpsPanel.tsx`:

**Shared behavior (both densities):**
- Pass `patientId` in vitals JSON body and ECG `FormData` (`body.set("patientId", patientId)`).
- `deviceLabel: "Capture (operator)"`.
- Vitals fields + Save + ECG upload work in both densities.

**`density="full"` layout (clinical desk):**
1. Header: “Capture”; name/POD/procedure if provided; Link to `/clinician/${patientId}` (“Back to chart”).
2. Care pathway compact control — `aria-label="Care pathway"`; use `SCENARIO_META` labels (not “Scenario” / “demo scenario”).
3. Primary grid: Manual vitals | Kardia PDF.
4. Secondary: `BleHeartRate` | Check-in from transcript (retitle panel; soften copy to product language — stand-in for voice call; keep `/api/checkin` behavior).
5. Status: missing → “Some services unavailable” + gaps; else “Services connected — Anthropic, Supabase, voice, phone.” (no “demo phone”, no “Credentials wired — … demo phone”).

**`density="strip"` layout:**
- Single horizontal/banded card: compact vitals (2×2 or inline) + Save vitals + Choose PDF + Link “Open capture” → `captureHref(patientId)`.
- No pathway, no transcript, no BleHeartRate, no status essay (optional one-line error from actions only).

- [ ] **Step 2: Typecheck / lint the new file** — ensure Hub still compiles via thin `HubOpsPanel` wrapper.

- [ ] **Step 3: Run `npm test`**

- [ ] **Step 4: Commit**

```bash
git add app/components/clinician/PatientCapture.tsx app/components/clinician/HubOpsPanel.tsx
git commit -m "$(cat <<'EOF'
feat: extract PatientCapture with full and strip densities

EOF
)"
```

---

### Task 3: Capture page route

**Files:**
- Create: `app/clinician/[patientId]/capture/page.tsx`

**Interfaces:**
- Consumes: `findPatient`, `ClinicianShell`, `PatientCapture`, `captureHref` patterns from chart page
- Mirror metadata/notFound from `app/clinician/[patientId]/page.tsx`

- [ ] **Step 1: Create page**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClinicianShell } from "@/app/components/clinician/ClinicianShell";
import { PatientCapture } from "@/app/components/clinician/PatientCapture";
import { findPatient, rosterIds } from "@/lib/sim/roster";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ patientId: string }>;
}): Promise<Metadata> {
  const { patientId } = await params;
  const patient = findPatient(patientId);
  if (!patient) return { title: "Patient not found — Mend" };
  return {
    title: `Capture · ${patient.name} — Mend`,
    description: `Record vitals and ECG for ${patient.name}.`,
  };
}

export function generateStaticParams() {
  return rosterIds().map((patientId) => ({ patientId }));
}

export default async function PatientCapturePage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const patient = findPatient(patientId);
  if (!patient) notFound();

  return (
    <ClinicianShell
      active={`/clinician/${patient.id}`}
      crumbs={[
        { label: "Patients", href: "/clinician/patients" },
        { label: patient.name, href: `/clinician/${patient.id}` },
        { label: "Capture" },
      ]}
    >
      <div className="py-8">
        <PatientCapture
          patientId={patient.id}
          density="full"
          patientName={patient.name}
          dayPostOp={patient.dayPostOp}
          procedure={patient.procedure}
        />
      </div>
    </ClinicianShell>
  );
}
```

- [ ] **Step 2: Smoke** — `npx tsc --noEmit` or project’s usual check if available; `npm test`

- [ ] **Step 3: Commit**

```bash
git add app/clinician/[patientId]/capture/page.tsx
git commit -m "$(cat <<'EOF'
feat: add patient-scoped Capture page

EOF
)"
```

---

### Task 4: Wire chart strip; remove Ops drawers; worklist Capture links

**Files:**
- Modify: `app/components/clinician/PatientChart.tsx` — remove Ops `<details>` + `#ops` state/effects; render `<PatientCapture patientId={patient.id} density="strip" />` in a sensible place near top of chart (after header / before tabs is fine)
- Modify: `app/components/clinician/ClinicianHub.tsx` — remove Ops section, HubOpsPanel import, opsOpen state/effects entirely
- Modify: `app/components/clinician/PatientsDirectory.tsx` — same removal
- Modify: `app/components/clinician/Worklist.tsx` — add Capture column or inline link per row: `href={captureHref(patient.id)}` labeled “Capture”, `relative z-10` so it wins over the row’s stretched chart link (`after:absolute` on name link). Important: Capture link must not be covered by the row overlay — use `relative z-10` on the Capture `<Link>`.
- Delete: `app/components/clinician/HubOpsPanel.tsx` once no imports remain
- Modify comments in `app/clinician/page.tsx`, `app/clinician/patients/page.tsx` that mention Ops

**Worklist UX:** Add a final column “Capture” (desktop) with a text link; on mobile include `data-label="Capture"`.

- [ ] **Step 1: Apply wiring/removals**

- [ ] **Step 2: `rg HubOpsPanel` and `rg "Ops —"` must return no app component hits** (landing may still be Task 5)

- [ ] **Step 3: `npm test`**

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: chart Capture strip and remove Ops drawers

EOF
)"
```

---

### Task 5: Landing copy + final cleanup

**Files:**
- Modify: `app/components/landing/copy.ts` — Ops → Capture; point hrefs at `/clinician/margaret-ellison/capture` where Ops was implied
- Modify: `app/components/landing/Integrations.tsx` — “Ops → chart” / “Ops · Kardia PDF” → Capture wording
- Grep for remaining user-facing “Ops” in `app/` related to this surface; update presenter-facing strings only (do not rewrite historical plan docs)

- [ ] **Step 1: Update landing strings**

Example copy body: “Drop the Kardia export into Capture. Mend pulls the FDA-cleared determination…”

- [ ] **Step 2: `npm test`**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
docs: retitle landing Ops flows as Capture

EOF
)"
```

---

## Verification (manual, after all tasks)

1. `/clinician/margaret-ellison/capture` — full desk, pathway, vitals, ECG, BLE, transcript
2. Chart — strip visible; Open capture works; no Ops drawer
3. Hub + `/clinician/patients` — no Ops drawer; worklist Capture links work
4. `/console` + Ctrl/⌘⇧M → Margaret Capture
5. Network: vitals/ECG include `patientId`
6. Pathway switch still drives fixtures for family/call when DB empty
