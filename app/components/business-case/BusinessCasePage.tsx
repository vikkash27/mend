"use client";

import { useEffect } from "react";
import { LandingNav } from "@/app/components/landing/LandingNav";
import { Assumptions } from "./Assumptions";
import { BusinessCaseClose } from "./BusinessCaseClose";
import { BusinessCaseHero } from "./BusinessCaseHero";
import { RoiWorksheet } from "./RoiWorksheet";
import { ValueLines } from "./ValueLines";

export function BusinessCasePage() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("scroll-smooth");
    return () => {
      root.classList.remove("scroll-smooth");
    };
  }, []);

  return (
    <main id="top" className="relative min-h-dvh overflow-x-hidden bg-paper">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_0%,var(--color-signal-soft)_0%,transparent_42%),radial-gradient(ellipse_at_90%_20%,var(--color-wash-strong)_0%,transparent_45%),radial-gradient(ellipse_at_50%_100%,var(--color-wash)_0%,transparent_40%)]"
      />
      <div className="relative">
        <LandingNav brandHref="/" />
        <BusinessCaseHero />
        <ValueLines />
        <RoiWorksheet />
        <Assumptions />
        <BusinessCaseClose />
      </div>
    </main>
  );
}
