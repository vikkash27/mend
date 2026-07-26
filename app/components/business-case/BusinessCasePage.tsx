"use client";

import { useEffect } from "react";
import {
  BusinessCaseClose,
  BusinessCaseHero,
  BusinessCaseNav,
  Buyers,
  Consumers,
  Economics,
  Thesis,
  Wedge,
} from "./sections";

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
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,var(--color-wash)_0%,transparent_50%),radial-gradient(ellipse_at_90%_25%,var(--color-wash-strong)_0%,transparent_42%)]"
      />
      <div className="relative">
        <BusinessCaseNav active />
        <BusinessCaseHero />
        <Thesis />
        <Buyers />
        <Economics />
        <Consumers />
        <Wedge />
        <BusinessCaseClose />
      </div>
    </main>
  );
}
