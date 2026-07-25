import { Severity } from "./types";
import {
  Medication,
  MedicationAdministration,
  dosesInLast24h,
  dosesInPrior24h,
  hoursSinceLastDose,
  nextDoseDueAt,
} from "./medications";

/**
 * A patient asks for extra pain relief. What should happen?
 *
 * THE CLINICAL POINT. In post-operative orthopaedics a rising analgesia
 * requirement is a red flag before it is a supply question. Pain out of
 * proportion is the classic early sign of compartment syndrome, and escalating
 * pain also accompanies infection, prosthetic dislocation and DVT. Treating the
 * request as "may she have another oxycodone?" answers the wrong question and
 * can bury the right one. So the request is routed through the clinical picture
 * first, and only then through the dosing arithmetic.
 *
 * WHAT THIS NEVER DOES. It never approves a dose. Approval is a prescribing
 * decision and belongs to a clinician, so the outcomes here describe *what to
 * ask and of whom* — not what to give. The software's job is to make the ask
 * fast, correctly framed, and impossible to skip when the picture says assess
 * rather than medicate.
 */

export type PrnOutcome =
  /** The clinical picture says assess, not medicate. Routed to the care team. */
  | "assess_first"
  /** Too soon since the last dose. */
  | "blocked_interval"
  /** At the 24-hour ceiling. */
  | "blocked_max_daily"
  /** Prescribed but withheld — a recorded contraindication. */
  | "contraindicated"
  /** Not prescribed as PRN at all. */
  | "not_prn"
  /** Within limits, and a clinician must still decide. */
  | "awaiting_clinician";

export interface PrnAssessment {
  outcome: PrnOutcome;
  /** Shown to the patient. Plain, kind, and never a promise. */
  patientMessage: string;
  /** The one line a clinician reads on their phone. */
  clinicianSummary: string;
  /** Whether to notify a clinician at all, and how urgently. */
  notify: "none" | "routine" | "urgent";
  /** Machine-readable reasons, same convention as the engine's firedRules. */
  reasons: string[];
  dosesUsedIn24h: number;
  maxDosesIn24h?: number;
  nextDoseDueAt?: string;
  /** True when today's requirement is materially above yesterday's. */
  requirementRising: boolean;
}

export interface PrnRequestInput {
  medication: Medication;
  administrations: readonly MedicationAdministration[];
  now: Date;
  /** The current verdict from evaluate(). A live concern outranks a dose. */
  currentSeverity: Severity;
  /** Rules that fired today — used to name what should be assessed instead. */
  firedRules?: readonly string[];
  /** 0–10 if the patient gave one. */
  painScore?: number;
}

/**
 * Rising requirement threshold: at least two more doses than the previous
 * 24 hours, and at least three today. Two extra doses is a real change in a
 * six-dose ceiling; the floor stops a patient going from zero to two — normal
 * early variation — reading as deterioration.
 *
 * NOT SOURCED. Like every threshold in this codebase it is plausible and
 * uncited; see docs/CLINICAL_SOURCES.md.
 */
const RISING_DELTA = 2;
const RISING_FLOOR = 3;

/** Pain severe enough to warrant assessment on its own, whatever the dose history. */
const SEVERE_PAIN_SCORE = 8;

