# Agent handoff — Mend

Written 2026-07-25 ~15:35 BST; **updated 2026-07-25 evening** after Amplifier voice
biomarkers (Tasks 1–12). Hackathon demo is **tomorrow (Sunday 26 July)**, judged by four
YC alumni building medtech companies. First prize is a guaranteed YC interview.

Read this, then `docs/superpowers/plans/2026-07-25-mend-rev2.md` (core product plan),
`docs/superpowers/plans/2026-07-25-amplifier-voice-biomarkers.md` (Amplifier path), and
`docs/demo-runbook.md` (stage sequence, credentials, fallbacks).

---

## 1. State right now

Core Mend (21 planned tasks + P1 correctness) is in place. **Amplifier post-call voice
biomarkers (Tasks 1–12) are built** on branch `feat/amplifier-voice-biomarkers` in worktree
`.worktrees/amplifier-voice-biomarkers`. Mid-call triage stays symptoms/vitals-only; after a
voice check-in with `conversationId`, Mend fetches ElevenLabs audio → Amplifier V2
**use-case** `respiratory` + `cognitive` → maps into `evaluate()` → updates
`checkins.voice_biomarkers` + decision. Clinician chart shows a biomarkers panel.

| Check | Expected (verified on Amplifier worktree 2026-07-25) |
|---|---|
| `npx tsc --noEmit` | clean (exit 0) |
| `npm test` | **637 passing / 65 files** (posttest vignettes 23/23) |
| `npm run build` | not re-run this session — run before deploy |
| `node scripts/visual-check.mjs` | captures `/family?state=urgent` (from P1 wave) |

**Deployed:** https://mend-ten.vercel.app — still the prior deploy until this branch is merged
and redeployed. Vercel project `mend` under `vikkashs-projects`.

**Git (current Amplifier work):** branch `feat/amplifier-voice-biomarkers`, worktree
`.worktrees/amplifier-voice-biomarkers`. Do **not** assume the primary checkout's branch is
stable. `origin` = `yashs03-hub/mend`, `fork` = `vikkash27/mend`. Older P1 work lived on
`fix/p1-correctness` in `.worktrees/p1-correctness`.

**Routes:** `/` launch pad · `/call` demo peak · `/family` · `/clinician` ·
`/clinician/engine` vignette suite · `/console` operator surface (`Ctrl/⌘⇧M`) · `/styleguide`.

### Amplifier — ops before live demo

1. **Supabase** (existing DBs that already ran `schema.sql` before the column landed):
   ```sql
   alter table checkins add column if not exists voice_biomarkers jsonb;
   ```
   Fresh installs from current `lib/db/schema.sql` already include the column.
2. **Env** (local `.env` + Vercel):
   - `AMPLIFIER_API_KEY` — V2 API key (`mak_…` from Console → API Keys). V1 secret keys do not auth `/v2/*`.
   - `AMPLIFIER_ACCOUNT_ID` — account id (`acct_…`) for `X-Account-ID`.
3. **Streaming dropped for v1** — no mid-call WebSocket / during-call factor UI. Post-call
   analyze + job poll only. See `docs/amplifier-streaming-spike.md`.
4. **Fail-open locked** — missing audio, credentials, or Amplifier errors →
   `voice_biomarkers` status `unavailable` / `error` and **keep the prior decision**. Never
   escalate or reassure solely because biomarkers failed.

### The single biggest risk (unchanged)

`.env` still lacks live Anthropic / ElevenLabs / Twilio / Supabase credentials (and now also
Amplifier keys for the post-call path), and Vercel may be missing mirrors. The live site is
still largely fixture-mode. `/console` / demo-status show missing keys by name. See
`docs/demo-runbook.md`.

Without `ANTHROPIC_API_KEY`, extraction fails safe → every typed check-in comes out amber,
including the green scenario. That is correct behaviour, not a bug.

Cross-isolate `demo_state` durability for `/family` and `/call` is **wired**
(`await loadActiveScenario()`) but **unproven** until Supabase keys exist.
Post-call Amplifier analysis is **wired** but needs live `AMPLIFIER_*` + ElevenLabs +
Supabase to prove end-to-end on stage.

---

## 2. Hard constraints — do not violate these

From the plan's Global Constraints. Reviewers have already caught violations of the first two.

1. **The LLM never makes an escalation decision.** Only `evaluate()` in
   `lib/clinical/red-flag-engine.ts` returns green/amber/red. Claude extracts, parses documents
   and writes prose. Note the subtle failure mode: a model can change severity *by omission*,
   not just by writing a level.
2. **Fail-safe direction is always toward escalation.** On ambiguity, missing or poor-quality
   data, fall back to symptom-only rules. Never reassure on uncertainty.
