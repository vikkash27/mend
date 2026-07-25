import { redirect } from "next/navigation";
import { DEFAULT_CAPTURE_HREF } from "@/lib/ui/capture-route";

/** Legacy operator URL — Capture lives on the patient chart route. */
export default function ConsolePage() {
  redirect(DEFAULT_CAPTURE_HREF);
}
