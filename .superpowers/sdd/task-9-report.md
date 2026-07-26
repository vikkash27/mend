# Task 9 Report: CallStage live mode + Amplifier readout + compact call log

## Status
DONE

## Summary
Wired `useLiveCallFeed` into `CallStage` so active/finalizing sessions with turns drive the transcript from `liveTurnsToEvents`, added a compact Amplifier readout in the clinical column, and mounted a past-calls log (full compact list on `stage`, single-line chart link on `hub`). Idle fixture keyboard / `?play=` / `?stage=` behavior is preserved until the first live turn arrives.

## Files
| Action | Path |
|---|---|
| Create | `app/components/call/call-stage-live.ts` |
| Create | `app/components/call/LiveBiomarkersReadout.tsx` |
| Create | `app/components/call/CallLogCompact.tsx` |
| Create | `app/components/call/live-stage-readouts.test.ts` |
| Modify | `app/components/call/CallStage.tsx` |
| Modify | `app/components/clinician/VoiceBiomarkersPanel.tsx` |
| Modify | `lib/telephony/call-log.ts` (tsc: accept `unknown` decision/biomarkers from `CheckinRow`) |

## Behavior
- **Live transcript:** `hasLiveTranscript` / `transcriptEventsForStage` switch to live events only when status is `active`|`finalizing` and `turns.length > 0`; otherwise fixture events remain.
- **Amplifier readout:** `LiveBiomarkersReadout` renders when `session.biomarkers` is present — eyebrow “Amplifier readout”, phase (“during call” / “final”), domain rows with `SeverityChip` + numeric scores.
- **Call log:** `CallLogCompact` below the stage for variant `stage` (filters `inProgress`); hub shows `CallLogHubNote` (“N past calls” → chart).
- **Idle controls:** cursor playback, space/arrows/R, and `?play=`/`?stage=` remain while not in live transcript mode.
- **Panel:** optional phase eyebrow on `VoiceBiomarkersPanel` (“During call” / “Final analysis”).

## Verification
- `npx vitest run app/components/call/live-stage-readouts.test.ts lib/telephony/call-log.test.ts` — 8 passed
- `npx tsc --noEmit` — clean (after call-log unknown narrowing)

## Commit
`8f209f9` — feat(call): live transcript, Amplifier readout, and compact call log on CallStage

## Concerns
None material. Pre-existing `CheckinRow.decision: unknown` vs `callLogFromCheckins` typing was fixed in `call-log.ts` so tsc passes; not a CallStage behavior change.

## Review fix (Important Task 9)

### Findings fixed
1. **Live clock frozen:** In `liveMode`, header/vitals `elapsed` no longer uses fixture `scripted.elapsed` while the second ticker is stopped. Added `stageElapsedSeconds` so live mode reads the last visible live event `at`; idle mode keeps `Math.max(ticker, scripted.elapsed)`.
2. **Play hint during live:** The `?play=1` keyboard hint (“Space pauses · → steps forward · R restarts”) is gated on `!liveMode`, matching the keyboard handler bailout.

### Test evidence
- `npx vitest run app/components/call/live-stage-readouts.test.ts lib/telephony/call-log.test.ts app/components/call/live-turns.test.ts` — 12 passed (includes new `stageElapsedSeconds` live vs idle clock assertion)
- `npx tsc --noEmit` — clean
