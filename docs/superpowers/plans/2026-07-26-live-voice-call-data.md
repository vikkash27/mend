# Live Voice Call Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. REQUIRED: Follow superpowers:test-driven-development (red → green → refactor) on every task that changes production code.

**Goal:** Make `/call` and the clinician chart functional with real ElevenLabs transcript turns and ~15s Amplifier biomarker snapshots during a live call, plus a deeper post-call analyze that updates call logs and biomarker-linked patient surfaces—while keeping the existing CallStage style and Margaret fixture fallback.

**Architecture:** A server-side live-session store is the source of truth. `POST /api/call` registers a session; clients poll `GET /api/live-call` every 2–3s; the server coalesces a ~15s tick that refreshes ElevenLabs turns + Amplifier `phase: "during"` snapshots. Call end runs the existing fuller analyze as `phase: "final"` and persists to `checkins`. Idle / missing keys keep the scripted Margaret timeline.

**Tech Stack:** Next.js App Router, Vitest, existing ElevenLabs ConvAI REST, Amplifier REST (`lib/amplifier/*`), Supabase `checkins` when available, TypeScript strict, Framer Motion CallStage UI.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-26-live-voice-call-data-design.md` — binding.
- Amplifier bundles: `respiratory` + `cognitive` only. No sentiment vendor. No Thymia.
- Mid-call `/api/triage` stays symptoms/vitals-only (do not wait on Amplifier).
- During-call Amplifier is REST upload + job poll every ~15s (`phase: "during"`); never WebSocket streaming.
- Post-call analyze (`phase: "final"`) is authoritative for persisted decision changes.
- Fail-open: missing/failed Amplifier never invents escalation; never demote severity on voice alone (`analyze-checkin.ts` rules).
- LLM never chooses escalation; only `evaluate()` / `composeDecision()`.
- Synthetic patient data; US English; “not medical advice” unchanged.
- Family surface: severity/script only — no Amplifier jargon.
- Maintain CallStage visual language — no redesign, no card-heavy chrome.
- TypeScript strict; no `any` in `lib/clinical/**`, `lib/amplifier/**`, `lib/telephony/**`.
- No real network in unit tests — inject `fetch`.
- Commit after each task; run focused tests then `npm test` before commit when practical.
- Work on branch `cursor/live-voice-call-data-333c` (already created).

---

## File structure

| Path | Role |
|---|---|
| `lib/amplifier/types.ts` | Add optional `phase?: "during" \| "final"` on `VoiceBiomarkersRecord` |
| `lib/telephony/live-session.ts` | In-memory live session store + tick coalescing helpers |
| `lib/telephony/live-session.test.ts` | Store/tick unit tests |
| `lib/telephony/elevenlabs-conversation.ts` | GET conversation details → turns + status |
| `lib/telephony/elevenlabs-conversation.test.ts` | Conversation fetch tests |
| `lib/amplifier/analyze-live-snapshot.ts` | During-call audio → Amplifier → record with `phase: "during"` (no decision mutation) |
| `lib/amplifier/analyze-live-snapshot.test.ts` | Snapshot orchestration tests |
| `lib/telephony/live-tick.ts` | Orchestrate one tick: conversation + optional snapshot |
| `lib/telephony/live-tick.test.ts` | Tick coalescing / ended detection |
| `lib/telephony/call-log.ts` | Build compact/full call-log rows from checkins + active session |
| `lib/telephony/call-log.test.ts` | Call log mapping tests |
| `app/api/live-call/route.ts` | `GET` poll + schedule tick; optional `POST` force tick |
| `app/api/live-call/route.test.ts` | API tests |
| `app/api/call/route.ts` | Register live session on successful outbound |
| `lib/amplifier/analyze-checkin.ts` | Set `phase: "final"` on ready records |
| `app/components/call/live-turns.ts` | Map live turns → `CallEvent[]` for TranscriptStream |
| `app/components/call/live-turns.test.ts` | Mapping tests |
| `app/components/call/use-live-call-feed.ts` | Client poll hook for `/api/live-call` |
| `app/components/call/LiveBiomarkersReadout.tsx` | Compact Amplifier readout matching CallStage style |
| `app/components/call/CallLogCompact.tsx` | Compact recent calls on `/call` |
| `app/components/call/CallStage.tsx` | Switch fixture ↔ live feed; mount compact log |
| `app/components/clinician/CallHistory.tsx` | Full call history on chart |
| `app/components/clinician/PatientChart.tsx` | Mount CallHistory; refresh biomarkers from live/final |
| `app/components/clinician/VoiceBiomarkersPanel.tsx` | Show `phase` label when present |
| `docs/demo-runbook.md` | Short note on live `/call` poll path |

---

### Task 1: Add `phase` to `VoiceBiomarkersRecord`

**Files:**
- Modify: `lib/amplifier/types.ts`
- Modify: `lib/amplifier/analyze-checkin.ts` (set `phase: "final"` on ready records)
- Test: `lib/amplifier/analyze-checkin.test.ts` (assert `phase: "final"` on success)

**Interfaces:**
- Consumes: existing `VoiceBiomarkersRecord`
- Produces: `VoiceBiomarkersRecord.phase?: "during" | "final"`

- [ ] **Step 1: Write the failing assertion** in `analyze-checkin.test.ts` on a successful ready path:

```ts
expect(result.record.phase).toBe("final");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/amplifier/analyze-checkin.test.ts -t "phase"`
Expected: FAIL (property undefined / assertion fail)

- [ ] **Step 3: Minimal implementation**

In `lib/amplifier/types.ts`:

```ts
export type VoiceBiomarkersRecord = {
  status: "pending" | "ready" | "unavailable" | "error";
  conversationId?: string;
  jobIds?: string[];
  analyzedAt?: string;
  error?: string;
  raw?: unknown;
  mapped?: VoiceBiomarkers;
  /** during = mid-call snapshot; final = post-call source of truth */
  phase?: "during" | "final";
};
```

In `analyze-checkin.ts` ready record construction, add `phase: "final"`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/amplifier/analyze-checkin.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/amplifier/types.ts lib/amplifier/analyze-checkin.ts lib/amplifier/analyze-checkin.test.ts
git commit -m "feat(amplifier): add during/final phase on voice biomarker records"
```

