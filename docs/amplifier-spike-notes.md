# Amplifier API spike notes

**Date:** 2026-07-25  
**Status:** LIVE SUCCESS (V2)

## Credentials

| Env var | Role |
|---|---|
| `AMPLIFIER_ACCOUNT_ID` | `X-Account-ID` — form `acct_…` |
| `AMPLIFIER_API_KEY` | `X-API-Key` — V2 key form `mak_…` |

**Important:** A V1 **secret** key (`X-Secret-Key` on `/api/v1/...`) will **not** authenticate V2. Create a V2 API key under Console → API Keys. Documented in `.env.example`.

Verified: `GET /v2/account/credits` → 200 with remaining credits.

## Working endpoint(s)

| Step | Method / path | Notes |
|---|---|---|
| Submit | `POST https://api.amplifierhealth.com/v2/use-case/analyze` | Multipart: `audio` + `use_case` (`respiratory` \| `cognitive`) |
| Poll | `GET https://api.amplifierhealth.com/v2/jobs/{job_id}` | Until `status` is `done` |
| Auth | Headers | `X-Account-ID`, `X-API-Key` |

Also accepted (not preferred): `POST /v2/models/{name}/analyze` — rejected for short audio the same way; use-case path is what we lock for Mend.

**Minimum audio duration: 15 seconds** (12s tone → `AUDIO_TOO_SHORT`).

## Latency (live tone WAV, 16s)

| Use case | Approx total (submit + poll to done) |
|---|---|
| `respiratory` | ~20s |
| `cognitive` | ~19s |

## Result shape

Fixtures:

- `lib/amplifier/fixtures/sample-job-done.json` — respiratory (COPD + Allergy signals)
- `lib/amplifier/fixtures/sample-cognitive-done.json` — cognitive impairment signal

Documented fields present:

- `result.summary.overall_level` (tone sample → `"inconclusive"`)
- `result.summary.recommended_action` (`"inconclusive"`)
- `result.signals[]` — each `{ flagged, level, score, label, model_id }`
- `result.audio_quality` — `{ voice_percentage, issues[], audio_clarity }`

Signal `level` values observed: `"inconclusive"` (synthetic tone). Treat other levels (`low` / `moderate` / `high` or vendor synonyms) as unknown until real speech samples; mapper should normalize safely.

Respiratory signals on tone: `copd`, `allergy`. Cognitive: `cognitive-impairment`.

## Streaming availability

Public Dev Hub documents REST upload + job poll (optional webhook). No workable mid-call WebSocket path proven in this spike.

**v1 product decision: DROP streaming.** Post-call analyze + poll only.

## Fail-safe recommendation (locked)

**A — fail-open:** Missing keys, missing recording, job error/timeout, or `overall_level` / signal levels of `inconclusive` with `audio_quality` issues → keep the prior symptoms/vitals decision; store `voice_biomarkers.status = unavailable|error|ready` with mapped quality. Do **not** invent PE red from Amplifier alone.

Rationale from spike: synthetic/poor audio returns inconclusive quickly; blocking chart finalization would break the demo. Re-eval still may raise severity when mapped levels are high on real call audio.
