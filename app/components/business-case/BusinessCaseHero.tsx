"use client";

import { motion } from "framer-motion";
import { MendLogo } from "@/app/components/brand/MendLogo";
import { useLandingMotion } from "@/app/components/landing/motion";
import { businessCaseCopy } from "./copy";

export function BusinessCaseHero() {
  const { fadeUp, staggerContainer } = useLandingMotion();
  const c = businessCaseCopy;

  return (
    <section className="relative px-6 pb-16 pt-6 sm:px-10 sm:pb-20 lg:px-14">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
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
          {c.eyebrow}
        </motion.p>
        <motion.h1
          variants={fadeUp}
          className="mt-3 max-w-3xl font-heading text-heading tracking-tight text-ink sm:text-title"
        >
          {c.headline}
        </motion.h1>
        <motion.p
          variants={fadeUp}
          className="mt-5 max-w-xl text-body-lg text-ink-secondary"
        >
          {c.support}
        </motion.p>
        <motion.p
          variants={fadeUp}
          className="mt-8 max-w-2xl text-lede text-ink"
        >
          {c.lede}
        </motion.p>
        <motion.div variants={fadeUp} className="mt-10">
          <a
            href="#model"
            className="inline-flex min-h-12 items-center bg-ink px-6 text-label text-paper transition-opacity hover:opacity-90"
          >
            Open the live model
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
