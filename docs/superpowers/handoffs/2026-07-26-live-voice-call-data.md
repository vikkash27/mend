# Handoff — Live Voice Call Data

**Date:** 2026-07-26  
**Branch:** `cursor/live-voice-call-data-333c`  
**PR:** https://github.com/vikkash27/mend/pull/1  
**Base:** `main`  
**Cloud agent run:** https://cursor.com/agents/bc-019f9dc9-6e1f-7881-a8e2-10436599333c  
**Owner context:** Make `/call` functional with real ElevenLabs turns + ~15s Amplifier biomarkers; call logs; post-call patient-file updates. Keep CallStage style. Amplifier = “sentiment” (no separate sentiment API).

---

## Read first

1. Spec: `docs/superpowers/specs/2026-07-26-live-voice-call-data-design.md`
2. Plan: `docs/superpowers/plans/2026-07-26-live-voice-call-data.md` (12 TDD tasks)
3. This handoff
4. Existing product constraints: `docs/AGENT-HANDOFF.md` (clinical fail-open, no Thymia, Amplifier post-call path)

Local SDD scratch (gitignored, may be missing on a fresh clone):
- `.superpowers/sdd/progress.md` — task completion ledger
- `.superpowers/sdd/task-N-brief.md` / `task-N-report.md` — per-task briefs/reports

---

## Goal (locked decisions)

| Topic | Choice |
|---|---|
| Approach | Server poll orchestrator — live session is source of truth |
| Live transcript | Poll ElevenLabs conversation; replace scripted timeline when active |
| Idle fallback | Scripted Margaret CallStage |
| Amplifier during call | REST upload + job poll ~every 15s (`phase: "during"`) — no WebSocket |
| Amplifier post-call | Existing analyze path (`phase: "final"`) — authoritative |
| Call log | Compact on `/call` + full history on clinician chart |
| Patient file | Update biomarker-linked surfaces after final analyze |
| Style | Maintain CallStage visual language |

---

## Progress

| Task | Status | Notes |
|---|---|---|
| 1. `phase` on VoiceBiomarkersRecord | **Done** | `phase?: "during" \| "final"`; post-call stamps `"final"` |
| 2. Live session store | **Done** | `lib/telephony/live-session.ts` — 15s coalesce |
| 3. ElevenLabs conversation fetch | **Done** | `lib/telephony/elevenlabs-conversation.ts` |
| 4. During-call Amplifier snapshot | **Done** | `analyzeLiveVoiceSnapshot` — no `evaluate()`; plan-mandated duplication of analyze-checkin orchestration left as-is |
| 5. Live tick orchestrator | **Done** | Snapshot on fetch failure for active; skip if finalizing/completed/error |
| 6. Call log helpers | **Done** | Prepend in-progress row only for `status === "active"` |
| 7. `GET /api/live-call` + register on `/api/call` | **Done** | |
| 8. Live turns mapper + poll hook | **Done** | Generation gate; skip if in-flight; abort only on unmount |
| 9. CallStage live UI + readout + compact log | **Done** | Live clock from last event; hide play hint in liveMode |
| 10. Clinician CallHistory + live biomarker bind | **Done** | Overview + Audit subsection; no new tab |
| 11. Finalizing → post-call analyze | **Done (fix committed)** | Demotion race fix: skip if ready+final or pending; re-read before persist; never write demoting decision |
| 12. Docs + full verification | **Done** | Runbook Live `/call` data subsection; spec status → Implemented; `npm test` 688/688 + vignettes 23/23; `npx tsc --noEmit` clean |

**Resume here:** Whole-branch review + finishing-a-development-branch.

---

## Architecture (as shipped)

```
POST /api/call → upsertLiveSession(conversationId, patientId)
GET  /api/live-call (poll 2–3s) → fire-and-forget runLiveTick (~15s coalesce)
  → fetchConversationDetails (turns)
  → analyzeLiveVoiceSnapshot (phase: during) when active
  → on ended → status finalizing → finalizeLiveSession
       → interim during snapshot on session
       → if check-in match & not already final/pending → analyzeCheckinVoiceBiomarkers + updateCheckinAfterBiomarkers
       → session completed
```

UI:
- `CallStage` uses `useLiveCallFeed`; live turns replace fixture when turns arrive
- `LiveBiomarkersReadout` + `CallLogCompact` on `/call`
- `CallHistory` on clinician chart; VoiceBiomarkersPanel binds during-phase live biomarkers

---

## Key files

| Path | Role |
|---|---|
| `lib/telephony/live-session.ts` | In-memory session store |
| `lib/telephony/elevenlabs-conversation.ts` | Transcript turns |
| `lib/telephony/live-tick.ts` | 15s tick |
| `lib/telephony/live-finalize.ts` | Post-call handoff (demotion-safe) |
| `lib/telephony/call-log.ts` | Call log rows |
| `lib/amplifier/analyze-live-snapshot.ts` | During-call Amplifier |
| `app/api/live-call/route.ts` | Poll API |
| `app/api/call/route.ts` | Registers session |
| `app/components/call/CallStage.tsx` | Live/fixture switch |
| `app/components/call/use-live-call-feed.ts` | Client poll |
| `app/components/clinician/CallHistory.tsx` | Chart history |
| `app/components/clinician/PatientChart.tsx` | Wired CallHistory + live biomarkers |

---

## Open items / known gaps

1. **Plan-mandated duplication** — `analyze-live-snapshot.ts` duplicates submit/poll/map from `analyze-checkin.ts` (reviewer Important, plan-mandated; human can choose extract shared helper later).
2. **Live clock is turn-stepped** — header holds between turns (Minor).
3. **`getLiveSession()` multi-session preference** lightly tested (Minor).
4. **Env keys** — live path needs `ELEVENLABS_*`, `AMPLIFIER_*`, optionally Supabase; without keys, fixture Margaret still works.
5. **Mid-call audio** — ElevenLabs audio GET may be unavailable until hangup; during-call Amplifier is best-effort; fail-open keeps last good snapshot.
6. **Do not** revive Amplifier WebSocket streaming or Thymia.

---

## How to continue (recommended)

```bash
git fetch fork cursor/live-voice-call-data-333c
git checkout cursor/live-voice-call-data-333c
git pull fork cursor/live-voice-call-data-333c

# Whole-branch review + finishing-a-development-branch
# Update PR body if needed
```

Clinical invariants (do not violate):
- LLM never chooses escalation
- Fail-open; never demote on voice alone
- Mid-call `/api/triage` stays symptoms/vitals-only
- Family surface: no Amplifier jargon

---

## Verification (Task 12)

- `npm test` — 76 files / 688 tests passed; posttest vignettes 23/23
- `npx tsc --noEmit` — clean
- Docs: `docs/demo-runbook.md` Live `/call` data subsection; spec status **Implemented**
