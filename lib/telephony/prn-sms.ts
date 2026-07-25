import { PrnAssessment } from "@/lib/clinical/prn";
import { Medication } from "@/lib/clinical/medications";

/**
 * The message a clinician gets on their phone when a patient asks for extra
 * pain relief.
 *
 * Written for someone glancing at a lock screen between cases: what was asked,
 * the one fact that decides it, and what to do. The urgent variants lead with
 * the reason to assess rather than the request, because in those cases the
 * request is the least important thing in the message.
 */

export interface PrnNotification {
  body: string;
  /** Urgent messages should bypass quiet hours; routine ones need not. */
  urgent: boolean;
}

const MAX_SMS_CHARS = 320;

export function buildPrnClinicianMessage(args: {
  patientFirstName: string;
  dayPostOp: number;
  medication: Medication;
  assessment: PrnAssessment;
  approveUrl?: string;
}): PrnNotification {
  const { patientFirstName, dayPostOp, medication, assessment, approveUrl } = args;
  const urgent = assessment.notify === "urgent";

  const lead =
    assessment.outcome === "assess_first"
      ? `ASSESS FIRST — ${patientFirstName}, day ${dayPostOp}`
      : `${patientFirstName}, day ${dayPostOp}`;

  const action =
    assessment.outcome === "assess_first"
      ? "Call her before any extra analgesia."
      : assessment.outcome === "awaiting_clinician"
        ? "Reply APPROVE to authorise, or CALL to speak to her."
        : "No action needed unless you want to review.";

  const body = [
    `Mend · ${lead}`,
    assessment.clinicianSummary,
    action,
    approveUrl,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_SMS_CHARS);

  return { body, urgent };
}

/**
 * Which replies mean what. Kept deliberately small and case-insensitive: a
 * clinician typing on a phone should not have to remember syntax, and anything
 * unrecognised is treated as no decision rather than guessed at.
 */
export function parseClinicianReply(
  reply: string,
): "approved" | "declined" | "call_placed" | "unrecognised" {
  const t = reply.trim().toLowerCase();
  if (/^(approve|approved|yes|y|ok)\b/.test(t)) return "approved";
  if (/^(decline|declined|no|n|deny)\b/.test(t)) return "declined";
  if (/^(call|ring|phone)\b/.test(t)) return "call_placed";
  return "unrecognised";
}
