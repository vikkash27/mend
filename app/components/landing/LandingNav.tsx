"use client";

import { MendLogo } from "@/app/components/brand/MendLogo";
import { talkToUsHref } from "./contact";
import { landingCopy } from "./copy";

export function LandingNav() {
  return (
    <header className="relative z-20 flex items-center justify-between px-6 py-5 sm:px-10 lg:px-14">
      <a
        href="#top"
        className="inline-flex min-h-11 items-center text-ink"
        aria-label={landingCopy.brand}
      >
        <MendLogo variant="lockup" size="md" />
      </a>
      <a
        href={talkToUsHref()}
        className="min-h-11 inline-flex items-center text-label text-ink-secondary transition-colors hover:text-ink"
      >
        {landingCopy.contactCta}
      </a>
    </header>
  );
}