---

### Task 2: Live session store

**Files:**
- Create: `lib/telephony/live-session.ts`
- Create: `lib/telephony/live-session.test.ts`

**Interfaces:**
- Produces:
  - `export type LiveTurn = { role: "agent" | "user"; text: string; at?: string }`
  - `export type LiveSessionStatus = "active" | "finalizing" | "completed" | "error"`
  - `export type LiveCallSession = { conversationId: string; patientId: string; status: LiveSessionStatus; startedAt: string; updatedAt: string; turns: LiveTurn[]; biomarkers: VoiceBiomarkersRecord | null; lastTickAt: string | null; tickInFlight: boolean; error?: string }`
  - `export function upsertLiveSession(args: { conversationId: string; patientId: string }): LiveCallSession`
  - `export function getLiveSession(conversationId?: string): LiveCallSession | null` — if omitted, returns the single most recent active/finalizing session
  - `export function updateLiveSession(conversationId: string, patch: Partial<Omit<LiveCallSession, "conversationId">>): LiveCallSession | null`
  - `export function beginTick(conversationId: string, nowIso: string): boolean` — returns false if coalesced (in flight or lastTickAt within 15s)
  - `export function endTick(conversationId: string, nowIso: string): void`
  - `export function clearLiveSessionsForTests(): void`
  - `export const LIVE_TICK_INTERVAL_MS = 15_000`

