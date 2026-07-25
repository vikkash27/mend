export const DEFAULT_CAPTURE_PATIENT_ID = "margaret-ellison";

export const DEFAULT_CAPTURE_HREF =
  `/clinician/${DEFAULT_CAPTURE_PATIENT_ID}/capture` as const;

export function captureHref(patientId: string): string {
  return `/clinician/${patientId}/capture`;
}
