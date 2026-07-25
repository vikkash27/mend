# Mend — Clinician EHR Workspace

**Design spec · 2026-07-25**  
**Goal:** Make the clinician surface feel like a methodical hospital system — dashboard + actions on the hub, then dig into patients via a tabbed chart with persistent roster on large screens.  
**Approved approach:** Restructure in place (reuse routes, Live/Ops wiring, and chart components); densify chrome toward a utilitarian EHR look.

---

## 1. Product decisions (approved)

| Decision | Choice |
|---|---|
| Primary workflow | Worklist-first EHR **plus** dashboard/actions landing |
| Hub landing | Action board (summary, needs-attention shortlist, Call now / Family / Ops) **+** full worklist below; **no** side-by-side chart pane |
| Patient chart tabs | Overview · Readings & trends · Handoff · Billing · Audit |
| Roster while viewing patient | Hybrid: persistent left roster at `xl+`; full-width chart below `xl` |
| Live check-in | Mode of the chart pane (hub Call now and patient Call now); sticky strip if clinician leaves |
| Ops | Collapsed disclosure on **hub and patient** workspace; `#ops` still opens it |
| Visual depth | Fuller EHR densification (utilitarian app bar, tab bar, tighter panels) on Mend tokens |
| Architecture | Restructure in place — keep `/clinician`, `/clinician/[patientId]`, engine, Live APIs |

---

## 2. Goal & success criteria

**Success**
- `/clinician` reads as a clinical command board: what needs attention, what to do next, who is on the panel — not a pile of competing panels.
- Selecting a patient opens a tabbed chart where each clinical question has one place.
- On a laptop/projector (`xl+`), switching patients is one click in the left roster without losing chart context.
- Call now still embeds Live via existing `CallStage` hub variant; Ops remains reachable for the demo without dominating the UI.
- Fixtures still render with no credentials; educational disclaimer remains on every clinician surface.

---

## 3. Information architecture

### 3.1 Routes

| Route | Role |
|---|---|
| `/clinician` | Hub landing — action board + needs-attention + full worklist + Ops |
| `/clinician/[patientId]?tab=` | Patient workspace — tabbed chart; roster column at `xl+` |
| `/clinician/engine` | Rule engine vignette suite (unchanged content) |

Shell nav remains **Hub · Rule engine**. Live and Ops are not peer nav destinations.

### 3.2 Hub landing stack (top → bottom)

1. Dense app header (clinic context, date, persistence source)
2. **Action board** — `PracticeSummary` + Call now / Open family + Twilio trial tip
3. **Needs attention** — shortlist of red/amber patients (worst first), each linking to that patient’s Overview tab
4. **Full worklist** — row click navigates to `/clinician/[id]` (default tab Overview)
5. **Ops** disclosure (`#ops` / `Ctrl⌘⇧M` behavior preserved)

Remove the current side-by-side “chart summary” pane from the hub. Digging in always means opening the patient workspace.

### 3.3 Patient workspace

**Header:** name, age, procedure, day/phase, caregiver, open escalations, severity chip, **Call now**.

**Tabs** (`?tab=` values):

| Tab | `tab` param | Contents (reuse existing components) |
|---|---|---|
| Overview | `overview` (default) | Severity + action, latest reading snapshot, envelope / rehab / precautions |
| Readings & trends | `readings` | Trend charts + phase-envelope framing copy |
| Handoff | `handoff` | SBAR + chart notes |
| Billing | `billing` | BillingPanel |
| Audit | `audit` | Check-in history / DecisionAudit |

**Live mode:** When a call is active and focused, the main pane shows embedded `CallStage` (`variant="hub"`) instead of tabs. “Show chart” returns to the active tab. `LiveCallStrip` in the shell covers navigation away (e.g. Rule engine).

**Call now from hub:** Because the hub has no chart pane, placing a call navigates to the demo patient’s chart (`pickDefaultPatientId` / Margaret) with Live focused (`?live=1` or equivalent). Call now from the patient workspace swaps that workspace’s pane in place — no extra navigation.

