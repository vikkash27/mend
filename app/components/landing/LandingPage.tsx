"use client";

import { Close } from "./Close";
import { Gap } from "./Gap";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { LandingNav } from "./LandingNav";
import { Surfaces } from "./Surfaces";
import { Trust } from "./Trust";

export function LandingPage() {
  return (
    <main id="top" className="relative min-h-dvh overflow-x-hidden bg-paper">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,var(--color-wash)_0%,transparent_50%),radial-gradient(ellipse_at_90%_30%,var(--color-wash-strong)_0%,transparent_40%)]"
      />
      <div className="relative">
        <LandingNav />
        <Hero />
        <Gap />
        <HowItWorks />
        <Trust />
        <Surfaces />
        <Close />
      </div>
    </main>
  );
}
