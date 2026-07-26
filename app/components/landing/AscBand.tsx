"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { businessCaseCopy } from "@/app/components/business-case/copy";
import { useLandingMotion } from "./motion";

/**
 * Mid-landing bridge into the ASC business case — one job, one CTA.
 */
export function AscBand() {
  const { fadeUp, staggerContainer, viewportOnce, initial } = useLandingMotion();
  const c = businessCaseCopy.landingBand;

  return (
    <section className="border-t border-line px-6 py-14 sm:px-10 sm:py-16 lg:px-14 lg:py-20">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial={initial}
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.div
          variants={fadeUp}
          className="relative overflow-hidden rounded-2xl border border-signal bg-signal px-6 py-10 text-paper shadow-[0_24px_48px_-28px_rgba(13,92,94,0.45)] sm:px-10 sm:py-12"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-paper/10 blur-3xl"
          />
          <p className="eyebrow relative text-paper/70">{c.eyebrow}</p>
          <h2 className="relative mt-3 max-w-2xl font-heading text-heading tracking-tight text-paper sm:text-title">
            {c.title}
          </h2>
          <p className="relative mt-4 max-w-xl text-body-lg text-paper/85">{c.support}</p>
          <Link
            href={c.href}
            className="relative mt-8 inline-flex min-h-12 items-center bg-paper px-6 text-label font-medium text-signal-fg transition-opacity hover:opacity-90"
          >
            {c.cta}
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
