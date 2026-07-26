"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MendLogo } from "@/app/components/brand/MendLogo";
import { landingCopy } from "./copy";
import { HeroProductPlane } from "./HeroProductPlane";
import { useLandingMotion } from "./motion";

export function Hero() {
  const { fadeUp, staggerContainer } = useLandingMotion();

  return (
    <section className="relative px-6 pb-16 pt-6 sm:px-10 sm:pb-24 lg:px-14">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="max-w-xl"
        >
          <motion.div variants={fadeUp} className="text-ink">
            <MendLogo
              variant="lockup"
              size="xl"
              className="gap-4"
              markClassName="size-12 sm:size-14"
              wordmarkClassName="text-display"
            />
          </motion.div>
          <motion.p variants={fadeUp} className="eyebrow mt-8">
            Post-op recovery co-pilot
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="mt-3 font-heading text-title tracking-tight text-ink sm:text-display"
          >
            {landingCopy.headline}
          </motion.h1>
          <motion.p variants={fadeUp} className="prose-support mt-5">
            {landingCopy.support}
          </motion.p>
          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <Link
              href={landingCopy.primaryHref}
              className="inline-flex min-h-12 items-center bg-ink px-6 text-label font-medium text-paper transition-opacity hover:opacity-90"
            >
              {landingCopy.primaryCta}
            </Link>
            <Link
              href={landingCopy.secondaryHref}
              className="inline-flex min-h-12 items-center px-2 text-label font-medium text-signal-fg underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              {landingCopy.secondaryCta}
            </Link>
          </motion.div>
          <motion.ol
            variants={fadeUp}
            className="mt-10 grid max-w-md gap-2 border-t border-line pt-6 text-meta text-ink-secondary"
          >
            <li className="flex gap-3">
              <span className="numeric font-medium text-signal">01</span>
              <span>Voice check-in at home</span>
            </li>
            <li className="flex gap-3">
              <span className="numeric font-medium text-signal">02</span>
              <span>Deterministic clinical engine</span>
            </li>
            <li className="flex gap-3">
              <span className="numeric font-medium text-signal">03</span>
              <span>Right person notified with the reason</span>
            </li>
          </motion.ol>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="min-w-0"
        >
          <HeroProductPlane />
        </motion.div>
      </div>
    </section>
  );
}