- [ ] **Step 1: Write failing tests** in `lib/telephony/live-session.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import {
  beginTick,
  clearLiveSessionsForTests,
  endTick,
  getLiveSession,
  LIVE_TICK_INTERVAL_MS,
  updateLiveSession,
  upsertLiveSession,
} from "./live-session";

afterEach(() => clearLiveSessionsForTests());

describe("live-session store", () => {
  it("upserts an active session and retrieves it as current", () => {
    const s = upsertLiveSession({
      conversationId: "conv_1",
      patientId: "margaret-ellison",
    });
    expect(s.status).toBe("active");
    expect(getLiveSession()?.conversationId).toBe("conv_1");
    expect(getLiveSession("conv_1")?.patientId).toBe("margaret-ellison");
  });

  it("coalesces ticks within 15s and while in flight", () => {
    upsertLiveSession({ conversationId: "conv_1", patientId: "margaret-ellison" });
    const t0 = "2026-07-26T10:00:00.000Z";
    expect(beginTick("conv_1", t0)).toBe(true);
    expect(beginTick("conv_1", t0)).toBe(false); // in flight
    endTick("conv_1", t0);
    const t1 = new Date(Date.parse(t0) + LIVE_TICK_INTERVAL_MS - 1).toISOString();
    expect(beginTick("conv_1", t1)).toBe(false);
    const t2 = new Date(Date.parse(t0) + LIVE_TICK_INTERVAL_MS).toISOString();
    expect(beginTick("conv_1", t2)).toBe(true);
  });

  it("patches biomarkers and turns", () => {
    upsertLiveSession({ conversationId: "conv_1", patientId: "margaret-ellison" });
    updateLiveSession("conv_1", {
      turns: [{ role: "agent", text: "Hi Margaret" }],
      biomarkers: {
        status: "ready",
        phase: "during",
        conversationId: "conv_1",
        mapped: {
          quality: "ok",
          respiratory: { level: "moderate", score: 0.4 },
          cognitive: { level: "low", score: 0.2 },
          source: "amplifier",
        },
      },
    });
    expect(getLiveSession("conv_1")?.turns).toHaveLength(1);
    expect(getLiveSession("conv_1")?.biomarkers?.phase).toBe("during");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run lib/telephony/live-session.test.ts`
Expected: FAIL module not found

- [ ] **Step 3: Implement `lib/telephony/live-session.ts`** — module-level `Map<string, LiveCallSession>`; `getLiveSession()` without id prefers status `active` then `finalizing` by newest `startedAt`; `beginTick` sets `tickInFlight` and returns false when in flight or `lastTickAt` within `LIVE_TICK_INTERVAL_MS`; `endTick` clears in-flight and sets `lastTickAt`.

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/telephony/live-session.ts lib/telephony/live-session.test.ts
git commit -m "feat(telephony): in-memory live call session store with 15s tick coalesce"
```

---

### Task 3: Fetch ElevenLabs conversation details

**Files:**
- Create: `lib/telephony/elevenlabs-conversation.ts`
- Create: `lib/telephony/elevenlabs-conversation.test.ts`

**Interfaces:**
- Produces:
  - `export type ConversationFetchResult = { status: "ok"; conversationId: string; callStatus: string; turns: LiveTurn[]; ended: boolean } | { status: "error"; reason: string } | { status: "unavailable"; reason: string }`
  - `export async function fetchConversationDetails(args: { conversationId: string; fetchImpl?: typeof fetch; apiKey?: string }): Promise<ConversationFetchResult>`
- Consumes: `LiveTurn` from `live-session.ts`; `ELEVENLABS_API_KEY`

- [ ] **Step 1: Write failing tests** mirroring `elevenlabs-recording.test.ts` patterns:

```ts
import { describe, expect, it, vi } from "vitest";
import { fetchConversationDetails } from "./elevenlabs-conversation";

