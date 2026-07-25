# Mend — Patient Capture Surface

**Design spec · 2026-07-25**  
**Status:** Approved in conversation; awaiting implementation plan  
**Audience:** Operators driving the live clinician path; YC demo

---

## 1. Goal

Promote today’s bottom-of-page Ops drawer into a **first-class, patient-scoped Capture** surface: the place clinicians (and the live demo) record vitals, upload Kardia ECG PDFs, connect BLE heart rate, and optionally run a transcript check-in — framed as product, not demo plumbing.

**Success criteria**
- Dedicated route `/clinician/[patientId]/capture` feels primary, not a footer afterthought.
- Chart keeps a slim always-available Capture strip (vitals + ECG + link to full page).
- Hub and Patients directory no longer bury Ops in a Show/Hide drawer.
- Care pathway uses product labels (Stable recovery / Suspected PE pattern / Slow HR drift).
- `/console` and the keyboard shortcut land on Margaret’s Capture page.
- Vitals and ECG persist against the route’s `patientId`.
- No “demo controls” labeling anywhere on the surface.

---

## 2. Decisions (binding)

| Topic | Choice |
|---|---|
| Placement | Dedicated patient-scoped page |
| Framing | Hybrid clinical + pathway controls; product language only |
| Pathway labels | Care pathway names (keys remain `green` / `pe` / `drift`) |
| Patient scope | `/clinician/[patientId]/capture` |
| Chart Ops drawer | Replace with slim strip; full Capture remains the home |
| Hub / directory Ops | Remove drawers entirely |
| Layout | Clinical desk: header + compact pathway; vitals \| ECG primary; BLE \| transcript secondary |

---

## 3. Information architecture

### Routes
- **Primary:** `/clinician/[patientId]/capture`
- **Default live path:** `/clinician/margaret-ellison/capture`
- **Legacy:** `/console` redirects to Margaret’s Capture (not `/clinician#ops`)
- **Keyboard shortcut:** same as `/console`

### Shell
- Reuse `ClinicianShell`
- Breadcrumbs: `Patients → {Patient name} → Capture`
- Chart crumbs remain as today; add a clear **Open capture** entry from the chart

### Entry points
- Chart Capture strip CTA
- Chart header / actions link to Capture
- Patients directory: per-patient **Capture** link on each row (alongside opening the chart)
- Landing copy that currently says “Ops” → “Capture” and deep-link Margaret’s Capture

### Removals
- `<details>` Ops blocks on `ClinicianHub`, `PatientsDirectory`
- Full Ops `<details>` on `PatientChart` (replaced by strip)

---

## 4. Layout

### Full Capture page (`density="full"`)

1. **Header** — Title “Capture”; patient name; POD / procedure; link back to chart  
2. **Care pathway** — Compact control (not a giant demo tile hero): Stable recovery / Suspected PE pattern / Slow HR drift  
3. **Primary row** — Manual vitals | Kardia PDF upload  
4. **Secondary row** — BLE heart rate | Check-in from transcript  
5. **Status** — Quiet connection line: “Services connected” or “Some services unavailable” + named gaps  

### Chart strip (`density="strip"`)

Horizontal band on the patient chart only:
- Compact vitals fields (SpO₂, temp, SBP, DBP) + Save vitals
- Choose PDF
- **Open capture →** link to the full page  
- No pathway picker, no transcript, no Show/Hide drawer

---

## 5. Components & behavior

### Shared module
Refactor `HubOpsPanel` into a patient-aware Capture component (name e.g. `PatientCapture`) with:
- `patientId: string`
- `density: "full" | "strip"`

`HubOpsPanel` may remain as a thin re-export during migration, then be deleted once call sites are updated.

### API scoping
- Pass `patientId` on vitals and ECG requests (routes already accept optional `patientId`)
- Care pathway continues to read/write the existing **global** active scenario (`loadActiveScenario` / `persistActiveScenario`). No new per-patient pathway table in this pass.
- Check-in / transcript behavior unchanged functionally; UI copy reframed

### Redirects
- `/console` → `/clinician/margaret-ellison/capture`
- `ConsoleShortcut` → same URL
- Hash `#ops` no longer opens drawers; prefer Capture URL if any legacy links remain

### Landing / docs touch-ups (in scope if they still say Ops)
- `app/components/landing/Integrations.tsx` and `copy.ts`: Ops → Capture wording and href
- Comments / handoff lines that instruct presenters to open hub Ops → Capture

---

## 6. Product copy

### Care pathway (`SCENARIO_META`)

| Key | Label | Summary |
|---|---|---|
| `green` | Stable recovery | Well patient, POD 4 — nothing remarkable. |
| `pe` | Suspected PE pattern | Hypoxic, tachycardic; ECG tachycardia. |
| `drift` | Slow HR drift | In-range vitals; resting HR climbing ~3 bpm/day. |

### Surface strings
- Page title: **Capture**
- Pathway control aria/label: **Care pathway**
- Vitals: keep operator-device labelling (safety)
- ECG: keep FDA-cleared determination / Mend never re-derives rhythm from waveform
- Status OK: **Services connected** (Anthropic, Supabase, voice, phone — no “demo phone”)
- Status bad: **Some services unavailable** + named gaps
- Transcript panel: **Check-in from transcript** (stand-in for the voice call)
- Strip CTA: **Open capture**

### Errors
Keep named API failure messages; no silent failures.

---

## 7. Non-goals

- Per-patient durable care pathway in Supabase
- New clinical rules, Thymia, or RTM features
- Redesigning Hub action board / Needs Attention beyond removing Ops drawer
- Rebuilding `/console` as a separate mission-control app
- Visual companion / design-system overhaul beyond Capture chrome

---

## 8. Verification

- Visit `/clinician/margaret-ellison/capture` — full desk layout, pathway, vitals, ECG, BLE, transcript
- From chart: strip visible; **Open capture** navigates correctly; no Ops Show/Hide drawer
- Hub and `/clinician/patients`: no Ops drawer
- `/console` and shortcut → Margaret Capture
- Save vitals / upload ECG with network tab showing `patientId` for that patient
- Switch care pathway; family/call/check-in still honor active scenario fixtures when DB empty
- `npm test` green for any touched unit tests (scenario meta, shortcut target if tested)

---

## 9. Implementation notes (for plan)

Suggested file touch list (non-exhaustive):
- `app/clinician/[patientId]/capture/page.tsx` (new)
- `app/components/clinician/PatientCapture.tsx` (new; from `HubOpsPanel`)
- `app/components/clinician/PatientChart.tsx` — strip; remove drawer
- `app/components/clinician/ClinicianHub.tsx` — remove Ops
- `app/components/clinician/PatientsDirectory.tsx` — remove Ops; optional Capture link
- `app/console/page.tsx` — redirect target
- `app/components/ConsoleShortcut.tsx` — redirect target
- `lib/sim/active-scenario.ts` — `SCENARIO_META` labels
- Landing copy/integrations Ops → Capture
- Tests for shortcut / meta if present
