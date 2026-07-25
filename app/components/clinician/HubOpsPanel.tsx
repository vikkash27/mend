"use client";

import { DEFAULT_CAPTURE_PATIENT_ID } from "@/lib/ui/capture-route";
import { PatientCapture } from "./PatientCapture";

/** Temporary Hub drawer wrapper until Task 4 removes Ops drawers. */
export function HubOpsPanel() {
  return (
    <PatientCapture patientId={DEFAULT_CAPTURE_PATIENT_ID} density="full" />
  );
}
