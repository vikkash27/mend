# Mend — Live Voice Call Data

**Design spec · 2026-07-26**  
**Status:** Implemented  
**Audience:** Demo engineers making `/call` and the clinician chart functional with real live data  
**Builds on:** `2026-07-25-amplifier-voice-biomarkers-design.md`, `2026-07-25-live-cohesive-demo-design.md`  
**Does not revive:** Amplifier WebSocket streaming (`docs/amplifier-streaming-spike.md` DROP stands); Thymia

---

## 1. Goal

Make the voice call surface **functional with real live call data** while preserving the existing CallStage visual language. Margaret’s filled fixture experience remains the idle/demo fallback. The standout feature is a live call that shows real ElevenLabs conversation turns and Amplifier biomarker values that refresh during the call, with a deeper post-call pass that updates linked patient-file surfaces.

**Success criteria**
- With an active ElevenLabs `conversationId`, `/call` shows real transcript turns (not only the scripted Margaret timeline).
- Without an active call (or without keys), `/call` still renders the polished fixture Margaret stage.
- Amplifier respiratory + cognitive values refresh on a ~15s server cadence during an active call (`phase: "during"`).
- After the call, a fuller post-call Amplifier analyze runs (`phase: "final"`) and is the persisted source of truth.
- Compact call log on `/call`; full call history on the clinician chart (Margaret).
- Post-call updates refresh biomarker-linked chart/worklist/patient surfaces (check-in, Voice Biomarkers panel, decision/SBAR when `evaluate()` changes, worklist status).
- Fail-open clinical policy unchanged: missing/failed Amplifier never invents escalation; never demote severity on voice alone.
- No new “sentiment” vendor — Amplifier is the second API.

---

## 2. Decisions (binding)

| Topic | Choice |
|---|---|
| Live transcript source | Poll ElevenLabs conversation details while call active; replace scripted timeline when live |
| Idle fallback | Existing scripted Margaret CallStage |
| Approach | Server poll orchestrator (Approach 1) — single live session as source of truth |
| Amplifier during call | REST upload + job poll every ~15s; snapshot on session (`phase: "during"`) |
| Amplifier post-call | Existing fuller analyze path; `phase: "final"`; authoritative for persistence |
| Call log placement | Both: compact recent on `/call`; full history on clinician chart |
| Call log storage | `checkins` (+ in-flight live session row while active) |
| Patient file updates | Biomarker-linked surfaces: check-in, Voice Biomarkers, decision/SBAR if changed, worklist / related chart status |
| Mid-call WebSocket streaming | Out of scope (prior DROP) |
| Sentiment API | Does not exist; use Amplifier values only |
| Visual redesign | Out of scope — maintain CallStage style |

---

## 3. Architecture

```
Call now
  → POST /api/call → ElevenLabs outbound
  → create live session { conversationId, patientId, status: active }

While active (server tick ~15s):
  → GET ElevenLabs conversation (transcript turns + status)
  → GET conversation audio (best-effort)
  → Amplifier analyze (respiratory + cognitive) → snapshot on session (phase: during)
  → clients poll GET /api/live-call → CallStage / strip / chart

On call end / check-in complete:
  → fuller post-call analyze (phase: final)
  → persist checkin + voice_biomarkers
  → re-evaluate() (fail-open, never demote)
  → refresh linked patient/chart/worklist fields
  → session → completed; appears in call log
```

### Modules

| Unit | Responsibility |
|---|---|
| `lib/telephony/live-session.ts` | Live session store: conversationId, patientId, status, turns, Amplifier snapshot, timestamps, errors |
| `lib/telephony/elevenlabs-conversation.ts` (or extend recording module) | Fetch conversation details / transcript turns by id |
| Existing `lib/telephony/elevenlabs-recording.ts` | Fetch conversation audio bytes |
| Existing `lib/amplifier/*` | Submit/poll/map; reused for during + final phases |
| `GET /api/live-call` | Poll payload for UI (`idle` \| active session fields) |
| Live tick (internal or `POST /api/live-call/tick`) | Coalesced ~15s refresh of transcript + during-call Amplifier |
| Extend `POST /api/call` | Register/create live session when call placed |
| Existing `/api/checkin` + `/api/biomarkers/analyze` | Final analyze, persist, linked field updates |
| `CallStage` + poll hook | Render live turns + Amplifier when session active; else fixture |
| `/call` call log (compact) | Recent check-ins + active session |
| Clinician chart call history | Full check-in list; Live embed; VoiceBiomarkersPanel bound to latest/selected |

---

## 4. Data model

### Live session (process memory; Supabase optional later)

```ts
type LiveCallSession = {
  conversationId: string;
  patientId: string;           // e.g. margaret-ellison
  status: "active" | "finalizing" | "completed" | "error";
  startedAt: string;           // ISO
  updatedAt: string;
  turns: Array<{
    role: "agent" | "user";
    text: string;
    at?: string;
  }>;
  biomarkers: VoiceBiomarkersRecord | null; // includes phase
  lastTickAt: string | null;
  tickInFlight: boolean;
  error?: string;
};
```

### `voice_biomarkers` extension

Keep existing `VoiceBiomarkersRecord` shape; add:

