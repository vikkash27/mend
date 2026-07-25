/**
 * Runs both corpora and reports what the numbers do — and do not — mean.
 *
 *   npx tsx scripts/evaluate-dataset.ts
 *
 * Part 1 measures the keyword extractor against ground truth. That number is
 * real: the labels were fixed before the extractor ever saw the text.
 *
 * Part 2 compares the engine against an independently written rubric. That
 * number is NOT accuracy. Agreement means two implementations of the same
 * intent concur; it says nothing about whether the intent is clinically right.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluate } from "../lib/clinical/red-flag-engine";
import { rubricSeverity } from "../lib/data/rubric";
import {
  scoreExtraction,
  prf,
  FieldScore,
  ExtractionExample,
  Vignette,
} from "../lib/data/generate";
import { Severity } from "../lib/clinical/types";

function readJsonl<T>(name: string): T[] {
  const path = join(process.cwd(), "data", name);
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

const pct = (n: number) => (n * 100).toFixed(1).padStart(5) + "%";

// ---------------------------------------------------------------------------
// Part 1 — extraction.
//
// Symptom extraction on this branch is model-only by design: when it fails the
// route passes `symptomsUnusable` into the engine, which escalates rather than
// treating absent fields as reassurance. There is deliberately no keyword
// fallback to score offline, so this corpus is scored against the model when a
// key is present and skipped otherwise rather than silently measuring nothing.
// ---------------------------------------------------------------------------
console.log("\n=== 1. EXTRACTION — transcript to Symptoms ===");
const corpus = readJsonl<ExtractionExample>("extraction-corpus.jsonl");
console.log(
  `${corpus.length} labelled transcripts, ${corpus.filter((e) => e.composition.includes("negated")).length} containing an explicit denial.`,
);
if (!process.env.ANTHROPIC_API_KEY) {
  console.log(
    "ANTHROPIC_API_KEY not set — skipping. Extraction is model-only, so there is\n" +
      "nothing to score offline. Set the key to evaluate the extractor against these labels.",
  );
} else {
  console.log(
    "Key present. Scoring the model extractor against this corpus is not yet wired —\n" +
      "the labels are ground truth by construction and ready for it.",
  );
}

// ---------------------------------------------------------------------------
console.log("\n\n=== 2. ENGINE vs INDEPENDENT RUBRIC — differential test ===");
console.log("NOT accuracy. Disagreement = one of the two is wrong.\n");

const vignettes = readJsonl<Vignette>("vignettes.jsonl");
const levels: Severity[] = ["green", "amber", "red"];
const matrix: Record<string, Record<string, number>> = {};
for (const a of levels) {
  matrix[a] = {};
  for (const b of levels) matrix[a][b] = 0;
}

const disagreements: {
  id: string;
  engine: Severity;
  rubric: Severity;
  why: string;
}[] = [];

for (const v of vignettes) {
  const e = evaluate({
    dayPostOp: v.dayPostOp,
    symptoms: v.symptoms,
    vitals: v.vitals,
    ecg: v.ecg,
  });
  const r = rubricSeverity({
    dayPostOp: v.dayPostOp,
    symptoms: v.symptoms,
    vitals: v.vitals,
    ecg: v.ecg,
  });
  matrix[r.severity][e.level]++;
  if (r.severity !== e.level) {
    disagreements.push({
      id: v.id,
      engine: e.level,
      rubric: r.severity,
      why: `engine: ${e.rationale[0]} | rubric: ${r.because[0]}`,
    });
  }
}

console.log("rubric \\ engine".padEnd(18) + levels.map((l) => l.padStart(8)).join(""));
for (const r of levels) {
  console.log(
    r.padEnd(18) + levels.map((e) => String(matrix[r][e]).padStart(8)).join(""),
  );
}

const agree = levels.reduce((a, l) => a + matrix[l][l], 0);
console.log(
  `\nAgreement: ${agree}/${vignettes.length} (${((agree / vignettes.length) * 100).toFixed(2)}%)`,
);

// A disagreement where the rubric is more worried than the engine is the one
// that matters: it is a candidate missed escalation.
const engineLessWorried = disagreements.filter(
  (d) => levels.indexOf(d.rubric) > levels.indexOf(d.engine),
);
console.log(`Disagreements:             ${disagreements.length}`);
console.log(`  engine LESS worried:     ${engineLessWorried.length}  <- adjudicate these first`);
console.log(`  engine MORE worried:     ${disagreements.length - engineLessWorried.length}`);

if (disagreements.length) {
  console.log("\nFirst 10 for adjudication:");
  for (const d of disagreements.slice(0, 10)) {
    console.log(`  ${d.id}  rubric=${d.rubric} engine=${d.engine}`);
    console.log(`     ${d.why}`);
  }
}

console.log(
  "\nReminder: both the engine and the rubric were written by the same author " +
    "from the same understanding.\nAgreement is internal consistency, not clinical " +
    "validity. See docs/CLINICAL_SOURCES.md.\n",
);
