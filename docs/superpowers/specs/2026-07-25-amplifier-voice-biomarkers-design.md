# Mend — Amplifier Voice Biomarkers

**Design spec · 2026-07-25**  
**Status:** Approved in conversation; awaiting implementation plan  
**Audience:** Demo engineers wiring live voice check-ins; clinician chart  
**Replaces:** Parked Thymia / RTM-adherence biomarker path (do not unstash)

---

## 1. Goal

Integrate [Amplifier Health](https://docs.amplifierhealth.com/) voice biomarker analysis into Mend’s call → check-in → patient-file loop so **respiratory** and **cognitive** signals become a first-class input to the deterministic clinical engine and update the patient chart.

**Success criteria**
- Spike proves Amplifier auth + job poll + real result shape with project keys.
- Spike proves ElevenLabs conversation audio can be fetched by `conversation_id`.
- Post-call path: recording → Amplifier → map → re-`evaluate()` → update check-in / clinician surfaces.
- During-call streaming is attempted; if it fails or cannot receive usable audio, ship **post-call only**.
- Fail-safe policy (missing/failed analysis) is **chosen after the spike**, not guessed upfront.
- Mid-call `/api/triage` latency budget unchanged (symptoms/vitals only).
- Family surface shows severity/script only — no biomarker jargon.
- Thymia remains parked; no `therapyAdherent` / `adherenceDays` fields.

---

## 2. Decisions (binding)

| Topic | Choice |
|---|---|
| Clinical role | Full engine input — maps into `evaluate()` (not chart decoration only) |
| Audio source | ElevenLabs conversation recording after the call |
| Timing | Post-call re-evaluation is authoritative |
| During-call | Best-effort WebSocket/streaming spike; drop if not workable |
| Amplifier bundles | `respiratory` + `cognitive` |
| Fail-safe on missing/error | Deferred until after API spike |
| Approach | Spike → post-call only first; streaming gated |
| Vendor | Amplifier (not Thymia) |

---

## 3. Architecture

```
Live call
  └─ /api/triage          → evaluate(symptoms, vitals, ecg) → speak script
  └─ (optional) stream    → Amplifier WS factors on /call or console (non-final)

Call ends (conversation_id)
  └─ Fetch ElevenLabs audio
  └─ Amplifier analyze (respiratory + cognitive) → poll jobs
  └─ Map → VoiceBiomarkers
  └─ Re-evaluate(+ compose/trends) → UPDATE checkin + chart
  └─ If level rises → existing escalation / caregiver notify path
```

### Modules

| Unit | Responsibility |
|---|---|
| `lib/amplifier/client.ts` | Auth headers, submit audio, poll job, typed raw result |
| `lib/amplifier/map-to-engine.ts` | Vendor payload → Mend `VoiceBiomarkers` |
| `lib/telephony/elevenlabs-recording.ts` | Fetch conversation audio by id |
| `app/api/biomarkers/analyze/route.ts` (or equiv.) | Post-call orchestration |
| `lib/clinical/red-flag-engine.ts` | Optional `voiceBiomarkers` on `EvaluateInput` + new rules |
| `lib/db/queries.ts` + `schema.sql` | Persist/update `voice_biomarkers` jsonb on `checkins` |
| Clinician chart component | Show mapped levels/signals on latest check-in |

Local timing features in `lib/clinical/speech.ts` stay separate and non-authoritative. Amplifier is the vendor biomarker path.

---

## 4. Supabase / persistence

**Required migration** (also land in `lib/db/schema.sql`; run once in Supabase SQL editor):

```sql
alter table checkins
  add column if not exists voice_biomarkers jsonb;

comment on column checkins.voice_biomarkers is
  'Amplifier voice biomarker job status, raw payloads, and Mend-mapped respiratory/cognitive signals';
```

No new table for v1. Optional `biomarker_jobs` table only if we later need crash recovery across process restarts.

**App layer:** insert check-in with `voice_biomarkers.status = pending` (+ `conversationId` when known); post-call update writes `ready` / `unavailable` / `error`, mapped fields, and revised `decision` / `sbar` when re-eval changes them.

**Env (not schema):** `AMPLIFIER_API_KEY`, `AMPLIFIER_ACCOUNT_ID` in `.env` / Vercel. Existing Supabase keys unchanged.

**Not changing:** RLS (off for synthetic demo), patients/vitals/ECG tables, Thymia fields.

---

## 5. Data model

### `voice_biomarkers` jsonb shape

```ts
type VoiceBiomarkerStatus = "pending" | "ready" | "unavailable" | "error";

interface VoiceBiomarkersRecord {
  status: VoiceBiomarkerStatus;
  conversationId?: string;
  jobIds?: string[];
  analyzedAt?: string;
  error?: string;
  raw?: unknown; // Amplifier payloads for audit
  mapped?: VoiceBiomarkers;
}

interface VoiceBiomarkers {
  quality: "ok" | "insufficient" | "error";
  respiratory: VoiceDomainSignal;
  cognitive: VoiceDomainSignal;
  overallLevel?: string;
  recommendedAction?: string;
  source: "amplifier";
}

interface VoiceDomainSignal {
  level: string; // exact enum locked from spike response
  score?: number;
  signals?: unknown[];
}
```

Exact level enums and field paths are locked during the API spike from live Amplifier responses (`result.summary.overall_level`, `recommended_action`, `signals[]` per [Amplifier docs](https://docs.amplifierhealth.com/)).

---

## 6. Engine mapping

- Extend `EvaluateInput` with optional `voiceBiomarkers?: VoiceBiomarkers`.
- Add new rules with cited `source` strings in rationale / clinical docs.
- Intended directions (thresholds after spike):
  - Elevated **respiratory** concern corroborates / participates in existing PE / breathlessness rule cluster — does not invent PE red without a written corroboration story.
  - Elevated **cognitive** concern can set or corroborate confusion-style amber (parallel to `newConfusion`).
- Log uncited judgement calls in `docs/clinical-decisions.md`.
- Hard constraints unchanged: LLM never chooses escalation; fail-safe direction toward escalation once policy is chosen; every threshold has a `source` string.

---

## 7. Surfaces

| Surface | Behavior |
|---|---|
| `/api/triage` | Unchanged mid-call path; no Amplifier wait |
| Post-call analyze route | Authoritative biomarker + re-eval |
| Clinician chart / patient file | Biomarker panel on check-in: levels, key signals, “from voice call” |
| `/call` | Live factors only if streaming spike succeeds; else refresh after post-call |
| `/family` | Severity / script only — no biomarker jargon |
| `/console` | Missing Amplifier keys visible; optional trigger/status for spike |

---

## 8. Orchestration & errors

1. Persist check-in as today; set `voice_biomarkers` to `pending` when a `conversationId` exists.
2. Follow-up: fetch audio → Amplifier submit/poll → map → re-`evaluate()` (+ compose/trends) → update same check-in.
3. If composed level rises vs prior decision, use existing escalation / caregiver notify path.
4. Missing keys, missing recording, or job timeout → `unavailable` or `error`; **keep prior decision until fail-safe policy is locked after spike**.
5. Never block mid-call triage on Amplifier.

---

## 9. Spike plan (gate before full build)

1. Fixture WAV → Amplifier `respiratory` + `cognitive` with real keys — auth, latency, result shape.
2. One real ElevenLabs conversation recording fetch by `conversation_id`.
3. WebSocket / streaming smoke with whatever mid-call audio we can obtain — keep or drop.
4. Lock: level enums, rule thresholds, fail-safe A vs B, whether streaming ships.

---

## 10. Non-goals

- Unstashing or completing Thymia / RTM adherence WIP.
- Amplifier choosing severity outside `evaluate()`.
- Family-facing biomarker scores.
- New `biomarker_jobs` table unless spike proves we need it.
- Changing mid-call triage to wait on Amplifier.

---

## 11. Verification

- Spike scripts/commands documented with real (redacted) response shapes.
- Unit tests for mapper + new engine rules (fixtures from spike payloads).
- `npm test` / `npx tsc --noEmit` green after implementation.
- Live: one outbound call → recording → biomarkers on chart; honest report if streaming or ElevenLabs audio hop fails.
- Supabase: `voice_biomarkers` column present after migration.
