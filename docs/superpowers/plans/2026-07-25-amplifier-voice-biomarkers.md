# Amplifier Voice Biomarkers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. REQUIRED: Follow superpowers:test-driven-development (red → green → refactor) on every task that changes production code.

**Goal:** After a voice check-in, fetch the ElevenLabs conversation recording, run Amplifier `respiratory` + `cognitive` analysis, map results into `evaluate()`, update the check-in / clinician chart; attempt during-call streaming only as a gated spike.

**Architecture:** Mid-call `/api/triage` stays symptoms/vitals-only. Post-call orchestration fetches audio → Amplifier jobs → Mend-owned `VoiceBiomarkers` → re-`evaluate()` → update `checkins.voice_biomarkers` + decision. Streaming is optional and never finalizes severity.

**Tech Stack:** Next.js App Router, Vitest, Supabase jsonb on `checkins`, Amplifier REST (`X-Account-ID` + `X-API-Key`), ElevenLabs ConvAI audio GET, TypeScript strict.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-25-amplifier-voice-biomarkers-design.md` — binding.
- Amplifier bundles: `respiratory` + `cognitive` only.
- Post-call re-eval is authoritative; mid-call triage must not wait on Amplifier.
- During-call streaming is best-effort; if spike fails, ship post-call only.
- Fail-safe policy deferred until after spike Task 1; until then missing/error → `status: unavailable|error` and **keep prior decision** (fail-open default for incomplete spike).
- LLM never chooses escalation; only `evaluate()` / `composeDecision()` set severity.
- Synthetic patient data; US English; “not medical advice” unchanged.
- No Thymia; do not add `therapyAdherent` / `adherenceDays`.
- Every new clinical threshold must carry a `source` string; uncited calls → `docs/clinical-decisions.md`.
- TypeScript strict; no `any` in `lib/clinical/**` or `lib/amplifier/**`.
- No real network in unit tests — inject `fetch`.
- Implementer model: Grok 4.5 (`cursor-grok-4.5-high-fast`).
- Commit after each task; focused tests then `npm test` before commit.
- Work on an isolated feature branch / worktree — not directly on `main` without consent.

---

## File structure

| Path | Role |
|---|---|
| `lib/amplifier/types.ts` | Mend-owned biomarker types + Amplifier job status shapes |
| `lib/amplifier/client.ts` | Submit audio + poll job (injectable fetch) |
| `lib/amplifier/client.test.ts` | Client unit tests |
| `lib/amplifier/map-to-engine.ts` | Raw Amplifier result → `VoiceBiomarkers` |
| `lib/amplifier/map-to-engine.test.ts` | Mapper tests (fixture payloads) |
| `lib/amplifier/analyze-checkin.ts` | Orchestrate fetch audio → analyze → map → re-eval payload |
| `lib/amplifier/analyze-checkin.test.ts` | Orchestration tests with fakes |
| `lib/telephony/elevenlabs-recording.ts` | GET conversation audio bytes |
| `lib/telephony/elevenlabs-recording.test.ts` | Recording fetch tests |
| `lib/clinical/types.ts` | Export `VoiceBiomarkers` (re-export or own) |
| `lib/clinical/red-flag-engine.ts` | `EvaluateInput.voiceBiomarkers` + new rules |
| `lib/clinical/red-flag-engine.test.ts` | Engine rule tests |
| `lib/clinical/rule-catalog.ts` | Catalog entries for new rules |
| `lib/db/schema.sql` | `voice_biomarkers` column |
| `lib/db/supabase.ts` | Types for column |
| `lib/db/queries.ts` | `updateCheckinAfterBiomarkers` |
| `app/api/biomarkers/analyze/route.ts` | POST orchestration endpoint |
| `app/api/demo-status/route.ts` | Amplifier key presence |
| `.env.example` | `AMPLIFIER_API_KEY`, `AMPLIFIER_ACCOUNT_ID` |
| `scripts/spike-amplifier.mjs` | Live spike against Amplifier (+ optional ElevenLabs) |
| `docs/amplifier-spike-notes.md` | Spike findings (enums, latency, streaming keep/drop) |
| `app/components/clinician/VoiceBiomarkersPanel.tsx` | Chart panel |
| Clinician chart / check-in wire | Pass `conversationId`, show panel |

---

### Task 1: Live Amplifier spike + fixture capture

**Files:**
- Create: `scripts/spike-amplifier.mjs`
- Create: `docs/amplifier-spike-notes.md`
- Create: `lib/amplifier/fixtures/sample-job-done.json` (redacted real or realistic shape from spike)
- Modify: `.env.example` (document keys only)

**Interfaces:**
- Produces: documented request URL that worked, auth headers, job JSON shape, whether `respiratory`/`cognitive` are use-case or model path, streaming keep/drop recommendation
- Consumes: `AMPLIFIER_API_KEY`, `AMPLIFIER_ACCOUNT_ID` from env; optional short WAV path arg

- [ ] **Step 1: Write spike script** that:
  1. Reads `AMPLIFIER_API_KEY` + `AMPLIFIER_ACCOUNT_ID`
  2. Tries in order until one succeeds:
     - `POST https://api.amplifierhealth.com/v2/use-case/analyze` with form fields for use case `respiratory` (and separately `cognitive`) if docs require
     - `POST https://api.amplifierhealth.com/v2/models/respiratory/analyze` and `.../cognitive/analyze`
     - `POST https://api.amplifierhealth.com/v2/models/apex/analyze` as last resort (note if bundles unavailable)
  3. Headers: `X-Account-ID`, `X-API-Key`
  4. Multipart field `audio` with a ≥10s WAV (generate silence/tone locally if no file arg)
  5. Polls `GET https://api.amplifierhealth.com/v2/jobs/{job_id}` until `done` or timeout 120s
  6. Prints status codes and writes sanitized JSON to `lib/amplifier/fixtures/sample-job-done.json` (strip PII)

- [ ] **Step 2: Run spike**

```bash
node scripts/spike-amplifier.mjs
```

Expected: at least one successful job; notes file updated. If keys missing, document BLOCKED and stop Task 1 for human keys — do not invent success.

- [ ] **Step 3: Write `docs/amplifier-spike-notes.md`** with: working endpoint(s), latency, `overall_level` / `signals` shape, streaming availability (probe docs/WS; if unknown mark “drop for v1”), fail-safe recommendation (A fail-open vs B caution).

- [ ] **Step 4: Commit**

```bash
git add scripts/spike-amplifier.mjs docs/amplifier-spike-notes.md lib/amplifier/fixtures/sample-job-done.json .env.example
git commit -m "chore(amplifier): spike script and captured job fixture"
```

---

### Task 2: Amplifier types + client (TDD)

**Files:**
- Create: `lib/amplifier/types.ts`
- Create: `lib/amplifier/client.ts`
- Create: `lib/amplifier/client.test.ts`

**Interfaces:**
- Consumes: spike notes for exact URL path + status field names
- Produces:
```ts
export type AmplifierDomain = "respiratory" | "cognitive";

export function loadAmplifierCredentials():
  | { apiKey: string; accountId: string }
  | undefined;

export async function submitAnalyze(args: {
  domain: AmplifierDomain;
  audio: Uint8Array;
  contentType: string;
  filename?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ status: "ok"; jobId: string } | { status: "error"; reason: string }>;

export async function pollJob(args: {
  jobId: string;
  fetchImpl?: typeof fetch;
  maxAttempts?: number;
  delayMs?: number;
}): Promise<
  | { status: "done"; result: unknown }
  | { status: "error"; reason: string }
  | { status: "timeout"; reason: string }
>;
```

- [ ] **Step 1: Write failing tests** in `lib/amplifier/client.test.ts` covering: missing credentials → error; submit posts multipart to spike-chosen URL with both headers; poll returns done result; poll timeout after maxAttempts.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run lib/amplifier/client.test.ts
```

- [ ] **Step 3: Implement** `types.ts` + `client.ts` (no real network; default `fetch`).

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/amplifier/types.ts lib/amplifier/client.ts lib/amplifier/client.test.ts
git commit -m "feat(amplifier): client submit + poll with injectable fetch"
```

---

### Task 3: Map Amplifier result → VoiceBiomarkers (TDD)

**Files:**
- Create: `lib/amplifier/map-to-engine.ts`
- Create: `lib/amplifier/map-to-engine.test.ts`
- Modify: `lib/clinical/types.ts` (add `VoiceBiomarkers` + domain signal types if not only in amplifier)

**Interfaces:**
```ts
export interface VoiceDomainSignal {
  level: "low" | "moderate" | "high" | "unknown";
  score?: number;
  label?: string;
}

export interface VoiceBiomarkers {
  quality: "ok" | "insufficient" | "error";
  respiratory: VoiceDomainSignal;
  cognitive: VoiceDomainSignal;
  overallLevel?: string;
  recommendedAction?: string;
  source: "amplifier";
}

export function mapAmplifierResults(args: {
  respiratory: unknown;
  cognitive: unknown;
}): VoiceBiomarkers;
```

Normalize spike fixture fields into the enums above. Unknown/missing → `level: "unknown"`, `quality: "insufficient"` when both unknown.

- [ ] **Step 1: Failing tests** using `lib/amplifier/fixtures/sample-job-done.json` (+ synthetic high/low variants).

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement mapper**

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(amplifier): map vendor results to VoiceBiomarkers"
```

---

### Task 4: Engine rules for voice biomarkers (TDD)

**Files:**
- Modify: `lib/clinical/red-flag-engine.ts` (`EvaluateInput`, `Context`, rules)
- Modify: `lib/clinical/red-flag-engine.test.ts`
- Modify: `lib/clinical/rule-catalog.ts` (+ test if pattern requires)
- Modify: `docs/clinical-decisions.md` (brief entry for mapping choices)

**Interfaces:**
- Consumes: `VoiceBiomarkers` on `EvaluateInput.voiceBiomarkers?: VoiceBiomarkers`
- Produces rules (ids exact):
  - `voice.cognitive_high` — amber, condition “Voice cognitive concern”, when `cognitive.level === "high"` and quality ok
  - `voice.respiratory_high_uncorroborated` — amber, when `respiratory.level === "high"` and quality ok and NOT already catching a red PE rule from symptoms/vitals (engine still prefers existing PE reds when breathless+tachycardia etc.)
- Rationale lines must include `source: amplifier voice biomarker`
- Voice biomarkers alone must **not** fire PE red without existing PE corroboration inputs.

- [ ] **Step 1: Write failing engine tests** for: high cognitive → amber; high respiratory alone → amber not red; breathless+tachycardia still red PE and may also list voice rule or not — PE wins severity; missing voiceBiomarkers → unchanged vignettes.

- [ ] **Step 2: Run focused tests — FAIL**

- [ ] **Step 3: Minimal engine + catalog changes**

- [ ] **Step 4: Run `npx vitest run lib/clinical/red-flag-engine.test.ts lib/clinical/vignettes.test.ts` — PASS (vignettes unchanged)

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(clinical): evaluate() rules for Amplifier voice biomarkers"
```

---

### Task 5: ElevenLabs conversation audio fetch (TDD)

**Files:**
- Create: `lib/telephony/elevenlabs-recording.ts`
- Create: `lib/telephony/elevenlabs-recording.test.ts`

**Interfaces:**
```ts
export async function fetchConversationAudio(args: {
  conversationId: string;
  fetchImpl?: typeof fetch;
}): Promise<
  | { status: "ok"; bytes: Uint8Array; contentType: string }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string }
>;
```

- URL: `GET https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`
- Header: `xi-api-key: process.env.ELEVENLABS_API_KEY`
- Missing key → `skipped`
- Non-OK → `error`
- Success → bytes + content-type (default `audio/mpeg` if header absent)

- [ ] **Step 1–4: TDD** as above

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(telephony): fetch ElevenLabs conversation audio"
```

---

### Task 6: Schema + DB update helper (TDD)

**Files:**
- Modify: `lib/db/schema.sql` — add `voice_biomarkers jsonb` on `checkins` (create table + alter if not exists pattern matching other columns)
- Modify: `lib/db/supabase.ts` — `CheckinRow` / `CheckinInsert` include `voice_biomarkers?: unknown | null`
- Modify: `lib/db/queries.ts` — add updater
- Create: `lib/db/queries.biomarkers.test.ts` (mock supabase client pattern from existing query tests if any; otherwise pure helper test)

**Interfaces:**
```ts
export type VoiceBiomarkersRecord = {
  status: "pending" | "ready" | "unavailable" | "error";
  conversationId?: string;
  jobIds?: string[];
  analyzedAt?: string;
  error?: string;
  raw?: unknown;
  mapped?: VoiceBiomarkers;
};

export async function updateCheckinAfterBiomarkers(
  supabase: SupabaseClient<Database>,
  checkinId: string,
  patch: {
    voice_biomarkers: VoiceBiomarkersRecord;
    decision?: unknown;
    sbar?: string | null;
    trend_findings?: unknown;
  },
): Promise<boolean>;
```

Also extend `insertCheckin` / `CheckinInsert` so callers can set initial `voice_biomarkers: { status: "pending", conversationId }`.

- [ ] **Step 1: Failing test** that updater calls `.from("checkins").update(...).eq("id", checkinId)` and returns false on error

- [ ] **Step 2–4: Implement**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(db): voice_biomarkers column and check-in update helper"
```

**Human note (not a code step):** run in Supabase SQL editor:

```sql
alter table checkins add column if not exists voice_biomarkers jsonb;
```

---

### Task 7: Post-call analyze orchestration (TDD)

**Files:**
- Create: `lib/amplifier/analyze-checkin.ts`
- Create: `lib/amplifier/analyze-checkin.test.ts`

**Interfaces:**
```ts
export async function analyzeCheckinVoiceBiomarkers(args: {
  conversationId: string;
  dayPostOp: number;
  symptoms: Symptoms;
  vitals: VitalsReading;
  ecg?: EcgReading;
  priorDecision: Decision;
  fetchImpl?: typeof fetch;
}): Promise<{
  record: VoiceBiomarkersRecord;
  decision: Decision;
  decisionChanged: boolean;
}>;
```

Pipeline: fetch audio → if fail, return unavailable + priorDecision → submit both domains → poll both → map → `evaluate({..., voiceBiomarkers})` → optionally `composeDecision` with empty trends if caller supplies none → `decisionChanged` if level or firedRules differ.

- [ ] **Step 1–4: TDD** with fake fetch sequences

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(amplifier): post-call analyze + re-evaluate orchestration"
```

---

### Task 8: API route + demo-status + env

**Files:**
- Create: `app/api/biomarkers/analyze/route.ts`
- Create: `app/api/biomarkers/analyze/route.test.ts` (if route testing pattern exists; else thin handler test via extracted pure parse)
- Modify: `app/api/demo-status/route.ts` — `amplifier` boolean + missing names
- Modify: `.env.example`

**Request body:**
```ts
{ checkinId: string; conversationId: string; dayPostOp: number; /* reload clinical context from DB or accept snapshots */ }
```

Preferred: load check-in + patient vitals/symptoms snapshots from Supabase by `checkinId`, run orchestration, `updateCheckinAfterBiomarkers`, if `decisionChanged` and level is amber/red run existing escalation helpers (reuse checkin route patterns — do not duplicate SMS logic carelessly).

If loading full context is too heavy, accept snapshots in the body matching check-in fields (document in route comment).

- [ ] **Step 1: Implement route with tests for bad body → 400; happy path with mocked modules**

- [ ] **Step 2: demo-status + env.example**

- [ ] **Step 3: `npm test` + commit**

```bash
git commit -m "feat(api): POST /api/biomarkers/analyze and demo-status amplifier flags"
```

---

### Task 9: Wire conversationId from call → analyze trigger

**Files:**
- Modify: call start path (`app/api/call` or console) to retain `conversationId`
- Modify: check-in persistence path to store `voice_biomarkers: { status: "pending", conversationId }` when id known
- Trigger POST `/api/biomarkers/analyze` after check-in completes when `conversationId` present (fire-and-forget from server after insert, or console button “Analyze voice biomarkers” for demo reliability)

**Binding choice for demo reliability:** expose console/Capture button “Run voice biomarkers” that POSTs with last `conversationId` + `checkinId`, AND auto-invoke from check-in handler when conversationId is in the request body optional field `conversationId?: string`.

- [ ] **Step 1: Extend check-in body with optional `conversationId`**

- [ ] **Step 2: After successful insertCheckin, if conversationId, void-call analyze (do not await on triage; on checkin await with timeout ≤15s or fire-and-forget — prefer fire-and-forget + poll UI)**

- [ ] **Step 3: Tests for optional field plumbing**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(checkin): pending voice_biomarkers + trigger post-call analyze"
```

