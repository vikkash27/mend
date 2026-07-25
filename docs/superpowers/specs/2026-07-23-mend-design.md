# Mend — Voice-First Post-Op Recovery Co-Pilot for Orthopaedics

**Design spec · 2026-07-23 (rev 2 — added vitals ingestion + US focus)**
**Context:** Hackathon build for *"Build the Future of Healthcare with Juno & Anthropic"* (London AI / Encode Club, 25–26 Jul 2026). First place = guaranteed YC interview. Sponsors: ElevenLabs, Supabase, Juno, Anthropic, OpenAI, Vercel. Rule: synthetic/anonymised data only; educational prototype, not medical advice.
**Market:** United States (Juno / YC lens). Terminology: ER, 911, care team / surgeon's office, nurse line.

---

## 1. One-liner

After orthopaedic surgery you're sent home with a paper sheet and a phone number you're scared to call. **Mend calls you every day, asks how you're doing in plain conversation, fuses your answers with objective vitals from home devices, runs both through a real clinical safety engine, progresses your rehab when you're ready — and the day something's actually wrong, it tells you to act and hands you the words to say.**

## 2. Positioning & strategy

- **Goal lane:** win the room (YC-interview prize) *by leaning on the founder's clinical edge* — a consumer-grade voice product whose advice is demonstrably correct where competitors' is hand-wavy.
- **Anti-"GPT wrapper" by construction:** a deterministic, clinically-grounded core (red-flag rules + real recovery protocols) wrapped in LLM edges (voice dialogue, extraction, summary generation). The LLM never makes a safety decision.
- **Subjective + objective fusion:** the safety engine corroborates what the patient *says* (voice) against what their *body shows* (vitals). This is the core differentiator — no self-report-only chatbot can match it.
- **Platform pitch, vertical proof:** the engine is procedure-agnostic ("all ortho"); we author **one hero procedure** cold and stub the rest to sell generality.

### Reimbursement / who pays (US)
The exact inputs map onto existing CPT reimbursement — a revenue story from day one, not a "figure it out later":
- **RPM (Remote Physiologic Monitoring):** 99453 (setup), 99454 (device supply, 16+ days data / 30), 99457 / 99458 (management time) — unlocked by the HR / BP / ECG / temperature stream.
- **RTM (Remote Therapeutic Monitoring):** 98975 (setup), 98977 (musculoskeletal device supply), 98980 / 98981 (management) — created specifically for MSK therapy-adherence monitoring; post-op ortho rehab is the textbook use case.
- Payer = hospital / orthopaedic practice (bills RPM+RTM); patient is the user. Consumer-grade UX, provider-billed.

