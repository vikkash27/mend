"use client";

import { useEffect } from "react";
import { AscBand } from "./AscBand";
import { Close } from "./Close";
import { Gap } from "./Gap";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Integrations } from "./Integrations";
import { LandingNav } from "./LandingNav";
import { Surfaces } from "./Surfaces";
import { Trust } from "./Trust";

export function LandingPage() {
  // Scope smooth scrolling to the landing page so /call (and other demos) stay snappy.
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
        <LandingNav />
        <Hero />
        <Gap />
        <HowItWorks />
        <AscBand />
        <Integrations />
        <Trust />
        <Surfaces />
        <Close />
      </div>
    </main>
  );
}