---

### Task 10: Clinician VoiceBiomarkersPanel

**Files:**
- Create: `app/components/clinician/VoiceBiomarkersPanel.tsx`
- Modify: `app/components/clinician/PatientChart.tsx` (or LatestReading) to render when latest check-in has mapped biomarkers / status
- Ensure roster/chart data loader passes `voiceBiomarkers` from DB/fixture

**UI rules:** Mend tokens; no cards-in-hero issues (this is chart); show status pending/ready/error; respiratory + cognitive levels; “from voice call”; never severity-by-color-alone.

- [ ] **Step 1: Implement panel + wire chart**

- [ ] **Step 2: Manual or component test if pattern exists**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(clinician): voice biomarkers panel on patient chart"
```

---

### Task 11: Streaming spike gate (optional keep/drop)

**Files:**
- Create: `docs/amplifier-streaming-spike.md` OR section append to `docs/amplifier-spike-notes.md`
- Only if Task 1 notes say streaming is viable: minimal probe script; otherwise document **DROP for v1** and skip code.

- [ ] **Step 1: Read spike notes; if drop, write one paragraph and commit docs-only**

```bash
git commit -m "docs(amplifier): streaming deferred — post-call only for v1"
```

- [ ] **Step 2: If keep, implement minimal during-call factor display behind a feature flag — else stop**

---

### Task 12: Verification + handoff note

- [ ] **Step 1: Run `npx tsc --noEmit` and `npm test`**

- [ ] **Step 2: Update `docs/AGENT-HANDOFF.md`** — Thymia remains parked; Amplifier path exists; Supabase alter required; env keys listed

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: Amplifier biomarkers handoff and verification"
```

---

## Self-review checklist (plan author)

1. Spec coverage: spike, client, map, engine, ElevenLabs audio, schema, orchestration, API, wire-up, chart UI, streaming gate, fail-open until spike locks — covered.
2. No TBD placeholders in task steps.
3. Types consistent: `VoiceBiomarkers`, `VoiceBiomarkersRecord`, rule ids `voice.cognitive_high` / `voice.respiratory_high_uncorroborated`.
