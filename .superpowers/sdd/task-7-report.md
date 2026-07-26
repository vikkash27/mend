# Task 7 Report: `GET /api/live-call` (+ register from `/api/call`)

## Status

**Complete** — implemented via TDD on `cursor/live-voice-call-data-333c`; focused tests and lint are passing.

## Deliverables

| File | Purpose |
|------|---------|
| `app/api/live-call/route.ts` | Poll endpoint for the current/specified live call plus recent call history |
| `app/api/live-call/route.test.ts` | TDD coverage for idle fallback and active-session polling behavior |
| `app/api/call/route.ts` | Registers a live session after a successful outbound call with a `conversationId` |
| `app/api/call/route.test.ts` | Regression test proving successful outbound calls upsert the live session |

## Implementation

- **`GET /api/live-call`:**
  - Reads optional `conversationId` from the query string and resolves the session via `getLiveSession()`.
  - Returns `{ status: "idle", session: null, recentCalls }` when no live session exists.
  - Returns the brief’s session payload shape when a session exists: `conversationId`, `patientId`, `callStatus`, `turns`, `biomarkers`, `updatedAt`, `tickInFlight`.
  - Fires `runLiveTick({ conversationId })` in a fire-and-forget path when the session is `active` or `finalizing`; tick coalescing is left to `runLiveTick()`.
- **Recent calls loading:**
  - Uses Supabase when available by fetching the demo patient id and then `fetchRecentCheckins()`.
  - Falls back to Margaret’s synthetic roster check-ins via `findPatient("margaret-ellison")`.
  - Uses `callLogFromCheckins()` for mapping and `prependActiveSession()` so active calls appear at the top of the history list.
- **`POST /api/call`:**
  - Preserves all existing response behavior.
  - Adds `upsertLiveSession({ conversationId, patientId: patientId ?? "margaret-ellison" })` when `startCheckInCall()` returns `{ status: "sent", conversationId }`.

## TDD Steps

1. Added failing API tests for:
   - idle `/api/live-call` with roster fallback
   - active `/api/live-call` with fire-and-forget tick + prepended active row
   - successful `/api/call` registration of a live session
2. Verified RED:
   - `/api/live-call` failed with `Cannot find module '/app/api/live-call/route'`
   - `/api/call` registration test failed because `upsertLiveSession` was never called
3. Implemented the minimal route and registration logic.
4. Re-ran the focused specs to confirm GREEN.
5. Refactored the new route response type to use `LiveCallSession` directly, then re-ran tests and lint.

## Test Summary

```bash
npx vitest run app/api/live-call/route.test.ts app/api/call/route.test.ts

 Test Files  2 passed (2)
      Tests  12 passed (12)

npx vitest run app/api/live-call/route.test.ts app/api/call/route.test.ts lib/telephony/call-log.test.ts lib/telephony/live-session.test.ts lib/telephony/live-tick.test.ts

 Test Files  5 passed (5)
      Tests  26 passed (26)

npx eslint app/api/live-call/route.ts app/api/live-call/route.test.ts app/api/call/route.ts app/api/call/route.test.ts
```

## Commit

```text
feat(api): live-call poll endpoint and session registration on outbound call
```

## Concerns

- `session.callStatus` currently mirrors the stored live-session `status` because the in-memory session interface does not yet persist ElevenLabs’ separate conversation status string. This matches the briefed response shape for Task 7, but a later task may choose to distinguish them.
