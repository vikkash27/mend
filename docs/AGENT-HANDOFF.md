# Agent handoff — Mend

Written 2026-07-25 15:20 BST. Hackathon demo is **tomorrow (Sunday 26 July)**, judged by four
YC alumni building medtech companies. First prize is a guaranteed YC interview.

Read this, then `docs/superpowers/plans/2026-07-25-mend-rev2.md` (the implementation plan and
binding constraints) and `docs/demo-runbook.md` (stage sequence, credentials, fallbacks).

---

## 1. State right now

All 21 planned tasks are built. `HEAD` is `d34179d`.

| Check | Expected |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | 447 passing / 39 files |
| `npm run build` | compiles, 17 static pages |
| `node scripts/visual-check.mjs` | 9 entries all `ok`, ends "no accessibility findings" |

**Deployed:** https://mend-ten.vercel.app — Vercel project `mend` under `vikkashs-projects`.
(`mend.vercel.app` was already taken by another account; `mend-ten` is the assigned alias.)

**Git:** `main`, `origin/main`, `origin/feat/mend-build` and `fork/feat/mend-build` all point
at `d34179d`. `origin` = `yashs03-hub/mend` (team repo), `fork` = `vikkash27/mend`.

**Routes:** `/` launch pad · `/call` demo peak · `/family` · `/clinician` ·
`/clinician/engine` vignette suite · `/console` operator surface (`Ctrl/⌘⇧M`) · `/styleguide`.

### The single biggest risk

`.env` contains only `THYMIA_API_KEY` (unused). **Anthropic, ElevenLabs, Twilio and Supabase
are all empty, and Vercel has no environment variables at all.** Nothing in this project has
ever run against a live service. Everything below is verified against unit tests, fixtures and
screenshots only. Treat "tests pass" and "works" as different claims.

The live site is therefore running entirely on fixtures. `/console` shows every missing key by
name. See `docs/demo-runbook.md` for the acquisition order — it matters, because the ElevenLabs
agent cannot be finished until Vercel is deployed and the Twilio number is imported.

Consequence worth knowing before you debug something that isn't broken: extraction now fails
safe, so **without `ANTHROPIC_API_KEY` every typed check-in comes out amber**, including the
green scenario. That is correct behaviour, not a bug.

---

## 2. Hard constraints — do not violate these

From the plan's Global Constraints. Reviewers have already caught violations of the first two.

1. **The LLM never makes an escalation decision.** Only `evaluate()` in
   `lib/clinical/red-flag-engine.ts` returns green/amber/red. Claude extracts, parses documents
   and writes prose. Note the subtle failure mode: a model can change severity *by omission*,
   not just by writing a level. That was a real bug (see §4).
2. **Fail-safe direction is always toward escalation.** On ambiguity, missing or poor-quality
   data, fall back to symptom-only rules. Never reassure on uncertainty. `.superpowers/sdd/review-backend.md`
   has a full per-path audit table — extend it if you add an error path.
