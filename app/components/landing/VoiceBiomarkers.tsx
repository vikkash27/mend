"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Phone } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { PhoneFrame } from "@/app/components/device/PhoneFrame";
import { SeverityChip } from "@/components/ui/severity-chip";
import { landingCopy } from "./copy";
import { useLandingMotion } from "./motion";

type Phase = "ring" | "talk" | "biomarkers";

const PHASES: { id: Phase; dwell: number }[] = [
  { id: "ring", dwell: 2800 },
  { id: "talk", dwell: 4200 },
  { id: "biomarkers", dwell: 4800 },
];

/**
 * Landing highlight for voice biomarkers — 2D phone loop:
 * ringing → conversation → respiratory/cognitive readout.
 */
export function VoiceBiomarkers() {
  const { fadeUp, growIn, staggerContainer, viewportOnce, initial, reduce } =
    useLandingMotion();
  const c = landingCopy.voice;
  const [phase, setPhase] = useState<Phase>("ring");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;
    const idx = PHASES.findIndex((p) => p.id === phase);
    const dwell = PHASES[idx]!.dwell;
    const id = window.setTimeout(() => {
      setPhase(PHASES[(idx + 1) % PHASES.length]!.id);
    }, dwell);
    return () => window.clearTimeout(id);
  }, [phase, reduce, paused]);

  const active = reduce ? "biomarkers" : phase;
  const activeIndex = PHASES.findIndex((p) => p.id === active);

  return (
    <section
      id="voice"
      className="scroll-mt-8 border-t border-line px-6 py-14 sm:px-10 sm:py-16 lg:px-14 lg:py-20"
    >
      <motion.div
        className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14"
        variants={staggerContainer}
        initial={initial}
        whileInView="show"
        viewport={viewportOnce}
      >
        <div>
          <motion.p variants={fadeUp} className="eyebrow">
            {c.eyebrow}
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="mt-3 max-w-xl font-heading text-heading tracking-tight text-ink sm:text-title"
          >
            {c.title}
          </motion.h2>
          <motion.p variants={fadeUp} className="prose-support mt-3">
            {c.support}
          </motion.p>

          <ol className="mt-8 space-y-3">
            {c.steps.map((step, i) => {
              const on = activeIndex === i;
              return (
                <motion.li key={step.title} variants={fadeUp}>
                  <button
                    type="button"
                    onClick={() => setPhase(PHASES[i]!.id)}
                    className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                      on
                        ? "border-signal bg-signal-soft/60"
                        : "border-line bg-raised hover:border-line-strong"
                    }`}
                  >
                    <span
                      className={`numeric mt-0.5 text-label font-medium ${
                        on ? "text-signal-fg" : "text-ink-tertiary"
                      }`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <span className="block font-heading text-subhead text-ink">
                        {step.title}
                      </span>
                      <span className="mt-1 block text-body text-ink-secondary">
                        {step.body}
                      </span>
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </ol>
        </div>

        <motion.div
          variants={growIn}
          className="relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          aria-hidden="true"
        >
          <PhoneFrame
            preview
            className="max-w-[300px] sm:max-w-[320px]"
            contentClassName="h-[min(520px,58vh)]"
          >
            <AnimatePresence mode="wait">
              {active === "ring" ? (
                <RingScreen key="ring" reduce={reduce} />
              ) : null}
              {active === "talk" ? (
                <TalkScreen key="talk" reduce={reduce} />
              ) : null}
              {active === "biomarkers" ? (
                <BiomarkerScreen key="biomarkers" reduce={reduce} />
              ) : null}
            </AnimatePresence>
          </PhoneFrame>
          <p className="mt-4 text-center text-meta text-ink-tertiary">
            {c.caption}
          </p>
        </motion.div>
      </motion.div>
    </section>
  );
}

function ScreenShell({
  children,
  reduce,
}: {
  children: ReactNode;
  reduce: boolean;
}) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full flex-col bg-paper px-4 pt-10 pb-4"
    >
      {children}
    </motion.div>
  );
}

function RingScreen({ reduce }: { reduce: boolean }) {
  return (
    <ScreenShell reduce={reduce}>
      <p className="text-center text-[10px] font-medium tracking-[0.14em] text-ink-tertiary uppercase">
        Incoming
      </p>
      <div className="flex flex-1 flex-col items-center justify-center">
        <motion.div
          animate={
            reduce
              ? undefined
              : {
                  scale: [1, 1.06, 1],
                  rotate: [0, -3, 3, -2, 0],
                }
          }
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
          className="flex size-20 items-center justify-center rounded-full bg-signal text-paper shadow-[0_16px_32px_-18px_rgba(13,92,94,0.7)]"
        >
          <Phone className="size-8" strokeWidth={1.75} />
        </motion.div>
        <p className="mt-5 font-heading text-subhead text-ink">Mend</p>
        <p className="mt-1 text-meta text-ink-secondary">Morning check-in</p>
        <div className="mt-6 flex items-end gap-1">
          {[0.4, 0.75, 1, 0.55, 0.85, 0.45].map((h, i) => (
            <motion.span
              key={i}
              className="w-1.5 rounded-full bg-signal"
              animate={
                reduce
                  ? { height: 12 + h * 16 }
                  : { height: [8, 12 + h * 20, 8] }
              }
              transition={{
                duration: 0.7,
                repeat: Infinity,
                delay: i * 0.08,
                ease: "easeInOut",
              }}
              style={{ height: 12 + h * 16 }}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-full bg-wash py-2.5 text-center text-meta font-medium text-ink-secondary">
          Decline
        </div>
        <div className="rounded-full bg-severity-green-fg py-2.5 text-center text-meta font-medium text-paper">
          Answer
        </div>
      </div>
    </ScreenShell>
  );
}

function TalkScreen({ reduce }: { reduce: boolean }) {
  return (
    <ScreenShell reduce={reduce}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-medium tracking-[0.12em] text-ink-tertiary uppercase">
            On the call
          </p>
          <p className="mt-0.5 font-heading text-label text-ink">Margaret</p>
        </div>
        <span className="rounded-full border border-severity-green-border bg-severity-green-bg px-2 py-0.5 text-[10px] font-medium text-severity-green-fg">
          Live
        </span>
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-2.5 overflow-hidden">
        {[
          {
            who: "mend",
            text: "Any shortness of breath when you stood up this morning?",
            delay: 0.1,
          },
          {
            who: "patient",
            text: "A little — nothing like yesterday.",
            delay: 0.35,
          },
          {
            who: "mend",
            text: "I’m listening for how your voice sounds today, not just the words.",
            delay: 0.6,
          },
        ].map((msg) => (
          <motion.p
            key={msg.text}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: msg.delay }}
            className={`max-w-[92%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
              msg.who === "mend"
                ? "rounded-tl-md bg-wash text-ink-secondary"
                : "ml-auto rounded-tr-md border border-line bg-raised text-ink"
            }`}
          >
            {msg.who === "mend" ? (
              <span className="font-medium text-ink">Mend — </span>
            ) : null}
            {msg.text}
          </motion.p>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-wash px-3 py-2">
        <motion.span
          className="size-2 rounded-full bg-signal"
          animate={reduce ? undefined : { opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.1, repeat: Infinity }}
        />
        <p className="text-meta text-ink-secondary">Capturing voice for analysis…</p>
      </div>
    </ScreenShell>
  );
}

function BiomarkerScreen({ reduce }: { reduce: boolean }) {
  const rows = [
    { label: "Respiratory", level: "Moderate" as const, severity: "amber" as const },
    { label: "Cognitive", level: "Low" as const, severity: "green" as const },
  ];

  return (
    <ScreenShell reduce={reduce}>
      <div>
        <p className="text-[10px] font-medium tracking-[0.12em] text-signal uppercase">
          Voice biomarkers
        </p>
        <p className="mt-1 font-heading text-subhead text-ink">From this call</p>
        <p className="mt-1 text-meta text-ink-secondary">
          Respiratory and cognitive signal — clinician chart only.
        </p>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        className="mt-4 rounded-xl border border-line bg-wash px-3 py-2.5"
      >
        <div className="flex items-center gap-2">
          <motion.span
            className="size-2 rounded-full bg-signal"
            animate={reduce ? undefined : { scale: [1, 1.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
          <p className="text-label font-medium text-ink">Status: Ready</p>
        </div>
        <p className="mt-1 text-meta text-ink-secondary">
          Analysis complete. Levels feed the chart — they do not choose red alone.
        </p>
      </motion.div>

      <div className="mt-3 flex-1 space-y-0">
        {rows.map((row, i) => (
          <motion.div
            key={row.label}
            initial={reduce ? false : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 + i * 0.2 }}
            className="flex items-center justify-between gap-2 border-b border-line py-3 last:border-0"
          >
            <p className="text-meta text-ink-secondary">{row.label}</p>
            <SeverityChip level={row.severity} label={row.level} size="sm" />
          </motion.div>
        ))}
      </div>

      <p className="numeric mt-auto pt-2 text-center text-[11px] text-ink-tertiary">
        Quality fair · overall moderate · from voice call
      </p>
    </ScreenShell>
  );
}
