import { Decision, Severity } from "./types";

/**
 * Is this finding new, or has it been true for days?
 *
 * A patient who has sat at the same abnormal reading for three days and a
 * patient who reached it this morning are clinically different people, and an
 * absolute-threshold engine cannot tell them apart: the same rule fires, with
 * the same wording, every day. On a daily monitor that is how a clinician
 * learns to skim the alerts.
 *
 * This module never changes a verdict. Severity remains entirely the engine's,
 * and nothing here can raise or lower it. It answers a different question —
 * *how should this be read* — because de-escalating a persistent abnormality
 * algorithmically is unsafe: a patient stable at a high score can still
 * deteriorate, and "known and already reviewed" is a fact about a clinician
 * having looked, not something inferable from a flat line. Suppression belongs
 * behind an explicit human acknowledgement with an audit trail, not here.
 *
 * Note that persistence is not uniformly reassuring. Persistent fever is
 * infection declaring itself and the engine escalates on it directly
 * (`fever.persistent`); persistent tachycardia in known atrial fibrillation is
 * chronic and unchanged. Both surface here as "persisting" — the distinction
 * is the clinician's to make, and the label exists so they can make it quickly.
 */

export type Novelty =
  /** No prior check-in to compare against. */
  | "unknown"
  /** Nothing fired today and nothing fired last time. */
  | "stable"
  /** Severity is higher than the previous check-in. */
  | "escalating"
  /** At least one rule fired today that did not fire last time. */
  | "new"
  /** The same rules fired last time, and possibly for several days before. */
  | "persisting"
  /** Rules that fired last time are no longer firing. */
  | "resolving";

/** The parts of a stored check-in this needs. Read from `checkins.decision`. */
export interface PriorDecision {
  dayPostOp: number;
  level: Severity;
  firedRules: string[];
}

export interface NoveltyFinding {
  novelty: Novelty;
  /**
   * How many consecutive prior check-ins fired at least one of today's rules.
   * 0 when today's finding is new. Counts back from the most recent.
   */
  consecutiveCheckins: number;
  /** Firing today, absent from the most recent prior check-in. */
  newRules: string[];
  /** Fired in the most recent prior check-in, absent today. */
  clearedRules: string[];
  /** One line for the clinician worklist and the SBAR. */
  label: string;
}

const SEVERITY_ORDER: Record<Severity, number> = { green: 0, amber: 1, red: 2 };

/**
 * @param current  today's verdict, straight from evaluate()
 * @param priors   previous check-ins, any order; sorted here, most recent last
 */
export function assessNovelty(
  current: Pick<Decision, "level" | "firedRules">,
  priors: readonly PriorDecision[],
): NoveltyFinding {
  const today = new Set(current.firedRules ?? []);
  const ordered = [...priors].sort((a, b) => a.dayPostOp - b.dayPostOp);

  if (ordered.length === 0) {
    return {
      novelty: "unknown",
      consecutiveCheckins: 0,
      newRules: [...today],
      clearedRules: [],
      label: "First check-in — no previous readings to compare against.",
    };
  }

  const previous = ordered[ordered.length - 1];
  const prev = new Set(previous.firedRules ?? []);

  const newRules = [...today].filter((r) => !prev.has(r));
  const clearedRules = [...prev].filter((r) => !today.has(r));

  // How far back does at least one of today's rules run unbroken?
  let consecutive = 0;
  for (let i = ordered.length - 1; i >= 0; i--) {
    const fired = new Set(ordered[i].firedRules ?? []);
    if ([...today].some((r) => fired.has(r))) consecutive++;
    else break;
  }

  const fell = SEVERITY_ORDER[current.level] < SEVERITY_ORDER[previous.level];

  // "Escalating" is reserved for a patient who was *already* flagged and has
  // got worse — amber to red. Coming up from green is not an escalation, it is
  // a new finding, and saying so is more informative: one describes a
  // trajectory the clinician may already be following, the other describes
  // something that was not there yesterday.
  const rose =
    SEVERITY_ORDER[current.level] > SEVERITY_ORDER[previous.level] &&
    previous.level !== "green";

  if (rose) {
    return {
      novelty: "escalating",
      consecutiveCheckins: consecutive,
      newRules,
      clearedRules,
      label: `Escalating — ${previous.level} at the last check-in, ${current.level} now.`,
    };
  }

  if (today.size === 0) {
    return prev.size === 0
      ? {
          novelty: "stable",
          consecutiveCheckins: 0,
          newRules: [],
          clearedRules: [],
          label: "Stable — nothing flagged today or at the last check-in.",
        }
      : {
          novelty: "resolving",
          consecutiveCheckins: 0,
          newRules: [],
          clearedRules,
          label: `Resolving — ${describe(clearedRules)} no longer flagged.`,
        };
  }

  if (newRules.length > 0) {
    return {
      novelty: "new",
      consecutiveCheckins: consecutive,
      newRules,
      clearedRules,
      label: `New today — ${describe(newRules)} not present at the last check-in.`,
    };
  }

  if (fell) {
    return {
      novelty: "resolving",
      consecutiveCheckins: consecutive,
      newRules,
      clearedRules,
      label: `Improving — ${previous.level} at the last check-in, ${current.level} now.`,
    };
  }

  return {
    novelty: "persisting",
    consecutiveCheckins: consecutive,
    newRules,
    clearedRules,
    label:
      consecutive >= 2
        ? `Unchanged — the same finding for ${consecutive} consecutive check-ins.`
        : "Unchanged since the last check-in.",
  };
}

function describe(rules: readonly string[]): string {
  if (rules.length === 0) return "the previous finding";
  if (rules.length === 1) return rules[0];
  return `${rules.slice(0, -1).join(", ")} and ${rules[rules.length - 1]}`;
}

/**
 * Sort key for a clinician worklist: what needs looking at first.
 *
 * Severity dominates, because a red is a red however long it has been true.
 * Within a severity, a newly-appeared or escalating finding outranks one that
 * has been unchanged for days — which is the whole point of computing this.
 */
export function worklistRank(
  level: Severity,
  finding: Pick<NoveltyFinding, "novelty">,
): number {
  const noveltyWeight: Record<Novelty, number> = {
    escalating: 0,
    new: 1,
    unknown: 2,
    persisting: 3,
    resolving: 4,
    stable: 5,
  };
  return (2 - SEVERITY_ORDER[level]) * 10 + noveltyWeight[finding.novelty];
}
