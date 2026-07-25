"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Phone, Shield, Users } from "lucide-react";
import { useState } from "react";
import { SeverityChip } from "@/components/ui/severity-chip";
import { landingCopy } from "./copy";
import { useLandingMotion } from "./motion";

const BEAT_ICONS = [Phone, Shield, Users] as const;

/**
 * Interactive how-it-works — click a beat to spotlight it; panels grow on scroll.
 */
export function HowItWorks() {
  const { fadeUp, growIn, staggerContainer, viewportSpotlight, initial, reduce } =
    useLandingMotion();
  const c = landingCopy.how;
  const [active, setActive] = useState(0);

  return (
    <section className="border-t border-line bg-wash/50 px-6 py-14 sm:px-10 sm:py-16 lg:px-14 lg:py-20">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial={initial}
        whileInView="show"
        viewport={viewportSpotlight}
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

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] lg:gap-6">
          <ol className="flex flex-col gap-2">
            {c.beats.map((beat, index) => {
              const Icon = BEAT_ICONS[index] ?? Phone;
              const on = active === index;
              return (
                <motion.li key={beat.title} variants={growIn}>
                  <button
                    type="button"
                    onClick={() => setActive(index)}
                    onMouseEnter={() => setActive(index)}
                    className={`group flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition-colors ${
                      on
                        ? "border-ink bg-ink text-paper shadow-[0_16px_36px_-22px_rgba(28,25,23,0.55)]"
                        : "border-line bg-raised text-ink hover:border-line-strong"
                    }`}
                  >
                    <motion.span
                      animate={on && !reduce ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                      transition={{ duration: 0.9, repeat: on && !reduce ? Infinity : 0 }}
                      className={`numeric mt-0.5 text-lg font-medium tabular-nums ${
                        on ? "text-paper/70" : "text-ink-tertiary"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </motion.span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Icon
                          className={`size-4 ${on ? "text-paper" : "text-ink-secondary"}`}
                          strokeWidth={2}
                        />
                        <h3
                          className={`font-heading text-subhead leading-snug ${
                            on ? "text-paper" : "text-ink"
                          }`}
                        >
                          {beat.title}
                        </h3>
                      </div>
                      <p
                        className={`mt-2 text-body ${
                          on ? "text-paper/80" : "text-ink-secondary"
                        }`}
                      >
                        {beat.body}
                      </p>
                    </div>
                  </button>
                </motion.li>
              );
            })}
          </ol>

          <motion.div
            variants={growIn}
            className="relative min-h-[320px] overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_22px_48px_-30px_rgba(28,25,23,0.4)]"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={reduce ? false : { opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.98, y: -8 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 flex flex-col p-5 sm:p-6"
              >
                {active === 0 ? <PreviewCall reduce={reduce} /> : null}
                {active === 1 ? <PreviewEngine reduce={reduce} /> : null}
                {active === 2 ? <PreviewTruth reduce={reduce} /> : null}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

function PreviewCall({ reduce }: { reduce: boolean }) {
  return (
    <>
      <p className="text-meta tracking-wide text-ink-tertiary uppercase">
        Product · call
      </p>
      <p className="mt-1 font-heading text-subhead text-ink">Margaret picks up</p>
      <div className="mt-5 flex flex-1 flex-col gap-2.5">
        <motion.p
          initial={reduce ? false : { opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-[90%] rounded-2xl rounded-tl-md bg-wash px-3 py-2 text-label text-ink-secondary"
        >
          <span className="font-medium text-ink">Mend — </span>
          How did you sleep last night?
        </motion.p>
        <motion.p
          initial={reduce ? false : { opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md border border-line px-3 py-2 text-label text-ink"
        >
          Pretty well — up once with the walker.
        </motion.p>
      </div>
      <p className="pt-3 text-meta text-ink-tertiary">
        One calm call. No app to open.
      </p>
    </>
  );
}

function PreviewEngine({ reduce }: { reduce: boolean }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-meta tracking-wide text-ink-tertiary uppercase">
            Product · engine
          </p>
          <p className="mt-1 font-heading text-subhead text-ink">Rules lock the level</p>
        </div>
        <motion.div
          initial={reduce ? false : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
        >
          <SeverityChip level="red" size="sm" />
        </motion.div>
      </div>
      <ul className="mt-5 space-y-2">
        {["Breathless + HR", "Chest pain · day 4"].map((rule, i) => (
          <motion.li
            key={rule}
            initial={reduce ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.12 }}
            className="rounded-xl border border-severity-red-border bg-severity-red-bg px-3 py-2.5 text-label text-ink"
          >
            <span className="font-medium">{rule}</span>
            <span className="ml-2 text-meta text-severity-red-fg">Fired</span>
          </motion.li>
        ))}
      </ul>
      <p className="mt-auto pt-4 text-meta text-ink-tertiary">
        The LLM speaks the script — it never picks green / amber / red.
      </p>
    </>
  );
}

function PreviewTruth({ reduce }: { reduce: boolean }) {
  return (
    <>
      <p className="text-meta tracking-wide text-ink-tertiary uppercase">
        Product · same truth
      </p>
      <p className="mt-1 font-heading text-subhead text-ink">Everyone sees one decision</p>
      <div className="mt-5 grid flex-1 grid-cols-2 gap-2">
        {[
          { seat: "Family", line: "Drive over today." },
          { seat: "Clinician", line: "PE pathway · escalate" },
        ].map((card, i) => (
          <motion.div
            key={card.seat}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.12 }}
            className="flex flex-col rounded-xl border border-line bg-wash px-3 py-3"
          >
            <p className="text-meta text-ink-tertiary">{card.seat}</p>
            <div className="pt-2">
              <SeverityChip level="red" size="sm" />
            </div>
            <p className="pt-2 text-label leading-snug text-ink">{card.line}</p>
          </motion.div>
        ))}
      </div>
    </>
  );
}
