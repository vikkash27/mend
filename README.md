# Mend

**A voice-first recovery co-pilot for orthopaedic patients after they go home.**

Between discharge and the six-week clinic, nobody is watching. Complications cluster in
exactly that window — venous thromboembolism, surgical site infection, dislocation,
delirium — and the patients least able to use an app are the ones most at risk. Mend calls
them instead.

> ⚠️ **Educational prototype — not medical advice. All data is synthetic.**
> Mend routes concerns to a clinician; it does not diagnose, and it must not be used for
> real patient care. See [Safety](#safety).

---

## The thesis

**LLMs at the edges. A deterministic core.**

```
  voice call  ──▶  Claude          ──▶  red-flag engine  ──▶  Claude        ──▶  clinician
  (ElevenLabs)     extracts             DETERMINISTIC          writes SBAR
                   symptoms             green/amber/red        summary
  wearables   ──▶  vitals
  (HR/BP/ECG/temp) normalised
```

The language model transcribes, extracts structured symptoms, and writes the handoff note.
It **never decides whether to escalate**. Every green/amber/red verdict comes from a plain
TypeScript rule table that is auditable, unit-tested, and reproducible — the same inputs
always produce the same verdict, and every verdict carries the list of rules that fired.

That boundary is the product. It is also what separates this from a chatbot with a
stethoscope emoji.

## Scope

| | |
|---|---|
| **Setting** | At home, post-discharge — *not* the inpatient ward |
| **Hero procedure** | Hip arthroplasty (elective THA + hip-fracture hemiarthroplasty) |
| **Persona** | 82F, hemiarthroplasty after hip fracture, discharged POD 3, living alone |
| **Market** | US — RPM (`99453/99454/99457/99458`) and RTM (`98975/98977/98980/98981`) |
| **Inputs** | Voice check-in + heart rate, blood pressure, 3-lead ECG, temperature |

The ward already has nurses, mandated observations and a crash team. Home has none of
those, no billing pathway competitor, and a hospital that pays real money for readmissions
it never saw coming.

## Repo layout

```
docs/
  superpowers/specs/    design spec — the approved "what and why"
  superpowers/plans/    implementation plan — 12 TDD tasks with full code
  mockups/              interactive UI mockup (open in a browser)
```

`docs/mockups/mend-ui-mockup.html` is a standalone file — open it directly, no build step.
Toggle between the two demo scenarios to see the same engine hold green on a low-grade
fever and escalate on a suspected PE.

## Getting started

The build is specified end-to-end in
[`docs/superpowers/plans/2026-07-23-mend.md`](docs/superpowers/plans/2026-07-23-mend.md).
Work the tasks in order — the clinical core (tasks 2–5) has no external dependencies and
can be built and green-tested entirely offline.

```bash
npm install
npm test          # clinical core — must pass before anything else ships
npm run dev
```

Copy `.env.example` to `.env.local` and fill in your own keys. **Never commit `.env*`** —
it is gitignored, and it should stay that way.

## Safety

- Synthetic data only. No real patient data enters this repo, ever.
- The disclaimer is rendered in the UI, not buried in a footer.
- Escalation advice routes to a human clinician. Mend does not diagnose.
- The red-flag engine fails **toward** escalation: when vitals are missing or implausible,
  symptom-only rules still apply rather than silently downgrading a verdict.

### Known gap: threshold provenance

The clinical thresholds currently in the spec and plan (`hr > 110`, `tempCMax 38.0` for the
early phase, the phase boundaries) are **plausible but uncited** — they came from general
medical knowledge, not from a document you can point a reviewer at.

Before this goes anywhere near a real patient, every threshold needs a `source` field
naming its origin (NEWS2, Sepsis-3, Wells/PERC, AAOS CPGs, MSIS criteria, NSQIP timing
data) *and* a recorded rationale for how it was adjusted — because those instruments were
validated on a clinician examining a patient in person, and Mend has four vitals and a
phone call.

## Stack

Next.js (App Router, TypeScript) · ElevenLabs Conversational AI · Claude (Sonnet) ·
Supabase · Vitest · Vercel
