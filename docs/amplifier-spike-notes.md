# Amplifier API spike notes

**Date:** 2026-07-25  
**Status:** BLOCKED — missing credentials (live spike not run)

## Credentials

Required env vars (documented in `.env.example`; never commit real values):

- `AMPLIFIER_API_KEY`
- `AMPLIFIER_ACCOUNT_ID`

Checked worktree `.env`, main repo `.env`, `.env.local`, and process env. No Amplifier keys present under those names or alternate Amplifier-related names. (Parked `THYMIA_API_KEY` is unrelated and was not used.)

**Unblock:** add both vars to the worktree `.env`, then run:

```bash
node scripts/spike-amplifier.mjs
```

Optional: pass a ≥10s WAV path as the first arg; otherwise the script generates a 12s local tone WAV.

## Docs-derived API shape (not yet live-verified)

From [Amplifier Dev Hub](https://docs.amplifierhealth.com/):

| Step | Method / path | Notes |
|---|---|---|
| Submit | `POST /v2/models/{model_name}/analyze` | Multipart field `audio`; headers `X-Account-ID`, `X-API-Key` |
| Poll | `GET /v2/jobs/{job_id}` | Until `status` is `done` (or webhook) |
| Result | `result.summary.overall_level`, `result.summary.recommended_action`, `result.signals[]` | Documented routing fields |

Example in docs uses `model_name=apex`. Spike script also probes (in order):

1. `POST /v2/use-case/analyze` with use-case fields `respiratory` then `cognitive`
2. `POST /v2/models/respiratory/analyze` and `.../cognitive/analyze`
3. `POST /v2/models/apex/analyze` last resort

**Open until live run:** whether `respiratory` / `cognitive` are use-case values or model path segments (or only available via apex).

## Working endpoint(s)

_Not captured — spike blocked on missing keys._

## Latency

_Not measured._

## Result shape (`overall_level` / `signals`)

_Not captured._ Expected from docs once live:

- `result.summary.overall_level`
- `result.summary.recommended_action`
- `result.signals[]`

Fixture target after successful run: `lib/amplifier/fixtures/sample-job-done.json` (sanitized).

## Streaming availability

Public docs describe REST upload + job poll (and optional webhook). No WebSocket / mid-call streaming API documented on the Dev Hub landing page.

**v1 recommendation:** **drop streaming for v1** until a documented WS path is found and proven. Post-call analyze + poll remains the authoritative path.

## Fail-safe recommendation

Deferred until a live job completes. Tentative framing only (not locked):

| Option | Behavior |
|---|---|
| A — fail-open | Missing/failed Amplifier → keep prior triage decision |
| B — caution | Missing/failed Amplifier → nudge toward caution / re-check without inventing PE |

**Lock A vs B only after live payload + latency are known.**