3. Synthetic patient data only. Real device readings belong to the operator and are labelled so.
4. Every user-facing surface shows "not medical advice".
5. Market is the **United States**: ER, 911, care team, nurse line. No NHS terms, and no British
   spellings or register (don't reintroduce "Mum", "ring", "frame", `en-GB`).
6. Mend never re-derives ECG rhythm. It consumes the KardiaMobile 6L's FDA-cleared
   determination as an input.
7. Every clinical threshold carries a `source` string naming its provenance. Uncited judgement
   calls are logged in `docs/clinical-decisions.md`.
8. TypeScript strict. No `any` in `lib/clinical/**`.

**Design system:** serif (IBM Plex Serif) for human voice, sans (IBM Plex Sans) for machine data,
tabular-nums on figures; "grayscale until it matters" with colour reserved for severity;
`lib/ui/severity.ts` is the single source of truth; severity never conveyed by colour alone;
WCAG AA; 44px touch targets; family surface minimum 19px and never any rule ids or jargon.

---

## 3. Things that will bite you

**The branch moves under you.** Prefer `.worktrees/` (now gitignored) or a separate clone.
**Verify `git branch --show-current` immediately before every commit.**

**Thymia remains deliberately parked.** Do not run `git stash pop`, and do not add
`therapyAdherent` or `adherenceDays` fields. Amplifier (`respiratory` + `cognitive` post-call)
is the voice-biomarker path that shipped instead — not a Thymia revival.

**`tailwind-merge` silently deletes semantic font-size classes.** Register new semantic size
tokens in `lib/utils.ts`. Look at screenshots, not just the harness.

**Never trust a report over the artefact.** Open `.visual/` PNGs with an image-reading tool.
For the PE family frame, look at `family-state-urgent--*.png`, not `family-state-attention`
(attention is drift/amber by design).

**Don't run concurrent agents that commit to the same branch.**

---

## 4. What was fixed (don't re-litigate)

### Prior session (see previous handoff narrative)

- False green on extraction failure; speakable triage errors; tachycardia threshold wording;
  disclaimers; US English; launch pad; family 19px; harness escalated/attention frames;
  console drives family/call; durable caregiver SMS insert (without check-in link — fixed below).

### This session — P1 on `fix/p1-correctness` (`f022219..9e7954f`)

| ID | Fix | Commit(s) |
|---|---|---|
| S2 | Check-in vitals rows use a fresh `recorded_at` via `buildCheckinVitalsInsert` | `ad018ae` |
| S1 | Early SMS audit returns id; `linkEscalationCheckin` after `insertCheckin`; warn on soft-fail | `89e82f3`, `0e2ba64` |
| S3 | `qualityFromSensorContact`: contact lost → `quality: "poor"` | `6efac30` |
| async | `/family` and `/call` `await loadActiveScenario()` | `3eb446f` |
| urgent | `?state=urgent` → PE; harness adds `/family?state=urgent`; `attention` stays drift | `9e7954f` |

Per-task reviews were clean (S1 needed one logging fix loop). Full suite: **464 tests / 41 files**.

---

## 5. Pending work, in priority order

### P0 — user action, blocks everything

Get `ANTHROPIC_API_KEY`, the three Supabase values, and (for voice biomarkers)
`AMPLIFIER_API_KEY` + `AMPLIFIER_ACCOUNT_ID` into `.env`. Run `lib/db/schema.sql` in the
Supabase SQL editor (idempotent, self-seeds Margaret). If the project already had schema
applied before Amplifier landed, also run:

```sql
alter table checkins add column if not exists voice_biomarkers jsonb;
```

Mirror keys to Vercel with `vercel env add <NAME> production` and redeploy. Rehearse all
three scenarios end to end and **record the backup video tonight.**

Merge / push `feat/amplifier-voice-biomarkers` (includes P1 + Amplifier) before or with that
redeploy so production gets the latest code.

### P1 — done on this branch

All five items from the prior handoff are implemented and task-reviewed. Remaining risk is
**live verification** (needs P0 keys), not missing code.

Presenter note: for the PE family deep link use **`/family?state=urgent`**. Never use
`attention` for the PE cut (`attention` = drift/amber).

### P2 — credibility polish, only if P0 is done

- **°C vs °F.** Do both engine rationale and display together, or neither.
- Family view at projector width is a narrow `max-w-md` column — sparse on stage.
- `SeverityChip` light red on solid red takeover — readable but low-contrast.
- Rehearse that `tel:911` does nothing on a desktop browser.

### Explicitly not doing

- **Thymia** biomarkers and RTM adherence — still parked (Amplifier is the shipped path).
- Mid-call Amplifier **streaming** — dropped for v1.
- Clinician-patient messaging portal — deprioritised.

---

## 6. Working preferences

- **Models:** Prefer Grok 4.5 (`cursor-grok-4.5-high-fast`) for implementation subagents.
- **Workflow:** subagent-driven development with a separate read-only reviewer pass.
- **Verification:** require real command output and actual screenshot viewing. State plainly
  what could *not* be verified — missing credentials leave many paths unproven.
- Honest status over reassurance.
