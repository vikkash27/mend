# Adjudicated: Oxford Hip Score

**Where it lives:** `lib/clinical/ohs.ts`

**Status: ✅ SOURCED.** Unlike every other instrument in this codebase, the OHS
arrives with its own literature. Retrieved and read 2026-07-25 via
`npm run evidence` / `npm run abstracts`.

---

## The instrument

**Dawson J, Fitzpatrick R, Carr A, Murray D.** Questionnaire on the perceptions
of patients about total hip replacement. *J Bone Joint Surg Br.* 1996;78(2):185–90.
[PMID 8666621](https://pubmed.ncbi.nlm.nih.gov/8666621/)

The original 12-item instrument. Developed on 220 patients assessed
pre-operatively and at six months, validated against SF-36, AIMS and the
Charnley hip score, with satisfactory test–retest reproducibility and high
internal consistency.

**Note the original scoring is not the one this code uses.** As published, each
item scored 1–5 for a total of 12–60 where *lower* is better. The modern 0–48
higher-is-better form came later — see below. Both remain in circulation, they
produce plausible-looking two-digit numbers in overlapping ranges, and mixing
them silently inverts the result. `ohs.test.ts` asserts scale direction for
exactly this reason.

## The 0–48 rescoring — what this code implements

**Murray DW, Fitzpatrick R, Rogers K, Pandit H, Beard DJ, Carr AJ, Dawson J.**
The use of the Oxford hip and knee scores. *J Bone Joint Surg Br.*
2007;89(8):1010–4. [PMID 17785736](https://pubmed.ncbi.nlm.nih.gov/17785736/) ·
doi:10.1302/0301-620X.89B8.19424

Written explicitly to "clarify areas of confusion" after the scores had been
modified for many purposes. This is the authority for the 0–48 direction used
in `scoreOhs()`.

## Minimal important change — now sourced

**Beard DJ, Harris K, Dawson J, Doll H, et al.** Meaningful changes for the
Oxford hip and knee scores after joint replacement surgery. *J Clin Epidemiol.*
2015;68(1):73–9. [PMID 25441700](https://pubmed.ncbi.nlm.nih.gov/25441700/) ·
doi:10.1016/j.jclinepi.2014.08.009

Secondary analysis of the NHS PROMs dataset — **82,415 hip replacement
patients**. For the OHS:

| Quantity | Value | Use |
|---|---|---|
| Minimal important change (MIC), group level | **~11 points** | cohort studies |
| MIC for an individual patient (ROC-derived) | **8 points** | one patient over time |

`ohsChange()` deliberately reports direction and magnitude and asserts nothing
about importance. That restraint was correct while the number was uncited; it
is now sourced, so an 8-point individual threshold **could** be surfaced. It
still should not be applied blindly here — the derivation is a pre- to
post-operative arthroplasty population, whereas Mend measures repeated
post-discharge scores in the same patient, which is a different comparison.

## The blocker that outranks all of this

**The item wording in `ohs.ts` is placeholder text, not the licensed
instrument.** The OHS is copyright Oxford University Innovation: free for
non-commercial and academic use, licensed for commercial use.

This is a clinical problem before it is a legal one. A PROM is validated as an
exact set of words, so paraphrased items constitute a different questionnaire
that happens to have twelve questions. Scores collected under placeholder
wording are internally consistent and are **not** comparable to the norms,
registry data or the MIC values above. Every result carries
`usesPlaceholderWording`, and the clinician card renders that caveat inside the
score rather than beneath it.

**Next step:** obtain the licence and drop in the verbatim items. Until then,
totals are within-patient trend only.

## Reproduce

```bash
npm run evidence      # includes the ohs-instrument query
npm run abstracts -- --rule ohs-instrument
```
