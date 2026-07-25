/**
 * Oxford Hip Score — the patient-reported outcome measure for hip arthroplasty.
 *
 * ⚠️ LICENSING. The Oxford Hip Score is copyright Oxford University Innovation.
 * It is free for non-commercial and academic use; commercial use requires a
 * licence. The item wording below is DESCRIPTIVE PLACEHOLDER TEXT, not the
 * licensed instrument.
 *
 * ⚠️ AND THIS MATTERS CLINICALLY, NOT ONLY LEGALLY. A PROM is validated as an
 * exact set of words. Paraphrased items are a different questionnaire that
 * happens to have twelve questions: the scores are internally consistent but
 * are NOT comparable to published norms, registry data, or an MCID. Until the
 * licensed wording is dropped in, treat totals here as within-patient trend
 * only — never as "her Oxford Hip Score is 34".
 *
 * The structure, scoring and bands are correct and are what the licensed text
 * plugs into: twelve items, each 0–4, summed to 0–48, higher being better.
 *
 * SOURCES — see docs/adjudicated/oxford-hip-score.md.
 *   Instrument   Dawson 1996, J Bone Joint Surg Br 78(2):185–90  (PMID 8666621)
 *                Original scoring was 1–5 per item, 12–60, LOWER better.
 *   0–48 form    Murray 2007, J Bone Joint Surg Br 89(8):1010–4  (PMID 17785736)
 *                Written to settle exactly this confusion. It is what is used here.
 *   Meaningful   Beard 2015, J Clin Epidemiol 68(1):73–9        (PMID 25441700)
 *   change       NHS PROMs, 82,415 hip patients: MIC ~11 points at group level,
 *                8 points for an individual by ROC.
 *
 * Both scoring forms remain in circulation and produce plausible two-digit
 * numbers in overlapping ranges, so mixing them inverts the result silently.
 * ohs.test.ts asserts the direction for that reason.
 */

export interface OhsItem {
  id: string;
  /** PLACEHOLDER. Replace with licensed wording before any real use. */
  prompt: string;
  /** Five options, best first. Index maps directly to score 4 → 0. */
  options: [string, string, string, string, string];
}

/** The recall period the instrument asks about. */
export const OHS_RECALL_PERIOD = "the past 4 weeks";

export const OHS_ITEMS: OhsItem[] = [
  {
    id: "pain-usual",
    prompt: "How would you describe the pain you usually have in your hip?",
    options: ["None", "Very mild", "Mild", "Moderate", "Severe"],
  },
  {
    id: "washing",
    prompt: "Have you had any trouble washing and drying yourself all over?",
    options: ["No trouble at all", "Very little trouble", "Moderate trouble", "Extreme difficulty", "Impossible to do"],
  },
  {
    id: "transport",
    prompt: "Have you had any trouble getting in and out of a car, or using public transport?",
    options: ["No trouble at all", "Very little trouble", "Moderate trouble", "Extreme difficulty", "Impossible to do"],
  },
  {
    id: "socks",
    prompt: "Have you been able to put on a pair of socks or stockings?",
    options: ["Yes, easily", "With little difficulty", "With moderate difficulty", "With extreme difficulty", "No, impossible"],
  },
  {
    id: "shopping",
    prompt: "Could you do your household shopping on your own?",
    options: ["Yes, easily", "With little difficulty", "With moderate difficulty", "With extreme difficulty", "No, impossible"],
  },
  {
    id: "walking",
    prompt: "For how long have you been able to walk before the pain becomes severe?",
    options: ["No pain for 30 minutes or more", "16 to 30 minutes", "5 to 15 minutes", "Around the house only", "Not at all — pain is severe on walking"],
  },
  {
    id: "stairs",
    prompt: "Have you been able to climb a flight of stairs?",
    options: ["Yes, easily", "With little difficulty", "With moderate difficulty", "With extreme difficulty", "No, impossible"],
  },
  {
    id: "standing-from-chair",
    prompt: "After a meal sitting at a table, how painful has it been to stand up?",
    options: ["Not at all painful", "Slightly painful", "Moderately painful", "Very painful", "Unbearable"],
  },
  {
    id: "limping",
    prompt: "Have you been limping when walking?",
    options: ["Rarely or never", "Sometimes, or just at first", "Often, not just at first", "Most of the time", "All of the time"],
  },
  {
    id: "sudden-pain",
    prompt: "Have you had any sudden, severe pain — shooting, stabbing or spasms — from the affected hip?",
    options: ["No days", "Only 1 or 2 days", "Some days", "Most days", "Every day"],
  },
  {
    id: "interference",
    prompt: "How much has pain from your hip interfered with your usual work, including housework?",
    options: ["Not at all", "A little bit", "Moderately", "Greatly", "Totally"],
  },
  {
    id: "night-pain",
    prompt: "Have you been troubled by pain from your hip in bed at night?",
    options: ["No nights", "Only 1 or 2 nights", "Some nights", "Most nights", "Every night"],
  },
];

