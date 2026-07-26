"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useLandingMotion } from "@/app/components/landing/motion";
import { businessCaseCopy } from "./copy";

export function Assumptions() {
  const { fadeUp, staggerContainer, viewportOnce, initial } = useLandingMotion();
  const [open, setOpen] = useState(false);
  const c = businessCaseCopy.assumptions;

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
          className="mt-3 max-w-3xl font-heading text-heading tracking-tight text-ink"
        >
          {c.title}
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-3 max-w-2xl text-body-lg text-ink-secondary"
        >
          {c.summary}
        </motion.p>

        <motion.div variants={fadeUp} className="mt-8">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex min-h-11 items-center gap-2 text-label text-ink underline-offset-4 hover:underline"
          >
            {open ? "Hide diligence notes" : "Show diligence notes"}
            <span aria-hidden className="text-ink-tertiary">
              {open ? "↑" : "↓"}
            </span>
          </button>

          {open ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-severity-red-border bg-severity-red-bg p-5">
                <p className="text-label font-medium text-severity-red-fg">
                  Load-bearing assumption
                </p>
                <p className="mt-2 max-w-3xl text-body text-ink-secondary">{c.fragile}</p>
              </div>
              <div className="rounded-2xl border border-line bg-raised p-5">
                <p className="text-label font-medium text-ink">{c.excludedTitle}</p>
                <p className="mt-2 max-w-3xl text-body text-ink-secondary">{c.excluded}</p>
              </div>
              <ul className="space-y-3">
                {c.diligence.map((item) => (
                  <li
                    key={item.title}
                    className="grid gap-2 rounded-xl border border-line bg-raised px-4 py-3 sm:grid-cols-[5.5rem_1fr] sm:gap-4"
                  >
                    <span
                      className={`text-meta font-medium uppercase tracking-wide ${
                        item.severity === "High"
                          ? "text-severity-red-fg"
                          : "text-severity-amber-fg"
                      }`}
                    >
                      {item.severity}
                    </span>
                    <div>
                      <p className="text-label text-ink">{item.title}</p>
                      <p className="mt-1 text-meta text-ink-secondary">{item.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </section>
  );
}
