import { getPhase } from "./recovery-graph";
import type {
  Decision,
  EcgDetermination,
  EcgReading,
  Phase,
  Symptoms,
  VitalsReading,
} from "./types";
import { usableVitals } from "./vitals";

export interface EvaluateInput {
  dayPostOp: number;
  symptoms: Symptoms;
  vitals: VitalsReading;
  ecg?: EcgReading;
  /**
   * True when symptom extraction did not run or failed (no client, no
   * tool_use, transport error). Parallel to unusable vitals: an empty
   * `symptoms` object is then "unknown", not "patient reported nothing",
   * and must not yield green. Omit or false when symptoms were obtained
   * successfully (including a genuine empty report).
   */
  symptomsUnusable?: boolean;
}

/**
 * Deterministic triage context derived once from the raw inputs. Every rule
 * below reads only from this context — never from `input.vitals` directly —
 * so that "unusable" readings can never leak a value into a threshold check.
 */
interface Context {
  dayPostOp: number;
  symptoms: Symptoms;
  vitals: VitalsReading; // already passed through usableVitals()
  ecgDetermination: EcgDetermination | undefined; // undefined if absent or "unclassified"
  phase: Phase;
  /**
   * The resolved numeric tachycardia threshold (phase.normalEnvelope.hrMax +
   * 10), computed once here. Both the `tachycardic` boolean below AND every
   * rationale string that names this threshold read this same field — never
   * recomputed inline — so the audit trail can never cite a threshold other
   * than the one that actually governed the decision.
   */
  tachycardiaThresholdBpm: number;
  /** hr > tachycardiaThresholdBpm. */
  tachycardic: boolean;
  /**
   * The resolved numeric PE low-SpO2 floor (phase.normalEnvelope.spo2Min -
   * 2), computed once here for the same reason as tachycardiaThresholdBpm.
   */
  peLowSpo2ThresholdPct: number;
  /** tempC > phase.normalEnvelope.tempCMax. */
  fevered: boolean;
  /** quality !== "ok", OR every physiologic field is absent after stripping. */
  vitalsUnusable: boolean;
  /**
   * Symptom extraction did not run or failed — empty `symptoms` must not be
   * read as an unremarkable check-in.
   */
  symptomsUnusable: boolean;
}

interface Rule {
  id: string;
  condition: string;
  severity: "red" | "amber";
  action: string;
  call: Decision["call"];
  test: (ctx: Context) => boolean;
  rationale: (ctx: Context) => string;
}

function buildContext(input: EvaluateInput): Context {
  const vitals = usableVitals(input.vitals);
  const phase = getPhase(input.dayPostOp);

  const ecgDetermination: EcgDetermination | undefined =
    input.ecg === undefined || input.ecg.determination === "unclassified"
      ? undefined
      : input.ecg.determination;

  const tachycardiaThresholdBpm = phase.normalEnvelope.hrMax + 10;
  const tachycardic =
    vitals.hr !== undefined && vitals.hr > tachycardiaThresholdBpm;

  const peLowSpo2ThresholdPct = phase.normalEnvelope.spo2Min - 2;

  const fevered =
    vitals.tempC !== undefined && vitals.tempC > phase.normalEnvelope.tempCMax;

  const noPhysiologicData =
    vitals.hr === undefined &&
    vitals.sbp === undefined &&
    vitals.dbp === undefined &&
    vitals.tempC === undefined &&
    vitals.spo2 === undefined &&
    vitals.respRate === undefined;
  const vitalsUnusable = vitals.quality !== "ok" || noPhysiologicData;

  return {
    dayPostOp: input.dayPostOp,
    symptoms: input.symptoms,
    vitals,
    ecgDetermination,
    phase,
    tachycardiaThresholdBpm,
    tachycardic,
    peLowSpo2ThresholdPct,
    fevered,
    vitalsUnusable,
    symptomsUnusable: input.symptomsUnusable === true,
  };
}

const breathlessOrChestPain = (ctx: Context): boolean =>
  ctx.symptoms.breathless === true || ctx.symptoms.chestPain === true;

/**
 * ============================================================================
 * RULE PRECEDENCE (read top to bottom — first match at the highest severity
 * wins). All RED rules are evaluated before any AMBER rule; within each
 * severity, rules are evaluated in array order and the first hit returns
 * immediately without evaluating anything below it.
 *
 * RED  (in order): pulmonary embolism -> hypoxia -> shock/bleeding ->
 *                  hip dislocation -> sepsis
 * AMBER (in order): DVT -> wound infection -> new AF -> uncontrolled pain ->
 *                  new confusion -> failed symptom extraction ->
 *                  unusable vitals with no other explanation
 * GREEN: only reached when no RED or AMBER rule matched. Always has an
 *        empty `firedRules` array — a green verdict is never "a rule fired
 *        favourably", it is the absence of any fired rule.
 * ============================================================================
 */