3. Synthetic patient data only. Real device readings belong to the operator and are labelled so.
4. Every user-facing surface shows "not medical advice".
5. Market is the **United States**: ER, 911, care team, nurse line. No NHS terms, and no British
   spellings or register (this was cleaned up; don't reintroduce "Mum", "ring", "frame", `en-GB`).
6. Mend never re-derives ECG rhythm. It consumes the KardiaMobile 6L's FDA-cleared
   determination as an input.
7. Every clinical threshold carries a `source` string naming its provenance. Uncited judgement
   calls are logged in `docs/clinical-decisions.md`.
8. TypeScript strict. No `any` in `lib/clinical/**`.

**Design system:** serif (Instrument Serif) for human voice, sans (Inter) for machine data,
tabular-nums on figures; "grayscale until it matters" with colour reserved for severity;
`lib/ui/severity.ts` is the single source of truth; severity never conveyed by colour alone;
WCAG AA; 44px touch targets; family surface minimum 19px and never any rule ids or jargon.

---

## 3. Things that will bite you

**The branch moves under you.** A teammate works in this same working copy and has twice
checked out `main` mid-task — once causing a subagent to commit to `main`, once causing my own
commit to land there. **Verify `git branch --show-current` immediately before every commit.**
Ask whoever it is to use a separate clone or worktree.

**Thymia is deliberately parked.** The user explicitly said not to integrate it yet. The work
sits on branch `feat/thymia-parked` plus a git stash ("RTM adherence WIP"). Untracked
`docs/thymia-integration.md` and `docs/feature_proposals.md` are proposals, not plans. Do not
run `git stash pop`, and do not add `therapyAdherent` or `adherenceDays` fields.

**`tailwind-merge` silently deletes semantic font-size classes.** No build error, no test
failure — the text just renders at the wrong size. Mitigated by an allowlist in `lib/utils.ts`;
if you add a semantic size token you **must** register it there. This is why you must *look at
screenshots*, not just run the harness.

**Never trust a report over the artefact.** Both a subagent report and an automated a11y pass
called the escalation frame clean while it displayed two different numbers for one threshold.
It was caught by reading the PNG. `scripts/visual-check.mjs` writes to `.visual/`; open the
projector-width images with an image-reading tool.

**Don't run concurrent agents that commit to the same branch.** Scope each to disjoint
directories, or run them sequentially. Read-only reviewers can run in parallel safely.

**`public/vignettes.json` is a committed build artifact.** `npm test` regenerates it and
`/clinician/engine` renders it verbatim. If you change any rule `rationale`, `condition` or
`action` string, that file changes too — commit it and redeploy, or the vignette suite will
contradict the live engine. This exact trap left the escalation frame saying 100 while the page
built to prove clinical rigour still said 110. After touching `lib/clinical/**`, always check
`git status` for it.

---

## 4. What was fixed today (don't re-litigate)

- **False green on extraction failure.** `extractSymptoms` now returns `{ ok, symptoms }`;
  failure fires amber `symptoms.extraction_failed`, mirroring `vitals.unusable_no_data`. A test
  had been *asserting* the buggy green behaviour.
- **Triage errors are speakable.** 401/400 from `/api/triage` now include a conservative
  `script`, so the live agent can never improvise clinical wording mid-call.
- **Threshold wording.** "expected maximum" means the phase envelope bound everywhere
  (`trends.ts`, vitals tiles), but the tachycardia rule applied it to `hrMax + 10`, putting 100
  and 110 on the same frame. Rule text now cites the envelope max plus an explicit margin.
- Disclaimer added to every surface; operator/fixture chrome removed from `/call`; US English;
  `/` turned into a launch pad; family chrome raised to 19px; harness now covers
  `/call?stage=escalated` and `/family?state=attention` by default.
- Console scenario selector now drives `/family` and `/call` (query param still wins);
  family opener reads `lib/memory/last-checkin.ts`; caregiver notification made durable.

Full reviews: `.superpowers/sdd/review-backend.md` and `.superpowers/sdd/review-ui.md`.

---

## 5. Pending work, in priority order

### P0 — user action, blocks everything

Get `ANTHROPIC_API_KEY` and the three Supabase values into `.env`, run `lib/db/schema.sql` in
the Supabase SQL editor (it is idempotent, self-seeds Margaret, and now includes `pain_score`
and `demo_state`), then mirror the keys to Vercel with `vercel env add <NAME> production` and
redeploy. Rehearse all three scenarios end to end and **record the backup video tonight.**

### P1 — correctness gaps with clinical or audit impact

**S2 — pain score timepoints still collide.** `app/api/checkin/route.ts` line 203 uses
`recorded_at: args.vitals.timestamp`, i.e. the *existing* latest reading's timestamp. The
`pain_score` column landed but the intent (distinct per-reading timepoints for the pain trend)
did not. Two check-ins without a new vitals sample collide, and the schema has no uniqueness on
`(patient_id, recorded_at)`. Use a fresh timestamp and copy physiologic fields as values only.
*I previously reported the pain-score work as complete; it is not.*

**S1 — caregiver SMS audit row never links to the check-in.**
`app/api/checkin/route.ts` line 154 inserts the escalation row with `checkin_id: null` for SMS
durability, then line 235 skips the later insert. "Did we text the daughter for this check-in?"
becomes a join guess. Update the early row with `checkin_id` after `insertCheckin`.

**S3 — BLE ignores sensor contact.** `app/components/BleHeartRate.tsx` line 124 hardcodes
`quality: "ok"`. Contact state *is* parsed in `lib/ble/heart-rate.ts` 72-77 but unused. Contact
loss is poor quality by definition, and the fail-safe rule says poor quality means symptom-only.

**`/family` and `/call` read the scenario synchronously.** The store is now durable via
Supabase `demo_state`, but those two pages still use the sync getter, so they can lag across
serverless isolates. Fixture-mode demos on Vercel may show a green narrative under a red call.

**`?state=attention` on `/family` resolves to the drift scenario, not PE**
(`lib/sim/resolve-demo.ts:30`). The intended stage path is safe — select PE on `/console`, then
open `/family` with no query string, and it follows the store. But the deep link is a trap in two
ways: a driver who types it during the PE cut shows amber heart-rate creep instead of the
embolism, breaking the "one engine, three audiences, same event" story mid-demo; and the visual
harness screenshots that URL, so anyone reviewing `.visual/family-state-attention--*.png`
believes they are looking at the PE family view and are not. Consider adding an explicit
`?state=urgent` that maps to the PE fixture, and never use `attention` for the PE cut.

### P2 — credibility polish, only if P0 and P1 are done

- **°C vs °F.** US clinicians read °F for home monitoring; `LiveVitals.tsx` and the console show
  °C. I deliberately did **not** change this: converting only the display while the engine's
  rationale still says °C would recreate exactly the two-numbers-for-one-concept bug just fixed.
  Do both sides together or neither. Answering it verbally is a fine outcome.
- Family view at projector width is a narrow `max-w-md` column in a lot of empty paper
  (`app/family/page.tsx` ~170) — looks sparse during the stage cut.
- `SeverityChip` uses a light red fill on the solid red takeover; readable but low-contrast.
- Rehearse that `tel:911` does nothing on a desktop browser; the button is a visual anchor.

### Explicitly not doing

Thymia biomarkers and RTM adherence — parked at user request. A clinician-patient messaging
portal from `docs/feature_proposals.md` was deprioritised as lower value than the trend engine.

---

## 6. Working preferences

- **Models:** the user is near a usage limit. Prefer Grok 4.5 (`cursor-grok-4.5-high-fast`) for
  implementation subagents. Avoid Opus for routine building.
- **Workflow:** subagent-driven development with a separate read-only reviewer pass. The
  reviewers have earned their keep — they found the false-green and the threshold contradiction.
  Give implementers explicit scope boundaries and the "verify your own branch" warning.
- **Verification:** require agents to paste real command output and to actually view screenshots.
  Ask them to state plainly what they could *not* verify; the missing credentials mean a lot of
  paths are unproven, and reports that gloss over that are worse than useless.
- The user values honest status over reassurance. Say what is unproven.