describe("fetchConversationDetails", () => {
  it("returns unavailable when API key missing", async () => {
    const result = await fetchConversationDetails({
      conversationId: "conv_1",
      apiKey: "",
      fetchImpl: vi.fn(),
    });
    expect(result.status).toBe("unavailable");
  });

  it("maps transcript roles and detects ended status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          conversation_id: "conv_1",
          status: "done",
          transcript: [
            { role: "agent", message: "Hello", time_in_call_secs: 1 },
            { role: "user", message: "Hi", time_in_call_secs: 3 },
            { role: "agent", message: null },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await fetchConversationDetails({
      conversationId: "conv_1",
      apiKey: "key",
      fetchImpl,
    });
    expect(result).toMatchObject({
      status: "ok",
      ended: true,
      turns: [
        { role: "agent", text: "Hello" },
        { role: "user", text: "Hi" },
      ],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/convai/conversations/conv_1",
      expect.objectContaining({
        headers: expect.objectContaining({ "xi-api-key": "key" }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** `GET https://api.elevenlabs.io/v1/convai/conversations/{id}` with `xi-api-key`. Map `transcript[].role` + `message` (skip non-string/empty). `ended` true when `status` is `done` | `failed` | `completed` (string compare, case-sensitive to API). Never throw.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/telephony/elevenlabs-conversation.ts lib/telephony/elevenlabs-conversation.test.ts
git commit -m "feat(telephony): fetch ElevenLabs conversation transcript turns"
```

---

### Task 4: During-call Amplifier snapshot (no decision mutation)

**Files:**
- Create: `lib/amplifier/analyze-live-snapshot.ts`
- Create: `lib/amplifier/analyze-live-snapshot.test.ts`

**Interfaces:**
- Produces:
  - `export async function analyzeLiveVoiceSnapshot(args: { conversationId: string; fetchImpl?: typeof fetch }): Promise<VoiceBiomarkersRecord>`
- Consumes: `fetchConversationAudio`, `submitAnalyze`, `pollJob`, `mapAmplifierResults`
- Behavior: same audio → dual-domain analyze as post-call, but **does not** call `evaluate()`. Always sets `phase: "during"`. Fail-open to `unavailable`/`error` with `phase: "during"`.

- [ ] **Step 1: Write failing tests** — success sets `phase: "during"` and `mapped`; audio fail → `unavailable` + `phase: "during"`; no `decision` field on return (record only).

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement** by extracting shared submit/poll/map steps (copy from `analyze-checkin.ts` without evaluate/compose). Keep fail-open helpers local or shared carefully without changing post-call semantics.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/amplifier/analyze-live-snapshot.ts lib/amplifier/analyze-live-snapshot.test.ts
git commit -m "feat(amplifier): during-call voice biomarker snapshot without decision mutation"
```

---

### Task 5: Live tick orchestrator

**Files:**
- Create: `lib/telephony/live-tick.ts`
- Create: `lib/telephony/live-tick.test.ts`

**Interfaces:**
- Produces:
  - `export async function runLiveTick(args: { conversationId: string; nowIso?: string; fetchImpl?: typeof fetch; analyzeSnapshot?: typeof analyzeLiveVoiceSnapshot }): Promise<LiveCallSession | null>`
- Consumes: `beginTick`/`endTick`/`updateLiveSession`/`getLiveSession`, `fetchConversationDetails`, `analyzeLiveVoiceSnapshot`
- Behavior:
  1. `beginTick` — if false, return current session unchanged.
  2. Fetch conversation → update turns.
  3. If not ended, run snapshot analyze → update biomarkers (keep prior biomarkers if snapshot fails with unavailable/error **and** prior was ready — still record error on session.error optionally; prefer keeping last good `biomarkers` when new status is unavailable/error).
  4. If ended → set `status: "finalizing"`.
  5. Always `endTick` in `finally`.

- [ ] **Step 1: Write failing tests** with fake fetch + fake `analyzeSnapshot`:
  - coalesced tick does not call fetch
  - updates turns from conversation
  - sets finalizing when ended
  - keeps prior ready biomarkers when snapshot returns unavailable

- [ ] **Step 2–4: Red → green → commit**

```bash
git add lib/telephony/live-tick.ts lib/telephony/live-tick.test.ts
git commit -m "feat(telephony): live call tick orchestrates transcript + Amplifier snapshot"
```

---

### Task 6: Call log helpers

**Files:**
- Create: `lib/telephony/call-log.ts`
- Create: `lib/telephony/call-log.test.ts`

**Interfaces:**
- Produces:
  - `export type CallLogRow = { id: string; at: string; dayPostOp?: number; summary: string; decisionLevel?: "green" | "amber" | "red"; biomarkersStatus?: VoiceBiomarkersRecord["status"]; biomarkersPhase?: VoiceBiomarkersRecord["phase"]; inProgress: boolean; conversationId?: string }`
  - `export function callLogFromCheckins(checkins: Array<{ id: string; created_at: string; day_post_op?: number | null; transcript?: string | null; decision?: { level?: string } | null; voice_biomarkers?: VoiceBiomarkersRecord | null }>): CallLogRow[]`
  - `export function prependActiveSession(rows: CallLogRow[], session: LiveCallSession | null): CallLogRow[]`

- [ ] **Step 1: Tests** — maps checkin transcript to summary (truncate ~120 chars); prepends in-progress row from active session with `inProgress: true`.

- [ ] **Step 2–4: Implement + PASS + commit**

```bash
git add lib/telephony/call-log.ts lib/telephony/call-log.test.ts
git commit -m "feat(telephony): call log rows from checkins and active live session"
```

---

### Task 7: `GET /api/live-call` (+ register from `/api/call`)

**Files:**
- Create: `app/api/live-call/route.ts`
- Create: `app/api/live-call/route.test.ts`
- Modify: `app/api/call/route.ts`
- Modify: `app/api/call/route.test.ts`

**Interfaces:**
- `GET /api/live-call?conversationId=` → `{ status: "idle" | "active" | "finalizing" | "completed" | "error"; session: null | { conversationId, patientId, callStatus, turns, biomarkers, updatedAt, tickInFlight }; recentCalls: CallLogRow[] }`
- On GET: if session active/finalizing, fire-and-forget `runLiveTick` when `beginTick` would allow (call `runLiveTick` — it coalesces internally).
- Recent calls: try Supabase `fetchRecentCheckins` for demo patient; else map Margaret roster checkins from `lib/sim/roster.ts` (`buildRoster()` / exported helper — use existing roster patient `margaret-ellison` checkins).
- `POST /api/call` on `result.status === "sent"` and `conversationId`: `upsertLiveSession({ conversationId, patientId: patientId ?? "margaret-ellison" })`.

- [ ] **Step 1: Write API tests** with mocked session store modules / roster — idle returns null session + recentCalls array; after upsert, GET returns active + turns.

- [ ] **Step 2: Implement route + call registration**

- [ ] **Step 3: Run**

```bash
npx vitest run app/api/live-call/route.test.ts app/api/call/route.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/api/live-call/route.ts app/api/live-call/route.test.ts app/api/call/route.ts app/api/call/route.test.ts
git commit -m "feat(api): live-call poll endpoint and session registration on outbound call"
```

---

### Task 8: Map live turns → CallStage events + poll hook

**Files:**
- Create: `app/components/call/live-turns.ts`
- Create: `app/components/call/live-turns.test.ts`
- Create: `app/components/call/use-live-call-feed.ts`

**Interfaces:**
- `export function liveTurnsToEvents(turns: LiveTurn[]): CallEvent[]` — map `agent`→`speaker: "mend"`, `user`→`"margaret"`; `kind: "turn"`; `at` index * 5 or parse; stable `id: live-${i}`.
- `export function useLiveCallFeed(pollMs = 2500): { status; session; recentCalls; analyzing: boolean }` — client `fetch("/api/live-call")` on interval; `analyzing` when `session.tickInFlight` or biomarkers status pending.

- [ ] **Step 1: Unit test liveTurnsToEvents**

- [ ] **Step 2–3: Implement mapper + hook** (hook is client-only; no vitest DOM required if hook stays thin — optional render test skipped)

- [ ] **Step 4: Commit**

```bash
git add app/components/call/live-turns.ts app/components/call/live-turns.test.ts app/components/call/use-live-call-feed.ts
git commit -m "feat(call): map live turns to CallEvents and poll live-call feed"
```

---

### Task 9: CallStage live mode + Amplifier readout + compact call log

**Files:**
- Create: `app/components/call/LiveBiomarkersReadout.tsx`
- Create: `app/components/call/CallLogCompact.tsx`
- Modify: `app/components/call/CallStage.tsx`
- Modify: `app/components/clinician/VoiceBiomarkersPanel.tsx` (optional phase eyebrow)

**Interfaces:**
- When `useLiveCallFeed().session` is active/finalizing **and** `turns.length > 0`: drive transcript from `liveTurnsToEvents(turns)` instead of scripted cursor advancement (still show fixture until first live turn arrives).
- Show `LiveBiomarkersReadout` in the clinical column when biomarkers present (serif/sans + severity tokens; no new card stack — match LiveVitals density).
- Below stage (variant `stage` only): `CallLogCompact` with `recentCalls`.
- Hub variant: skip compact log or show single-line “N past calls” link to chart.

- [ ] **Step 1: Implement readout + compact log components** using existing typography classes (`eyebrow`, `numeric`, `SeverityChip` if level present).

- [ ] **Step 2: Wire CallStage** — preserve keyboard/`?play=`/`?stage=` behavior when idle.

- [ ] **Step 3: Manual sanity** — `npm run build` or at least `npx tsc --noEmit` if project uses it; fix type errors.

- [ ] **Step 4: Commit**

```bash
git add app/components/call/LiveBiomarkersReadout.tsx app/components/call/CallLogCompact.tsx app/components/call/CallStage.tsx app/components/clinician/VoiceBiomarkersPanel.tsx
git commit -m "feat(call): live transcript, Amplifier readout, and compact call log on CallStage"
```

---

### Task 10: Clinician chart call history + linked surface refresh

**Files:**
- Create: `app/components/clinician/CallHistory.tsx`
- Modify: `app/components/clinician/PatientChart.tsx`
- Modify: `app/components/clinician/AuditTrail.tsx` only if needed for shared row chrome — prefer new `CallHistory` that reuses `timeAgo` / `clockTime` / `SeverityChip` from existing clinician helpers

**Interfaces:**
- `CallHistory` lists patient’s checkins as call rows (summary, level, biomarker status/phase, duration via existing `callLength` if `callSeconds` on roster records).
- While live session active for this patient, show top in-progress row and bind `VoiceBiomarkersPanel` to `session.biomarkers` when `phase === "during"`, else latest check-in final.
- After finalizing, continue polling until idle; chart already reloads on navigation — also poll `useLiveCallFeed` in chart when `liveActive` so worklist-adjacent decision display updates when final biomarkers land on session before full reload.
- Mount CallHistory in the Overview or Audit tab region (prefer Overview below biomarkers, and ensure Audit still shows DecisionAudit). Do **not** add a new top-level tab unless `chart-tabs.ts` already has a natural slot — keep YAGNI: section inside Overview + visible from Audit as “Calls” subsection.

- [ ] **Step 1: Implement CallHistory**

- [ ] **Step 2: Wire into PatientChart** for Margaret / current patient checkins + live feed

- [ ] **Step 3: `npx tsc --noEmit` / focused tests PASS**

- [ ] **Step 4: Commit**

```bash
git add app/components/clinician/CallHistory.tsx app/components/clinician/PatientChart.tsx
git commit -m "feat(clinician): full call history and live biomarker binding on chart"
```

---

### Task 11: Finalizing → post-call analyze handoff

**Files:**
- Modify: `lib/telephony/live-tick.ts` (or new `lib/telephony/live-finalize.ts`)
- Modify: `app/api/live-call/route.ts` and/or reuse `POST /api/biomarkers/analyze` + check-in path
- Test: `lib/telephony/live-tick.test.ts` or `live-finalize.test.ts`

**Interfaces:**
- When session enters `finalizing`:
  - If a check-in already exists with this `conversationId`, call existing analyze path / ensure `phase: "final"` persisted.
  - Else: build transcript text from turns, best-effort `POST` internal finalize that creates/updates check-in **only if** there is already a check-in pipeline in demo — do **not** invent symptoms. Prefer: set session biomarkers via `analyzeLiveVoiceSnapshot` once more as interim, mark session `completed` after invoking `analyzeCheckinVoiceBiomarkers` when caller supplies prior decision from latest check-in OR skip decision mutation and only store final biomarker record on session + leave `/api/checkin` as the persistence entry point when the operator/console submits.
- Binding rule from spec: post-call path uses existing `/api/checkin` + `/api/biomarkers/analyze`. Live finalize should:
  1. Mark session `completed` when conversation ended and final snapshot attempted.
  2. If Supabase check-in with matching `voice_biomarkers.conversationId` exists, trigger analyze (fire-and-forget fetch to `/api/biomarkers/analyze` with that checkin id) **or** call `analyzeCheckinVoiceBiomarkers` + `updateCheckinAfterBiomarkers` directly from server module.
  3. Never block `/api/triage`.

- [ ] **Step 1: Test** — ended conversation moves session to `finalizing` then `completed` after finalize helper runs (mock analyze).

- [ ] **Step 2: Implement finalize helper; wire from tick when `ended`.

- [ ] **Step 3: Commit**

```bash
git add lib/telephony/live-tick.ts lib/telephony/live-finalize.ts lib/telephony/live-finalize.test.ts app/api/live-call/route.ts
git commit -m "feat(telephony): finalize live session into post-call Amplifier phase"
```

---

### Task 12: Docs + full verification

**Files:**
- Modify: `docs/demo-runbook.md` — add short “Live `/call` data” subsection: Call now → open `/call` → transcript/Amplifier refresh ~15s → call log; idle fixture fallback
- Modify: `docs/superpowers/specs/2026-07-26-live-voice-call-data-design.md` status line to “Implementation planned”

- [ ] **Step 1: Update runbook**

- [ ] **Step 2: Run full suite**

```bash
npm test
npx tsc --noEmit
```

Expected: all tests pass; tsc clean

- [ ] **Step 3: Commit + push**

```bash
git add docs/demo-runbook.md docs/superpowers/specs/2026-07-26-live-voice-call-data-design.md
git commit -m "docs: live voice call poll path in demo runbook"
git push -u origin cursor/live-voice-call-data-333c
```

---

## Spec coverage checklist (self-review)

| Spec requirement | Task |
|---|---|
| Live ElevenLabs turns replace script when active | 3, 5, 8, 9 |
| Fixture Margaret when idle / no keys | 7, 9 |
| Amplifier ~15s during call (`phase: during`) | 1, 2, 4, 5, 7 |
| Post-call fuller analyze (`phase: final`) | 1, 11 |
| Compact call log on `/call` | 6, 9 |
| Full history on clinician chart | 6, 10 |
| Update biomarker-linked patient surfaces | 10, 11 |
| Fail-open / no demote / no triage coupling | 4, 5, 11 + Global Constraints |
| Maintain CallStage style | 9 |
| No sentiment / no WS streaming | Global Constraints |

**Type names locked:** `LiveTurn`, `LiveCallSession`, `LiveSessionStatus`, `CallLogRow`, `fetchConversationDetails`, `analyzeLiveVoiceSnapshot`, `runLiveTick`, `LIVE_TICK_INTERVAL_MS`.