### Hero procedure & persona
- **Hero:** hip arthroplasty — elective total hip replacement (THR) **and** hemiarthroplasty for neck-of-femur (NOF/hip) fracture.
- **Persona:** an ~82-year-old post-hip-fracture hemiarthroplasty patient. This makes **voice-first clinically necessary, not decorative** — the real user will never open an app but will answer a friendly call. Best possible answer to "why voice?"
- **Demo emotional peak:** DVT -> PE escalation — voice reports mild breathlessness, vitals show HR 122 + sinus tachycardia on 3-lead ECG, engine escalates to **911/ER** with objective corroboration. Life-threatening, universally legible, and impossible to fake.
- **Demo domain-depth beat:** hip-precaution coaching and **dislocation** detection (flexion past 90 deg / adduction past midline -> sudden pain + shortened, rotated leg, can't weight-bear) — hip-specific, unfakeable.
- **Demo specificity beat:** day-2 temp 37.8 C with otherwise-normal vitals stays *green* (normal post-op envelope) — shows the engine doesn't cry wolf.

## 3. Architecture — LLM at the edges, deterministic clinical core

  Voice check-in (ElevenLabs + Claude)      Vitals stream (HR, BP, 3-lead ECG, Temp)
        | structured symptoms (subjective)         | structured vitals (objective)
        v                                          v
        +---------------->  Red-flag engine  <------+     <- DETERMINISTIC CORE (moat, unit-tested)
                                 | reads Recovery graph (normal envelope, phase, precautions)
                                 | decision: green / amber (urgent, same-day) / red (ER/911)
                                 |- green: serve today's week-gated rehab
                                 |- amber: call surgeon's office / nurse line + SBAR
                                 |- red:   escalation card + SBAR handoff (Claude generates)  <- LLM edge
                                 v
        Supabase (patient, vitals, check-ins, escalations)   Companion app (Next.js/Vercel)

### Components

1. **Recovery graph** — *deterministic core, hand-authored JSON.* Per procedure: recovery phases, the *normal* symptom + vitals envelope per day-window (e.g. low-grade temp / mild tachycardia acceptable early), week-gated rehab progression, weight-bearing status, hip precautions, VTE-prophylaxis / analgesia taper. Authored from clinical knowledge -> synthetic by construction (rule-compliant, no dataset).
2. **Red-flag engine** — *deterministic, unit-tested.* Fuses **objective vitals + subjective symptoms** -> severity -> action, read against the recovery graph's phase envelope. Owns **all** escalation decisions. Fail-safe: escalate on ambiguity. Graded output: green / amber (urgent same-day) / red (ER/911). Hip ruleset covers DVT/PE, dislocation, deep infection/sepsis, haemorrhage/shock, post-op arrhythmia, uncontrolled pain, early fat-embolism.
3. **Vitals ingestion** — *structured input layer (NEW).* Accepts HR, BP, 3-lead ECG (rhythm + basic morphology flags e.g. sinus tachycardia / new AF / right-heart-strain pattern), and temperature. Normalised to a `VitalsReading` schema with timestamp + source + quality flag. **Demo uses a simulated/replayed device feed**; real Bluetooth device pairing (BP cuff, pulse-ox, wearable 3-lead ECG patch, thermometer) is a roadmap line.
4. **Voice check-in agent** — *LLM edge (ElevenLabs voice + Claude).* Delivers an empathetic daily check-in; jobs are **empathetic delivery** and **extraction** (freeform speech -> structured symptom fields). Confirms critical symptoms back before acting ("Just to check — you're a little short of breath?"). Never makes the safety call.
5. **Companion app** — *Next.js + Vercel.* Recovery timeline (where you are), latest vitals tiles, today's rehab exercises, check-in history, and the **escalation card** when a flag fires.
6. **Clinician handoff** — *LLM edge (Claude).* On amber/red, generate an SBAR-style summary (**including the triggering vitals**) the patient can show/send. Folds "what a clinician needs" into the consumer flow and closes the loop.
7. **Supabase** — patient profile, procedure, surgery date, vitals readings, check-in logs, symptom history, escalation events. All synthetic.

## 4. Data flow

Onboard (procedure + surgery date) -> recovery graph instantiates a personalised timeline + normal envelope -> each day: vitals stream in **and** the agent "calls" -> Claude extracts structured symptoms -> **deterministic red-flag engine fuses vitals + symptoms against the phase envelope and decides** -> **green:** reassure + serve gated rehab · **amber:** urgent same-day + SBAR · **red:** ER/911 escalation card + SBAR handoff -> log to Supabase -> app reflects state.

## 5. Scope — 8 hours, ruthless YAGNI

**Build real (demo-critical):**
- 1 hero procedure (hip) fully authored: recovery graph + fused red-flag rules + rehab progression.
- `VitalsReading` schema + ingestion endpoint + a **simulated device feed** that replays realistic HR / BP / 3-lead-ECG-flag / temp series for green and red scenarios.
- Voice check-in with **one rehearsed green path + one red (DVT->PE, vitals-corroborated) path**.
- App: timeline + vitals tiles + today's rehab + escalation card + SBAR.
- Supabase persistence of vitals, check-ins, escalations.
- Red-flag engine with a vignette unit-test table (symptoms + vitals -> expected action).

**Fake / cut (roadmap, not build):**
- Real Bluetooth device pairing -> simulated/replayed vitals feed for the demo.
- Real PSTN outbound calling -> ElevenLabs' **in-browser conversational widget** (the "call" happens on screen; fully stage-controllable).
- Auth -> single demo patient, no login.
- Clinician portal -> generate the SBAR, don't deliver it.
- Breadth -> seed 1 procedure real; show 2 stubs in the picker to sell "platform."

## 6. Safety & error handling

- **Deterministic rules own every escalation decision.** The LLM cannot override toward reassurance. Ambiguous/uncertain extraction or missing vitals -> escalate or fall back to symptom-only rules (fail-safe).
- **Objective vitals reduce reliance on self-report** — critical for an 82-year-old who under-reports; the engine can escalate on vitals even if the patient says "I'm fine."
- Vitals quality flags: implausible / stale readings are ignored, not trusted (never escalate OR reassure on a garbage reading).
- Voice mis-hearing mitigated by **read-back confirmation** of any critical symptom.
- Explicit "not medical advice / educational prototype" disclaimer throughout (rule compliance).
- The winning demo beat is the **red path executing correctly with objective backing** — voice + vitals agree, engine escalates to 911. Judges remember the agent that correctly said "call 911 now."

## 7. Testing

- **Red-flag engine unit tests:** a vignette table (symptom set + vitals + recovery phase -> expected action) covering green / amber / red for the hip ruleset, including the specificity cases (normal early low-grade temp stays green). Doubles as a demo asset ("our safety engine passes N clinical cases").
- **Scripted demo paths:** one green and one red end-to-end run, deterministic and rehearsed, driven by the simulated vitals feed.

## 8. Sponsor alignment (bonus tracks, one build)

- **ElevenLabs** — voice check-in agent (hero modality).
- **Anthropic / Claude** — symptom extraction, empathetic dialogue, SBAR generation.
- **Supabase** — persistence (vitals + check-ins + escalations).
- **Vercel** — deploy.

## 9. Stack

Next.js (App Router) + Tailwind on Vercel · Supabase (Postgres) · Claude (Anthropic API) for extraction/dialogue/SBAR · ElevenLabs conversational voice widget · deterministic core in TypeScript (recovery-graph JSON + fused red-flag engine + unit tests) · `VitalsReading` ingestion endpoint + simulated device-feed generator.

## 10. Open questions for build time

1. Which single red path to rehearse as the peak — DVT->PE (life-threatening, universal, vitals-corroborated) vs dislocation (hip-specific depth). *Recommendation: DVT->PE as the peak, dislocation precautions as everyday-depth colour.*
2. Elective THR vs hip-fracture hemiarthroplasty as the on-stage persona (both authored; pick one to narrate). *Recommendation: hemi — strongest "why voice" story.*
3. 3-lead ECG fidelity for the demo: rhythm-flag level (sinus tach / new AF / right-heart-strain) is enough; full waveform rendering is optional polish. *Recommendation: flags + a simple waveform strip if time allows.*
4. Team composition (solo vs form on-site) -> affects how much of the "fake/cut" list can become real.
5. Final product name (working: Mend; alts: Knit, Union, Callus).
