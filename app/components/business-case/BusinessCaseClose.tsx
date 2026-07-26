"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MedicalAdviceDisclaimer } from "@/app/components/MedicalAdviceDisclaimer";
import { talkToUsHref } from "@/app/components/landing/contact";
import { useLandingMotion } from "@/app/components/landing/motion";
import { businessCaseCopy } from "./copy";

export function BusinessCaseClose() {
  const { fadeUp, staggerContainer, viewportOnce, initial } = useLandingMotion();
  const c = businessCaseCopy.close;

  return (
    <section className="border-t border-line px-6 py-20 sm:px-10 sm:py-28 lg:px-14">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial={initial}
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.h2
          variants={fadeUp}
          className="max-w-2xl font-heading text-heading tracking-tight text-ink"
        >
          {c.title}
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-4 max-w-xl text-body-lg text-ink-secondary"
        >
          {c.support}
        </motion.p>
        <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href={talkToUsHref()}
            className="inline-flex min-h-12 items-center bg-ink px-6 text-label text-paper transition-opacity hover:opacity-90"
          >
            {c.primaryCta}
          </a>
          <Link
            href={c.secondaryHref}
            className="inline-flex min-h-12 items-center px-2 text-label text-ink-secondary underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            {c.secondaryCta}
          </Link>
        </motion.div>
        <motion.p
          variants={fadeUp}
          className="mt-12 max-w-2xl text-meta text-ink-tertiary"
        >
          {businessCaseCopy.footer}
        </motion.p>
        <motion.div variants={fadeUp}>
          <MedicalAdviceDisclaimer className="mt-6" />
        </motion.div>
      </motion.div>
    </section>
  );
}