```ts
phase?: "during" | "final";
```

- `during` — mid-call snapshot; may be overwritten every tick; not authoritative for long-term decision demotion/promotion alone until final.
- `final` — post-call source of truth written on the check-in.

### Call log row

Derived from `checkins` (transcript, decision, vitals, `voice_biomarkers`, `created_at`, `day_post_op`) plus, while in flight, the active live session as a synthetic “in progress” row.

No dedicated `call_logs` table for this iteration.

---

## 5. API contracts

### `POST /api/call` (extend)

On successful outbound call with `conversationId`:
- Upsert live session (`status: "active"`).
- Return `conversationId` as today (clients may still use `lib/sim/live-call.ts` sessionStorage for UX strip).

### `GET /api/live-call`

Query: optional `conversationId` (default: current active Margaret/demo session).

Response when idle:

```json
{ "status": "idle", "session": null, "recentCalls": [/* compact check-ins */] }
```

Response when active:

```json
{
  "status": "active",
  "session": {
    "conversationId": "…",
    "patientId": "margaret-ellison",
    "callStatus": "active",
    "turns": [],
    "biomarkers": { "status": "pending|ready|…", "phase": "during", "mapped": {} },
    "updatedAt": "…"
  },
  "recentCalls": []
}
```

Side effect: if session active and `now - lastTickAt >= 15s` and not `tickInFlight`, schedule/run a tick (or client may call tick explicitly — implementation may choose either, but coalescing is required).

### Tick behavior (~15s)

1. If overlapping tick → no-op.
2. Fetch ElevenLabs conversation → update `turns` + detect ended status.
3. Best-effort fetch audio → Amplifier respiratory + cognitive → map → set `biomarkers` with `phase: "during"`.
4. On audio/Amplifier failure → keep last good snapshot; set pending/unavailable/error as appropriate; never escalate from failure.
5. If conversation ended → set `finalizing` and trigger final path (check-in finalize / analyze) when transcript/check-in available.

### Post-call final

Existing orchestration:
- Fetch full audio → Amplifier both domains → `phase: "final"`.
- `evaluate()` with fail-open / never demote rules already in `analyze-checkin.ts`.
- Persist `checkins.voice_biomarkers` + decision fields.
- Surfaces that read latest check-in / roster-derived state refresh on next load or poll.

---

## 6. UI behavior

### `/call` (CallStage)

- **Idle:** current fixture timeline + engine props via `loadCallStageProps`.
- **Active:** left pane = live `turns`; right pane keeps clinical/vitals style; Amplifier values shown in the existing clinical/biomarker-adjacent readout (no new card-heavy chrome; match CallStage language).
- **Compact call log:** recent calls below or beside the stage (one purpose: history), active call marked in progress.
- Poll `GET /api/live-call` every ~2–3s for UI freshness; Amplifier numbers only change when server tick completes.

### Clinician chart

- Full **Call history** from check-ins (said/transcript summary, duration if known, decision, biomarker summary).
- Live embed (`?live=1` / CallStage hub variant) uses same live session feed when active.
- Voice Biomarkers panel shows latest final (or during while live).
- Worklist / action board / linked status refresh from updated check-in/decision after final analyze.

### Family surface

- Still severity/script only — no Amplifier jargon (unchanged product rule).

---

## 7. Error handling & states

| Condition | Behavior |
|---|---|
| No conversation / missing ElevenLabs keys | Fixture CallStage; live API returns idle |
| Mid-call audio missing | Skip Amplifier that tick; keep prior snapshot |
| Amplifier credentials/errors | `unavailable` / `error`; fail-open |
| Tick > 15s latency | Coalesce; UI shows last values |
| Final analyze fails | Check-in persisted; prior decision kept |
| Supabase missing | In-memory live session; call log from roster/fixtures where needed |

**Session status:** `active` · `finalizing` · `completed` · `error` (plus API-level `idle` when no session).  
**UI-derived:** `analyzing` when `tickInFlight` or biomarkers `pending` while session is `active`.  
Severity presentation still via `lib/ui/severity.ts` only.

---

## 8. Testing

- Unit: live-session store, tick coalescing, phase mapping, fail-open during vs final.
- API: `/api/live-call` idle vs active; `/api/call` registers session; overlapping ticks do not double-submit.
- UI: CallStage fixture → live switch; compact log + chart history; biomarkers panel updates on poll.
- Regression: existing Amplifier/check-in/call tests remain green; LLM never decides escalation.

---

## 9. Out of scope

- Amplifier WebSocket / true streaming audio pipeline
- New sentiment/emotion vendor
- Redesigning CallStage visual system
- Dedicated `call_logs` table (unless persistence gaps force it later)
- Changing mid-call `/api/triage` to include Amplifier (symptoms/vitals only remains)

---

## 10. Implementation notes

- Prefer extending existing modules over parallel stacks.
- Client `lib/sim/live-call.ts` can remain as the lightweight “call is active” strip signal; server session is authoritative for turns + biomarkers.
- Margaret remains the demo hero patient id (`margaret-ellison` / DB demo patient).
- Document any ElevenLabs mid-call audio limitations discovered during implementation in a short spike note if the during-call path must degrade to transcript-only until hangup.