**Ops:** Same collapsed disclosure at the bottom of the patient workspace as on the hub.

**Responsive roster**
- `xl+`: left worklist (selected row highlighted) + right tabbed chart
- below `xl`: full-width chart; “Back to hub” (and optional patient switcher if already present patterns allow — not required)

---

## 4. Visual chrome (EHR densification)

Stay on Mend design tokens (paper/ink, severity via `lib/ui/severity.ts`, Inter for machine data). Do **not** invent a second colour system or fake hospital logos.

Changes vs current “marketing-dense” hub:
- Stronger sticky **app bar**: logo + Clinician + clinic name + nav; meta (date / data source) right; less lede copy on hub
- **Patient header bar** on chart routes under the app bar
- **Tab bar** as underline/segment control — one active pane, not a vertical card pile
- Tighter panels: smaller radii / hairline borders; reduce serif marketing prose on hub; keep serif for SBAR / human voice in Handoff
- Worklist remains a clinical table; needs-attention is a compact priority strip

Binding UI rules unchanged:
- Severity never conveyed by colour alone
- Medical advice disclaimer on every clinician surface
- US English (ER, 911, care team, nurse line)
- Synthetic patients only — no PHI claims

---

## 5. Components & wiring

| Piece | Responsibility |
|---|---|
| `ClinicianShell` | Denser EHR header; host LiveCallStrip; optional breadcrumb / patient context |
| `ClinicianHub` | Hub-only composition: ActionBoard + NeedsAttention + Worklist + Ops (no side chart) |
| `ActionBoard` (new or extracted) | PracticeSummary + Call now / Family + Twilio tip + call status |
| `NeedsAttention` (new) | Filter/sort red+amber from roster; link into chart |
| `PatientChart` (new client) | Tabs, Live pane swap, Call now, Ops; composes existing panels |
| `/clinician/[patientId]/page.tsx` | Server load patient (+ roster for xl sidebar); render PatientChart |
| Tab state | URL `?tab=` so deep links and refresh preserve view |
| Live / call APIs | Unchanged (`POST /api/call`, `live-call` store, `CallStage` hub variant) |
| Ops | Reuse `HubOpsPanel`; mount on hub and patient |

No new clinical engine features, auth, multi-tenant, or clinician–patient chat.

---

## 6. Safety & constraints (binding)

Inherited from product global constraints:
1. LLM never chooses escalation — only `evaluate()`.
2. Fail-safe toward escalation.
3. Synthetic patient data; operator device readings labelled.
4. “Educational prototype — not medical advice” on clinician surfaces.
5. US market terms only.
6. Mend does not re-derive ECG rhythm.
7. TypeScript strict; no `any` in `lib/clinical/**`.

---

## 7. Out of scope

- New clinical rules, Thymia, RTM adherence fields
- Real auth / multi-clinic tenancy
- True cross-device Live sync beyond existing sessionStorage live-call
- Redesigning `/family`, `/call` stage, or landing product theater
- Replacing Twilio trial UX copy

---

## 8. Verification

- Hub shows action board + needs-attention + worklist; no giant side chart summary
- Patient workspace exposes five tabs; default Overview; `?tab=` works
- Roster persists beside chart at `xl+`; full-width + back link below `xl`
- Call now from hub → navigates to default patient chart in Live mode; Call now from patient → Live pane in place; strip when navigating away; Ops on both; `#ops` opens Ops
- Fixtures render without Supabase/Anthropic
- `npm test` and `npx tsc --noEmit` green after changes
- Visual check: `/clinician` and `/clinician/<margaret-id>` at projector and phone widths

---

## 9. Relationship to prior specs

Supersedes the **layout** portions of the hub that assumed a side-by-side chart summary on `/clinician` (see `2026-07-25-clinician-hub-platform-design.md` §3.1 idle main pane). Live strip, Call now, Ops demotion, and patient portal decisions from that spec remain in force unless contradicted above.
