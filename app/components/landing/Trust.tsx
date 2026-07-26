"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { landingCopy } from "./copy";
import { useLandingMotion } from "./motion";

export function Trust() {
  const { fadeUp, staggerContainer, viewportOnce, initial } = useLandingMotion();
  const c = landingCopy.trust;

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
        <motion.p variants={fadeUp} className="prose-support mt-3">
          {c.support}
        </motion.p>
        <ul className="mt-8 grid gap-3 md:grid-cols-3 md:gap-4">
          {c.points.map((point) => (
            <motion.li
              key={point.title}
              variants={fadeUp}
              whileHover={{ y: -4, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 360, damping: 22 }}
              className="rounded-2xl border border-line bg-raised p-5 shadow-[0_14px_32px_-24px_rgba(28,25,23,0.35)]"
            >
              <h3 className="font-heading text-subhead text-ink">{point.title}</h3>
              <p className="mt-3 text-body text-ink-secondary">{point.body}</p>
              {point.title === "Rules you can open" ? (
                <Link
                  href="/clinician/engine"
                  className="mt-4 inline-flex min-h-11 items-center text-label text-ink underline-offset-4 hover:underline"
                >
                  Inspect the rule engine →
                </Link>
              ) : null}
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </section>
  );
}