const RED_RULES: Rule[] = [
  {
    id: "pe.breathless_with_tachycardia",
    condition: "Suspected pulmonary embolism",
    severity: "red",
    action: "Call 911 now. This combination can indicate a pulmonary embolism.",
    call: "911",
    test: (ctx) => breathlessOrChestPain(ctx) && ctx.tachycardic,
    rationale: (ctx) =>
      `Breathlessness${ctx.symptoms.chestPain ? "/chest pain" : ""} reported with heart rate ${ctx.vitals.hr}, more than 10 bpm above the day-${ctx.dayPostOp} expected maximum of ${ctx.phase.normalEnvelope.hrMax}.`,
  },
  {
    id: "pe.breathless_with_low_spo2",
    condition: "Suspected pulmonary embolism",
    severity: "red",
    action: "Call 911 now. This combination can indicate a pulmonary embolism.",
    call: "911",
    test: (ctx) =>
      breathlessOrChestPain(ctx) &&
      ctx.vitals.spo2 !== undefined &&
      ctx.vitals.spo2 < ctx.peLowSpo2ThresholdPct,
    rationale: (ctx) =>
      `Breathlessness${ctx.symptoms.chestPain ? "/chest pain" : ""} reported with SpO2 ${ctx.vitals.spo2}%, below the day-${ctx.dayPostOp} safe floor of ${ctx.peLowSpo2ThresholdPct}%.`,
  },
  {
    id: "pe.breathless_with_ecg_tachycardia",
    condition: "Suspected pulmonary embolism",
    severity: "red",
    action: "Call 911 now. This combination can indicate a pulmonary embolism.",
    call: "911",
    test: (ctx) =>
      breathlessOrChestPain(ctx) && ctx.ecgDetermination === "tachycardia",
    rationale: (ctx) =>
      `Breathlessness${ctx.symptoms.chestPain ? "/chest pain" : ""} reported with a KardiaMobile ECG determination of tachycardia${ctx.vitals.hr !== undefined ? ` (heart rate ${ctx.vitals.hr})` : ""}.`,
  },
  {
    id: "pe.unusable_vitals_failsafe",
    condition: "Suspected pulmonary embolism",
    severity: "red",
    action: "Call 911 now. This combination can indicate a pulmonary embolism.",
    call: "911",
    test: (ctx) => breathlessOrChestPain(ctx) && ctx.vitalsUnusable,
    rationale: (ctx) =>
      `Breathlessness${ctx.symptoms.chestPain ? "/chest pain" : ""} reported, but vitals are unusable (quality "${ctx.vitals.quality}") — escalating rather than trusting an unreadable vitals sign.`,
  },
  {
    id: "hypoxia.spo2_critical",
    condition: "Hypoxia",
    severity: "red",
    action: "Call 911 now. This oxygen level requires immediate assessment.",
    call: "911",
    test: (ctx) => ctx.vitals.spo2 !== undefined && ctx.vitals.spo2 < 90,
    rationale: (ctx) =>
      `SpO2 ${ctx.vitals.spo2}% is below 90%, a critical hypoxia threshold regardless of reported symptoms.`,
  },
  {
    id: "shock.hypotension",
    condition: "Suspected shock / bleeding",
    severity: "red",
    action: "Call 911 now. This blood pressure requires immediate assessment.",
    call: "911",
    test: (ctx) => ctx.vitals.sbp !== undefined && ctx.vitals.sbp < 90,
    rationale: (ctx) =>
      `Systolic BP ${ctx.vitals.sbp} mmHg is below 90 mmHg${ctx.vitals.hr !== undefined ? `, with heart rate ${ctx.vitals.hr}` : ""}, consistent with shock or occult bleeding.`,
  },
  {
    id: "dislocation.classic_triad",
    condition: "Suspected hip dislocation",
    severity: "red",
    action: "Call 911 now. Do not attempt to bear weight on the operated leg.",
    call: "911",
    test: (ctx) =>
      [
        ctx.symptoms.suddenSevereHipPain,
        ctx.symptoms.legShortenedOrRotated,
        ctx.symptoms.unableToWeightBear,
      ].filter((s) => s === true).length >= 2,
    rationale: (ctx) => {
      const signs = [
        ctx.symptoms.suddenSevereHipPain ? "sudden severe hip pain" : null,
        ctx.symptoms.legShortenedOrRotated ? "leg shortened/rotated" : null,
        ctx.symptoms.unableToWeightBear ? "unable to weight-bear" : null,
      ].filter((s): s is string => s !== null);
      return `Classic hip dislocation signs reported: ${signs.join(", ")}.`;
    },
  },
  {
    id: "sepsis.fever_with_tachycardia",
    condition: "Possible sepsis",
    severity: "red",
    action: "Call 911 now. Fever with a fast heart rate after surgery can indicate sepsis.",
    call: "911",
    test: (ctx) => ctx.fevered && ctx.tachycardic,
    rationale: (ctx) =>
      `Temperature ${ctx.vitals.tempC}°C, above the day-${ctx.dayPostOp} expected maximum of ${ctx.phase.normalEnvelope.tempCMax}°C, combined with heart rate ${ctx.vitals.hr}, more than 10 bpm above the expected maximum of ${ctx.phase.normalEnvelope.hrMax}${ctx.symptoms.woundDischarge ? "; wound discharge also reported" : ""}.`,
  },
];