/** Answers keyed by item id. Value is the chosen option index, 0 (best) to 4 (worst). */
export type OhsAnswers = Record<string, number>;

export type OhsBand =
  | "satisfactory"
  | "mild-to-moderate"
  | "moderate-to-severe"
  | "severe";

export interface OhsResult {
  /** 0–48, higher is better. Undefined until every item is answered. */
  total?: number;
  band?: OhsBand;
  bandLabel?: string;
  answered: number;
  totalItems: number;
  complete: boolean;
  /** Items still to answer, in order. */
  missing: string[];
  /**
   * True while the instrument carries placeholder wording. Any consumer
   * displaying a total must show this caveat alongside it.
   */
  usesPlaceholderWording: boolean;
}

/**
 * Published interpretation bands for the 0–48 scoring.
 * Sourced from the instrument's own documentation rather than derived here —
 * see docs/CLINICAL_SOURCES.md, which tracks this alongside every other
 * threshold in the codebase.
 */
const BANDS: { max: number; band: OhsBand; label: string }[] = [
  { max: 19, band: "severe", label: "Severe hip arthritis — surgical assessment usually indicated" },
  { max: 29, band: "moderate-to-severe", label: "Moderate to severe" },
  { max: 39, band: "mild-to-moderate", label: "Mild to moderate" },
  { max: 48, band: "satisfactory", label: "Satisfactory joint function" },
];

export function scoreOhs(answers: OhsAnswers): OhsResult {
  const missing = OHS_ITEMS.filter((i) => {
    const v = answers[i.id];
    return !Number.isInteger(v) || v < 0 || v > 4;
  }).map((i) => i.id);

  const answered = OHS_ITEMS.length - missing.length;

  if (missing.length > 0) {
    // No part-scores, no pro-rating. A partially completed PROM has no defined
    // total, and inventing one produces a number that looks comparable and is not.
    return {
      answered,
      totalItems: OHS_ITEMS.length,
      complete: false,
      missing,
      usesPlaceholderWording: true,
    };
  }

  // Option index 0 is the best answer and scores 4; index 4 is worst and scores 0.
  const total = OHS_ITEMS.reduce((sum, i) => sum + (4 - answers[i.id]), 0);
  const band = BANDS.find((b) => total <= b.max)!;

  return {
    total,
    band: band.band,
    bandLabel: band.label,
    answered,
    totalItems: OHS_ITEMS.length,
    complete: true,
    missing: [],
    usesPlaceholderWording: true,
  };
}

/**
 * Change between two completed scores.
 *
 * Deliberately reports the raw difference and stops there. The minimal
 * clinically important difference for the OHS is a published, contested number
 * that varies by population and by how it was derived; asserting one here would
 * be exactly the kind of uncited threshold this codebase logs rather than
 * invents. Direction and magnitude are shown; whether it *matters* is the
 * clinician's call.
 */
export function ohsChange(
  earlier: OhsResult,
  later: OhsResult,
): { delta: number; direction: "improved" | "worsened" | "unchanged" } | undefined {
  if (!earlier.complete || !later.complete) return undefined;
  const delta = later.total! - earlier.total!;
  return {
    delta,
    direction: delta > 0 ? "improved" : delta < 0 ? "worsened" : "unchanged",
  };
}
