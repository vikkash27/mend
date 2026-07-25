import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAPTURE_HREF,
  DEFAULT_CAPTURE_PATIENT_ID,
  captureHref,
} from "./capture-route";

describe("capture routes", () => {
  it("defaults to Margaret Capture", () => {
    expect(DEFAULT_CAPTURE_PATIENT_ID).toBe("margaret-ellison");
    expect(DEFAULT_CAPTURE_HREF).toBe("/clinician/margaret-ellison/capture");
  });

  it("builds a patient-scoped capture href", () => {
    expect(captureHref("margaret-ellison")).toBe(
      "/clinician/margaret-ellison/capture",
    );
    expect(captureHref("other-patient")).toBe("/clinician/other-patient/capture");
  });
});
