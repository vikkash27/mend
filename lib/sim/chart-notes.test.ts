import { describe, expect, it } from "vitest";
import { addChartNote, listChartNotes } from "@/lib/sim/chart-notes";

describe("chart notes store", () => {
  it("rejects empty notes and lists newest first", () => {
    const patientId = `test-notes-${crypto.randomUUID()}`;
    expect(addChartNote({ patientId, body: "   " })).toEqual({
      error: "Note cannot be empty.",
    });

    const first = addChartNote({
      patientId,
      body: "Called daughter — she is driving over.",
      author: "RN Demo",
    });
    const second = addChartNote({
      patientId,
      body: "PE pathway acknowledged; monitoring SpO2.",
    });
    expect("error" in first).toBe(false);
    expect("error" in second).toBe(false);

    const listed = listChartNotes(patientId);
    expect(listed).toHaveLength(2);
    expect(listed[0]?.body).toBe("PE pathway acknowledged; monitoring SpO2.");
    expect(listed[0]?.author).toBe("Demo clinician");
    expect(listed[1]?.author).toBe("RN Demo");
  });
});
