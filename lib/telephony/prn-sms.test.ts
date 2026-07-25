import { describe, it, expect } from "vitest";
import { buildPrnClinicianMessage, parseClinicianReply } from "./prn-sms";
import { findMedication } from "@/lib/clinical/medications";
import { assessPrnRequest } from "@/lib/clinical/prn";

const oxycodone = findMedication("oxycodone-5mg")!;
const NOW = new Date("2026-07-25T14:00:00Z");

const message = (severity: "green" | "amber" | "red", painScore?: number) =>
  buildPrnClinicianMessage({
    patientFirstName: "Margaret",
    dayPostOp: 9,
    medication: oxycodone,
    assessment: assessPrnRequest({
      medication: oxycodone,
      administrations: [
        { medicationId: "oxycodone-5mg", takenAt: new Date(NOW.getTime() - 6 * 3_600_000).toISOString(), source: "patient_reported" },
      ],
      now: NOW,
      currentSeverity: severity,
      firedRules: severity === "red" ? ["pe.breathless_with_tachycardia"] : [],
      painScore,
    }),
  });

describe("buildPrnClinicianMessage", () => {
  it("leads with the reason to assess when the picture says assess", () => {
    const m = message("red");
    expect(m.body).toMatch(/^Mend · ASSESS FIRST/);
    expect(m.urgent).toBe(true);
    expect(m.body).toMatch(/call her before any extra analgesia/i);
  });

  it("offers approve or call when the request is clean and in limits", () => {
    const m = message("green");
    expect(m.body).toMatch(/reply APPROVE/i);
    expect(m.body).toMatch(/or CALL/i);
    expect(m.body).not.toMatch(/ASSESS FIRST/);
  });

  it("names the patient and the day, so it reads on a lock screen", () => {
    expect(message("green").body).toMatch(/Margaret, day 9/);
  });

  it("stays within a sensible SMS length", () => {
    for (const s of ["green", "amber", "red"] as const) {
      expect(message(s).body.length).toBeLessThanOrEqual(320);
    }
  });

  it("marks severe pain urgent even with a clean dose history", () => {
    const m = message("green", 9);
    expect(m.urgent).toBe(true);
    expect(m.body).toMatch(/ASSESS FIRST/);
  });
});

describe("parseClinicianReply", () => {
  it("accepts the obvious affirmatives", () => {
    for (const r of ["approve", "APPROVED", "yes", "Y", "ok"]) {
      expect(parseClinicianReply(r)).toBe("approved");
    }
  });

  it("accepts the obvious negatives", () => {
    for (const r of ["decline", "No", "n", "deny"]) {
      expect(parseClinicianReply(r)).toBe("declined");
    }
  });

  it("recognises a request to call", () => {
    for (const r of ["call", "Call her", "ring", "phone"]) {
      expect(parseClinicianReply(r)).toBe("call_placed");
    }
  });

  /** Anything ambiguous must be no decision — never a guessed approval. */
  it("treats anything unrecognised as no decision", () => {
    for (const r of ["", "maybe", "what?", "approx", "🙂", "not sure"]) {
      expect(parseClinicianReply(r)).toBe("unrecognised");
    }
  });

  it("does not read 'no' inside another word as a decline", () => {
    expect(parseClinicianReply("nothing yet")).toBe("unrecognised");
  });
});
