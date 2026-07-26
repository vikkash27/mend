import type { Metadata } from "next";
import { BusinessCasePage } from "@/app/components/business-case/BusinessCasePage";

export const metadata: Metadata = {
  title: "Mend — ASC business case",
  description:
    "Why Mend’s buyer is the ambulatory surgery center, and an interactive per-center ROI model.",
};

export default function BusinessCaseRoute() {
  return <BusinessCasePage />;
}
