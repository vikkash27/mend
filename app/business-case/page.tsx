import type { Metadata } from "next";
import { BusinessCasePage } from "@/app/components/business-case/BusinessCasePage";

export const metadata: Metadata = {
  title: "Mend — Business case for ASC capacity & patient adoption",
  description:
    "Why investors and ambulatory surgery centers need a post-op safety net — and why elderly joint patients will answer a voice check-in instead of downloading another app.",
};

export default function BusinessCaseRoute() {
  return <BusinessCasePage />;
}
