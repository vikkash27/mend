# NEWS2 and AAOS as sources for Mend's vital-sign thresholds

Adjudicated 2026-07-25. Resolves the placeholder string that appeared in
`lib/clinical/recovery-graph.ts` and `lib/clinical/rule-catalog.ts`:

> "Plausible-but-uncited: general post-op physiology. Needs NEWS2/AAOS citation
> before clinical use."

**Outcome: partially resolved, and one half of the placeholder was a
mis-attribution.** NEWS2 underwrites four of the seven numbers. AAOS underwrites
none of them — it is a VTE *prophylaxis* guideline and contains no vital-sign
cut-points. The remaining three numbers stay explicitly uncited rather than being
laundered through a citation that does not cover them.

## Sources

| | |
|---|---|
| **NEWS2** | Royal College of Physicians. *National Early Warning Score (NEWS) 2: standardising the assessment of acute-illness severity in the NHS. Updated report of a working party.* London: RCP, 2017. |
| | Smith GB, Redfern OC, Pimentel MA, Gerry S, Collins GS, Malycha J, Prytherch D, Schmidt PE, Watkinson PJ. The National Early Warning Score 2 (NEWS2). *Clin Med (Lond)* 2019;19(3):260. **PMID 31092526**. PMCID PMC6542226. |
| | Royal College of Physicians. The National Early Warning Score: from concept to NHS implementation. *Clin Med (Lond)* 2022;22(6):499–505. **PMID 36427887**. |
| **AAOS VTE CPG** | Jacobs JJ, Mont MA, Bozic KJ, et al. Preventing venous thromboembolic disease in patients undergoing elective hip and knee arthroplasty. *J Am Acad Orthop Surg* 2011;19(12):768–76. **PMID 22134209**. Guideline summary: **PMID 22134210**. |
| | Lieberman JR, Pensak MJ. Prevention of venous thromboembolic disease after total hip and knee arthroplasty. *J Bone Joint Surg Am* 2013;95(19):1801–11. **PMID 24088973**. |

## The NEWS2 scoring table (the part Mend can observe)

Respiratory rate and level of consciousness are omitted below: a phone call does
not yield a countable respiratory rate, and "alert vs. CVPU" is not something the
current pipeline can assert. That omission is itself a finding — see *Limits*.

| Parameter | 3 | 2 | 1 | 0 | 1 | 2 | 3 |
|---|---|---|---|---|---|---|---|
| SpO₂ (scale 1) | ≤91 | 92–93 | 94–95 | ≥96 | | | |
| Systolic BP | ≤90 | 91–100 | 101–110 | 111–219 | | | ≥220 |
| Pulse | ≤40 | | 41–50 | 51–90 | 91–110 | 111–130 | ≥131 |
| Temperature | ≤35.0 | | 35.1–36.0 | 36.1–38.0 | 38.1–39.0 | ≥39.1 | |

Escalation: aggregate ≥5, **or any single parameter scoring 3**, triggers an
urgent clinical review.

## Threshold-by-threshold adjudication

| Engine threshold | Where | NEWS2 position | Verdict |
|---|---|---|---|
| SpO₂ < 90 → red | `red-flag-engine.ts:208` | ≤91 scores **3** — a single-parameter urgent trigger on its own | **Underwritten.** Mend is one point more conservative than NEWS2's own red line. |
| Systolic BP < 90 → red | `red-flag-engine.ts:218` | ≤90 scores **3** | **Underwritten — exact match** with the NEWS2 boundary. |
| `spo2Min: 94`, all phases | `recovery-graph.ts` | 94–95 scores 1; ≤93 scores 2 | **Underwritten.** Falling below 94 means a NEWS2 score of ≥2 on that parameter. |
| `tempCMax: 38.0`, early phase | `recovery-graph.ts` | 36.1–38.0 scores 0; 38.1 scores 1 | **Underwritten — exact match** with the top of the zero-score band. |
| `tempCMax: 37.5`, days 14+ | `recovery-graph.ts` | NEWS2 scores 0 all the way to 38.0 | **Not NEWS2.** Deliberately tighter, on post-op-specific grounds (below). Remains uncited. |
| `hrMax: 100`, early phase | `recovery-graph.ts` | 91–110 scores 1; boundaries are 90 and 110 | **Not a NEWS2 boundary.** Sits mid-band. Remains uncited. |
| `hrMax: 95`, days 14+ | `recovery-graph.ts` | as above | **Not a NEWS2 boundary.** Remains uncited. |

### Why the tightening after day 14 is not a NEWS2 number

NEWS2 is a general acute-illness score with no notion of a post-operative day. The
tighter late-phase envelope encodes something NEWS2 cannot: a temperature of 37.8
on day 2 is expected, and the same temperature on day 21 is not. That is the same
logic the fever-envelope adjudication rests on — see
`docs/adjudicated/postop-fever-envelope.md`, where late fever carries an odds
ratio of 23.3 for infection after POD 3 (PMID 20452174). The number is
post-op-specific and defensible; it is still not *cited*, and it is now labelled
that way rather than sheltering under NEWS2.

## AAOS: a mis-attribution, corrected

The AAOS clinical practice guideline (PMID 22134209) covers **VTE prophylaxis
after elective hip and knee arthroplasty**. It recommends against routine
post-discharge duplex screening, and — per the JBJS summary (PMID 24088973) —
"the AAOS guideline panel was unable to make a recommendation with respect to the
selection of a specific prophylaxis regimen or duration of prophylaxis."

It contains **no vital-sign thresholds**. Naming it as a pending source for
`hrMax` or `tempCMax` was a category error in the original placeholder.

What AAOS does underwrite, and where it is correctly cited:

- The presence of enoxaparin in the demo regimen (`lib/clinical/medications.ts`).
- The clinical relevance of the PE/DVT rules in `red-flag-engine.ts` — VTE is the
  complication being watched for, on this guideline's authority.
- The decision *not* to build a discharge screening-ultrasound prompt.

It does not underwrite the numbers those rules compare against. Those come from
NEWS2 where the table covers them, and from nowhere published where it does not.

## Limits — why NEWS2 cannot simply be adopted wholesale

Recorded here because "adopt NEWS2" is the obvious next suggestion and it is not
as clean as it sounds.

1. **Mend cannot compute a NEWS2 aggregate.** Two of the seven parameters —
   respiratory rate and consciousness — are unavailable over a phone call.
   A partial aggregate is not a NEWS2 score, and reporting one as though it were
   would be the PROM pro-rating mistake in a different costume.
2. **NEWS2 was derived and validated on inpatients** with a full nursing
   observation set, taken by a person in the room. The threshold-transfer problem
   applies: a cut-point validated on an examined patient may behave differently on
   a self-reported phone reading.
3. **NEWS2's own designers caution against single-parameter use.** The score's
   discrimination comes from the aggregate. Borrowing individual boundaries — which
   is exactly what Mend does — is a weaker claim than "Mend uses NEWS2", and this
   document should be read as the former.

Using NEWS2 boundaries as *individual* thresholds is defensible and is what the
code now says it does. Claiming Mend implements NEWS2 would not be.

## What changed in the code

- `lib/clinical/recovery-graph.ts` — the single shared `THRESHOLD_SOURCE` constant
  was replaced with per-parameter provenance, because the numbers it covered do not
  share a provenance.
- `lib/clinical/rule-catalog.ts` — `LITERAL_SOURCE` now cites NEWS2 for the SpO₂
  and systolic-BP lines it actually governs.
- `docs/CLINICAL_SOURCES.md` — the NEWS2 and AAOS rows moved from "to source" to
  sourced, with the AAOS scope corrected.
