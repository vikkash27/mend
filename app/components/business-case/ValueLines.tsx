"use client";

import { motion } from "framer-motion";
import { useLandingMotion } from "@/app/components/landing/motion";
import { businessCaseCopy } from "./copy";

export function ValueLines() {
  const { fadeUp, staggerContainer, viewportOnce, initial } = useLandingMotion();
  const c = businessCaseCopy.values;

  return (
    <section className="border-t border-line px-6 py-14 sm:px-10 sm:py-16 lg:px-14 lg:py-20">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial={initial}
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.p variants={fadeUp} className="eyebrow">
          {c.eyebrow}
        </motion.p>
        <motion.h2
          variants={fadeUp}
          className="mt-3 max-w-3xl font-heading text-heading tracking-tight text-ink sm:text-title"
        >
          {c.title}
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-3 max-w-2xl text-body-lg text-ink-secondary"
        >
          {c.support}
        </motion.p>

        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {c.lines.map((line, index) => (
            <motion.li
              key={line.title}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 360, damping: 22 }}
              className={`rounded-2xl border p-5 shadow-[0_14px_32px_-24px_rgba(28,25,23,0.35)] ${
                index === 0
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-raised text-ink"
              }`}
            >
              <p
                className={`eyebrow ${
                  index === 0 ? "text-paper/60" : "text-ink-tertiary"
                }`}
              >
                {line.rank}
              </p>
              <h3
                className={`mt-3 font-heading text-subhead ${
                  index === 0 ? "text-paper" : "text-ink"
                }`}
              >
                {line.title}
              </h3>
              <p
                className={`mt-3 text-body ${
                  index === 0 ? "text-paper/80" : "text-ink-secondary"
                }`}
              >
                {line.body}
              </p>
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </section>
  );
}