const AMBER_RULES: Rule[] = [
  {
    id: "pe.breathless_no_tachycardia",
    condition: "New breathlessness or chest pain",
    severity: "amber",
    action:
      "Contact the surgeon's office today. This needs assessing even though the other readings look normal.",
    call: "surgeon_office",
    // Reaching here means the symptom was reported and nothing corroborated it.
    // A normal heart rate does not exclude a pulmonary embolism, so this must
    // never fall through to green. Downgrade the urgency, not the concern —
    // and deliberately avoid naming a suspected PE without corroboration.
    test: (ctx) => breathlessOrChestPain(ctx),
    rationale: (ctx) =>
      `Breathlessness${ctx.symptoms.chestPain ? "/chest pain" : ""} reported with no corroborating tachycardia, desaturation or ECG finding (heart rate ${ctx.vitals.hr ?? "n/a"}) — a normal heart rate does not exclude a clot.`,
  },
  {
    id: "dvt.calf_pain_or_swelling",
    condition: "Possible DVT",
    severity: "amber",
    action: "Contact the surgeon's office today for an urgent DVT assessment.",
    call: "surgeon_office",
    test: (ctx) => ctx.symptoms.calfPainOrSwelling === true,
    rationale: () =>
      "Calf pain or swelling reported, a possible sign of deep vein thrombosis.",
  },
  {
    id: "wound_infection.fever",
    condition: "Possible wound infection",
    severity: "amber",
    action: "Contact the surgeon's office today to review the wound and temperature.",
    call: "surgeon_office",
    test: (ctx) => ctx.fevered,
    rationale: (ctx) =>
      `Temperature ${ctx.vitals.tempC}°C is above the day-${ctx.dayPostOp} expected maximum of ${ctx.phase.normalEnvelope.tempCMax}°C${ctx.symptoms.woundDischarge ? "; wound discharge also reported" : ""}.`,
  },
  {
    id: "wound_infection.discharge",
    condition: "Possible wound infection",
    severity: "amber",
    action: "Contact the surgeon's office today to review the wound.",
    call: "surgeon_office",
    test: (ctx) => ctx.symptoms.woundDischarge === true,
    rationale: () => "Wound discharge reported, without a fever at this time.",
  },
  {
    id: "afib.new_atrial_fibrillation",
    condition: "New atrial fibrillation",
    severity: "amber",
    action: "Contact the nurse line today to review this new ECG finding.",
    call: "nurse_line",
    test: (ctx) => ctx.ecgDetermination === "atrial_fibrillation",
    rationale: (ctx) =>
      `KardiaMobile ECG determination of atrial fibrillation${ctx.vitals.hr !== undefined ? ` with heart rate ${ctx.vitals.hr}` : ""}.`,
  },
  {
    id: "pain.uncontrolled",
    condition: "Uncontrolled pain",
    severity: "amber",
    action: "Contact the nurse line today to review the pain management plan.",
    call: "nurse_line",
    test: (ctx) => ctx.symptoms.painControlled === false,
    rationale: () => "Patient reports pain is not controlled on the current plan.",
  },
  {
    id: "confusion.new_onset",
    condition: "New confusion",
    severity: "amber",
    action: "Contact the nurse line today to review this new confusion.",
    call: "nurse_line",
    test: (ctx) => ctx.symptoms.newConfusion === true,
    rationale: () => "New confusion reported since surgery.",
  },
  {
    id: "symptoms.extraction_failed",
    condition: "Symptom extraction unavailable",
    severity: "amber",
    action:
      "Contact the nurse line — spoken symptoms could not be read from this check-in, so Mend cannot confirm the patient is well.",
    call: "nurse_line",
    test: (ctx) => ctx.symptomsUnusable,
    rationale: () =>
      "Symptom extraction did not run or failed (missing API client, missing tool_use, or transport error); escalating rather than treating absent structured symptoms as an unremarkable check-in.",
  },
  {
    id: "vitals.unusable_no_data",
    condition: "Vitals unavailable or unreliable",
    severity: "amber",
    action: "Contact the nurse line to retake vitals — the last reading could not be trusted.",
    call: "nurse_line",
    test: (ctx) => ctx.vitalsUnusable,
    rationale: (ctx) =>
      `No trustworthy vitals were available (quality "${ctx.vitals.quality}") and no red-flag symptoms were reported; escalating rather than assuming normal.`,
  },
];

export function evaluate(input: EvaluateInput): Decision {
  const ctx = buildContext(input);

  for (const rule of [...RED_RULES, ...AMBER_RULES]) {
    if (rule.test(ctx)) {
      return {
        level: rule.severity,
        condition: rule.condition,
        action: rule.action,
        call: rule.call,
        rationale: [rule.rationale(ctx)],
        firedRules: [rule.id],
      };
    }
  }

  return {
    level: "green",
    action: "Continue the current recovery plan. No red-flag symptoms or vitals were detected.",
    rationale: [
      `Day ${input.dayPostOp} vitals and symptoms are within the expected recovery envelope.`,
    ],
    firedRules: [],
  };
}