export function assessPrnRequest(input: PrnRequestInput): PrnAssessment {
  const { medication, administrations, now, currentSeverity, painScore } = input;

  const used = dosesInLast24h(medication.id, administrations, now);
  const prior = dosesInPrior24h(medication.id, administrations, now);
  const since = hoursSinceLastDose(medication.id, administrations, now);
  const dueAt = nextDoseDueAt(medication, administrations, now);
  const rising = used >= RISING_FLOOR && used - prior >= RISING_DELTA;

  const base = {
    dosesUsedIn24h: used,
    maxDosesIn24h: medication.maxDosesIn24h,
    nextDoseDueAt: dueAt?.toISOString(),
    requirementRising: rising,
  };

  // ---- Contraindication: recorded by a clinician, never reasoned around ----
  if (medication.contraindicationNote) {
    return {
      ...base,
      outcome: "contraindicated",
      notify: "routine",
      patientMessage:
        "That one isn't right for you at the moment. I've let your care team know you're asking, and they'll come back to you.",
      clinicianSummary: `Requested ${medication.name} — withheld. ${medication.contraindicationNote}`,
      reasons: ["prn.contraindicated"],
    };
  }

  if (medication.schedule !== "prn") {
    return {
      ...base,
      outcome: "not_prn",
      notify: "routine",
      patientMessage:
        "That's one of your regular medicines rather than an as-needed one. I've told your care team you're asking about it.",
      clinicianSummary: `Requested ${medication.name}, which is prescribed regularly rather than PRN.`,
      reasons: ["prn.not_a_prn_medication"],
    };
  }

  // ---- The clinical picture outranks the dosing arithmetic ----
  //
  // A live amber or red means something is already being escalated. Adding
  // analgesia on top would treat a symptom that is currently doing useful work
  // as a signal, and could mask the very thing under assessment.
  if (currentSeverity !== "green") {
    return {
      ...base,
      outcome: "assess_first",
      notify: "urgent",
      patientMessage:
        "Before any extra pain relief, someone needs to check on you — your other readings today need looking at first. Your care team is being contacted now.",
      clinicianSummary:
        `Requested ${medication.name} while a ${currentSeverity} finding is open` +
        `${input.firedRules?.length ? ` (${input.firedRules.join(", ")})` : ""}. ` +
        `Assess before analgesia — new or escalating pain can be the presenting sign rather than the problem.`,
      reasons: ["prn.assess_before_analgesia", `prn.open_${currentSeverity}_finding`],
    };
  }

  if (painScore !== undefined && painScore >= SEVERE_PAIN_SCORE) {
    return {
      ...base,
      outcome: "assess_first",
      notify: "urgent",
      patientMessage:
        "That level of pain needs someone to look at you rather than just more tablets. Your care team is being contacted now.",
      clinicianSummary:
        `Requested ${medication.name} with pain scored ${painScore}/10. Pain out of proportion is the earliest sign of compartment syndrome and accompanies infection and dislocation — assess before increasing analgesia.`,
      reasons: ["prn.assess_before_analgesia", "prn.severe_pain_score"],
    };
  }

  if (rising) {
    return {
      ...base,
      outcome: "assess_first",
      notify: "urgent",
      patientMessage:
        "You've needed more pain relief than usual over the last day, so someone should check on you before you take any more. Your care team is being contacted now.",
      clinicianSummary:
        `Requested ${medication.name}. Requirement rising: ${used} doses in 24h versus ${prior} the day before. A climbing analgesia requirement after hip surgery warrants assessment for infection, dislocation or compartment syndrome.`,
      reasons: ["prn.assess_before_analgesia", "prn.requirement_rising"],
    };
  }

  // ---- Dosing arithmetic ----
  if (medication.maxDosesIn24h !== undefined && used >= medication.maxDosesIn24h) {
    return {
      ...base,
      outcome: "blocked_max_daily",
      notify: "urgent",
      patientMessage:
        `You've already had the maximum ${medication.name.toLowerCase()} for today, so please don't take any more. Your care team is being contacted about your pain.`,
      clinicianSummary: `Requested ${medication.name} at the 24-hour ceiling (${used}/${medication.maxDosesIn24h}). Pain not controlled within the prescribed limit — needs review.`,
      reasons: ["prn.at_daily_maximum"],
    };
  }

  if (dueAt !== undefined) {
    const mins = Math.max(1, Math.round((dueAt.getTime() - now.getTime()) / 60_000));
    return {
      ...base,
      outcome: "blocked_interval",
      notify: "routine",
      patientMessage:
        `It's a bit soon — your next dose is due in about ${mins} minute${mins === 1 ? "" : "s"}. I'll remind you. If the pain is worse than usual, tell me and I'll get someone.`,
      clinicianSummary: `Requested ${medication.name} ${since !== undefined ? `${since.toFixed(1)}h` : "shortly"} after the last dose (minimum ${medication.minIntervalHours}h). ${used}/${medication.maxDosesIn24h ?? "?"} used in 24h.`,
      reasons: ["prn.interval_not_elapsed"],
    };
  }

  // ---- Within limits. A clinician still decides. ----
  return {
    ...base,
    outcome: "awaiting_clinician",
    notify: medication.isOpioid ? "urgent" : "routine",
    patientMessage:
      "I've asked your care team about that now. Please wait to hear from them before taking anything extra — they'll be in touch shortly.",
    clinicianSummary:
      `Requests ${medication.dose} ${medication.name}. Within limits: ${used}/${medication.maxDosesIn24h ?? "?"} in 24h, ` +
      `${since !== undefined ? `${since.toFixed(1)}h` : "no dose yet"} since last${painScore !== undefined ? `, pain ${painScore}/10` : ""}. ` +
      `${medication.isOpioid ? "Opioid — requires your approval." : "Approve or call."}`,
    reasons: [
      "prn.within_limits",
      medication.isOpioid ? "prn.opioid_requires_approval" : "prn.requires_approval",
    ],
  };
}
