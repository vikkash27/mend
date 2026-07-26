import { describe, expect, it } from "vitest";
import type { VoiceBiomarkersRecord } from "@/lib/amplifier/types";
import type { CheckinRecord } from "@/lib/sim/roster";
import {
  callHistoryRowsFromCheckins,
  resolveChartVoiceBiomarkers,
  withLiveInProgressRow,
} from "./CallHistory";

const NOW = "2026-07-26T12:00:00.000Z";

function checkin(partial: Partial<CheckinRecord> & Pick<CheckinRecord, "id">): CheckinRecord {
  return {
    dayPostOp: 4,
    at: "2026-07-25T09:00:00.000Z",
    said: "Feeling a bit short of breath on the stairs.",
    symptoms: {
      breathless: true,
      chestPain: false,
      calfPainOrSwelling: false,
      woundDischarge: false,
      feverSubjective: false,
      suddenSevereHipPain: false,
      legShortenedOrRotated: false,
      unableToWeightBear: false,
      painControlled: true,
      newConfusion: false,
      painScore: 3,
    },
    vitals: {
      timestamp: "2026-07-25T09:00:00.000Z",
      hr: 88,
      spo2: 96,
      tempC: 36.8,
      source: "simulated",
      quality: "ok",
    },
    baseDecision: {
      level: "amber",
      action: "Nurse review",
      condition: "Breathlessness",
      rationale: ["Breathless on exertion"],
      firedRules: ["pe.breathless"],
    },
    trendFindings: [],
    decision: {
      level: "amber",
      action: "Nurse review",
      condition: "Breathlessness",
      rationale: ["Breathless on exertion"],
      firedRules: ["pe.breathless"],
    },
    sbar: "S: breathless",
    callSeconds: 214,
    managementMinutes: 5,
    ...partial,
  };
}

const DURING: VoiceBiomarkersRecord = {
  status: "ready",
  phase: "during",
  conversationId: "conv_live",
  mapped: {
    source: "amplifier",
    quality: "ok",
    respiratory: { level: "high", score: 0.9 },
    cognitive: { level: "low", score: 0.1 },
  },
};

const FINAL: VoiceBiomarkersRecord = {
  status: "ready",
  phase: "final",
  conversationId: "conv_prev",
  mapped: {
    source: "amplifier",
    quality: "ok",
    respiratory: { level: "moderate", score: 0.5 },
    cognitive: { level: "low", score: 0.2 },
  },
};

describe("callHistoryRowsFromCheckins", () => {
  it("maps check-ins newest-first with summary, level, biomarkers, and callSeconds", () => {
    const older = checkin({
      id: "chk_old",
      at: "2026-07-24T08:00:00.000Z",
      dayPostOp: 3,
      said: "Doing alright today.",
      decision: {
        level: "green",
        action: "Continue",
        rationale: [],
        firedRules: [],
      },
      callSeconds: 120,
      voiceBiomarkers: FINAL,
    });
    const newer = checkin({
      id: "chk_new",
      at: "2026-07-25T09:00:00.000Z",
      dayPostOp: 4,
      said: "A little short of breath.",
      callSeconds: 214,
      voiceBiomarkers: { status: "pending", phase: "final" },
    });

    const rows = callHistoryRowsFromCheckins([older, newer]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "chk_new",
      at: "2026-07-25T09:00:00.000Z",
      dayPostOp: 4,
      summary: "A little short of breath.",
      decisionLevel: "amber",
      biomarkersStatus: "pending",
      biomarkersPhase: "final",
      callSeconds: 214,
      inProgress: false,
    });
    expect(rows[1]).toMatchObject({
      id: "chk_old",
      decisionLevel: "green",
      biomarkersStatus: "ready",
      biomarkersPhase: "final",
      callSeconds: 120,
      inProgress: false,
    });
  });
});

describe("withLiveInProgressRow", () => {
  it("prepends an in-progress row when the live session is for this patient", () => {
    const past = callHistoryRowsFromCheckins([
      checkin({ id: "chk_1", said: "Earlier call." }),
    ]);

    const rows = withLiveInProgressRow(past, {
      patientId: "margaret-ellison",
      session: {
        conversationId: "conv_live",
        patientId: "margaret-ellison",
        callStatus: "active",
        turns: [
          { role: "agent", text: "How are you feeling?" },
          { role: "user", text: "Short of breath." },
        ],
        biomarkers: DURING,
        updatedAt: NOW,
      },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "conv_live",
      inProgress: true,
      biomarkersStatus: "ready",
      biomarkersPhase: "during",
      summary: expect.stringContaining("Short of breath"),
    });
    expect(rows[1].id).toBe("chk_1");
  });

  it("keeps the in-progress row while finalizing", () => {
    const past = callHistoryRowsFromCheckins([checkin({ id: "chk_1" })]);
    const rows = withLiveInProgressRow(past, {
      patientId: "margaret-ellison",
      session: {
        conversationId: "conv_live",
        patientId: "margaret-ellison",
        callStatus: "finalizing",
        turns: [{ role: "user", text: "Goodbye." }],
        biomarkers: DURING,
        updatedAt: NOW,
      },
    });
    expect(rows[0]?.inProgress).toBe(true);
  });

  it("does not prepend when the session belongs to another patient", () => {
    const past = callHistoryRowsFromCheckins([checkin({ id: "chk_1" })]);
    const rows = withLiveInProgressRow(past, {
      patientId: "margaret-ellison",
      session: {
        conversationId: "conv_other",
        patientId: "other-patient",
        callStatus: "active",
        turns: [],
        biomarkers: null,
        updatedAt: NOW,
      },
    });
    expect(rows).toEqual(past);
  });
});

describe("resolveChartVoiceBiomarkers", () => {
  it("binds to session biomarkers while phase is during for this patient", () => {
    const latest = checkin({ id: "chk_1", voiceBiomarkers: FINAL });
    const record = resolveChartVoiceBiomarkers({
      patientId: "margaret-ellison",
      latestCheckin: latest,
      session: {
        patientId: "margaret-ellison",
        biomarkers: DURING,
      },
    });
    expect(record).toBe(DURING);
  });

  it("falls back to latest check-in final when session phase is not during", () => {
    const latest = checkin({ id: "chk_1", voiceBiomarkers: FINAL });
    const record = resolveChartVoiceBiomarkers({
      patientId: "margaret-ellison",
      latestCheckin: latest,
      session: {
        patientId: "margaret-ellison",
        biomarkers: { ...DURING, phase: "final" },
      },
    });
    expect(record).toBe(FINAL);
  });

  it("falls back to latest when there is no live session", () => {
    const latest = checkin({ id: "chk_1", voiceBiomarkers: FINAL });
    expect(
      resolveChartVoiceBiomarkers({
        patientId: "margaret-ellison",
        latestCheckin: latest,
        session: null,
      }),
    ).toBe(FINAL);
  });
});
