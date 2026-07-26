"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  FileText,
  Phone,
  Shield,
  ShieldCheck,
  Users,
  Watch,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MendMark } from "@/app/components/brand/MendMark";
import { SeverityChip } from "@/components/ui/severity-chip";
import { landingCopy } from "./copy";
import { useLandingMotion } from "./motion";

const BEAT_ICONS = [Phone, Shield, Users] as const;

/**
 * Interactive how-it-works — click a beat to spotlight it; right panel shows
 * a literal product preview for that beat (not a wireframe card).
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
        <motion.p variants={fadeUp} className="prose-support mt-3">
          {c.support}
        </motion.p>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] lg:gap-6">
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
            className="relative min-h-[420px] overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_28px_60px_-36px_rgba(28,25,23,0.42)] sm:min-h-[460px]"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_0%,var(--color-wash-strong)_0%,transparent_50%),radial-gradient(ellipse_at_100%_90%,var(--color-severity-red-bg)_0%,transparent_40%)]"
            />
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={reduce ? false : { opacity: 0, scale: 0.97, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.98, y: -8 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 flex flex-col"
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

/** Literal /call-style live check-in frame. */
function PreviewCall({ reduce }: { reduce: boolean }) {
  const [bpm, setBpm] = useState(118);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setBpm((b) =>
        Math.min(126, Math.max(114, b + (Math.random() > 0.5 ? 1 : -1))),
      );
    }, 700);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <div className="relative flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <MendMark size="sm" />
          <div>
            <p className="text-meta tracking-wide text-ink-tertiary uppercase">
              Live call
            </p>
            <p className="font-heading text-label text-ink">Margaret · on the line</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-severity-red-border bg-severity-red-bg px-2.5 py-1 text-meta font-medium text-severity-red-fg">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-severity-red-fg opacity-40" />
            <span className="relative inline-flex size-1.5 rounded-full bg-severity-red-fg" />
          </span>
          Live
        </span>
      </div>

      <div className="mt-4 grid min-h-0 flex-1 gap-3 sm:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col rounded-xl border border-line bg-[linear-gradient(180deg,var(--color-wash)_0%,var(--color-raised)_45%)] p-3.5">
          <p className="text-meta tracking-wide text-ink-tertiary uppercase">
            Transcript
          </p>
          <div className="mt-3 flex flex-1 flex-col gap-2.5">
            <motion.p
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="max-w-[94%] rounded-2xl rounded-tl-md bg-wash px-3 py-2.5 text-label text-ink-secondary"
            >
              <span className="font-medium text-ink">Mend — </span>
              How did you sleep last night?
            </motion.p>
            <motion.p
              initial={reduce ? false : { opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="ml-auto max-w-[90%] rounded-2xl rounded-tr-md border border-line bg-paper px-3 py-2.5 text-label text-ink"
            >
              Pretty well — up once with the walker.
            </motion.p>
            <motion.p
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="max-w-[92%] rounded-2xl rounded-tl-md bg-wash px-3 py-2.5 text-label text-ink-secondary"
            >
              <span className="font-medium text-ink">Mend — </span>
              Any shortness of breath when you stood up?
            </motion.p>
            <motion.p
              initial={reduce ? false : { opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 }}
              className="ml-auto max-w-[88%] rounded-2xl rounded-tr-md border border-line bg-paper px-3 py-2.5 text-label text-ink"
            >
              A little — nothing like yesterday.
            </motion.p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="mx-auto w-full max-w-[160px] rounded-[1.4rem] bg-ink p-[6px] sm:mx-0 sm:max-w-none">
            <div className="relative overflow-hidden rounded-[1.1rem] bg-paper px-3 pt-6 pb-3">
              <div className="absolute top-1.5 left-1/2 h-3 w-10 -translate-x-1/2 rounded-full bg-ink" />
              <p className="text-[9px] font-medium tracking-[0.12em] text-ink-tertiary uppercase">
                Patient phone
              </p>
              <p className="pt-2 font-heading text-[13px] leading-snug text-ink">
                Mend is calling…
              </p>
              <div className="mt-3 flex items-end gap-1">
                <motion.p
                  key={bpm}
                  initial={reduce ? false : { opacity: 0.5, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="numeric text-3xl leading-none text-ink"
                >
                  {bpm}
                </motion.p>
                <span className="pb-0.5 text-[10px] text-ink-tertiary">bpm</span>
              </div>
              <p className="mt-2 text-[10px] text-ink-secondary">
                Watch HR streaming during the call.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-1">
            {[
              ["HR", String(bpm), "bpm"],
              ["SpO₂", "94", "%"],
              ["Pain", "4", "/10"],
            ].map(([k, v, u]) => (
              <div
                key={k}
                className="rounded-lg border border-line bg-raised px-2.5 py-2"
              >
                <p className="text-[10px] text-ink-tertiary">{k}</p>
                <p className="numeric text-label font-medium text-ink">
                  {v}
                  <span className="ml-1 text-meta font-normal text-ink-tertiary">
                    {u}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="pt-3 text-meta text-ink-tertiary">
        One calm call. No app to open.
      </p>
    </div>
  );
}

/** Literal engine / vignette panel — inputs in, rules fire, level locks. */
function PreviewEngine({ reduce }: { reduce: boolean }) {
  const inputs = [
    { icon: Watch, label: "Watch HR · 122", delay: 0.05 },
    { icon: FileText, label: "Kardia · sinus tach", delay: 0.18 },
    { icon: Phone, label: "Call · breathless", delay: 0.3 },
  ];
  const rules = [
    { id: "pe_breathless_hr", label: "Breathless + elevated HR", delay: 0.5 },
    { id: "pe_chest_pain", label: "Chest pain early post-op", delay: 0.75 },
  ];

  return (
    <div className="relative flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <p className="text-meta tracking-wide text-ink-tertiary uppercase">
            Rule engine
          </p>
          <p className="mt-0.5 font-heading text-subhead text-ink">
            Escalation · PE pathway
          </p>
        </div>
        <motion.div
          initial={reduce ? false : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", delay: 1.05, stiffness: 260, damping: 18 }}
        >
          <SeverityChip level="red" size="md" />
        </motion.div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {inputs.map((input) => {
          const Icon = input.icon;
          return (
            <motion.span
              key={input.label}
              initial={reduce ? false : { opacity: 0, y: -10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: input.delay, duration: 0.35 }}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-1 text-meta text-ink shadow-sm"
            >
              <Icon className="size-3.5 text-ink-secondary" strokeWidth={2} />
              {input.label}
            </motion.span>
          );
        })}
      </div>

      <ul className="mt-4 space-y-2">
        {rules.map((rule, i) => (
          <motion.li
            key={rule.id}
            initial={reduce ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: rule.delay, duration: 0.35 }}
            className="flex items-center gap-3 rounded-xl border border-severity-red-border bg-severity-red-bg px-3.5 py-2.5"
          >
            <motion.span
              initial={reduce ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: rule.delay + 0.12, type: "spring" }}
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-severity-red-fg text-meta font-medium text-paper"
            >
              {i + 1}
            </motion.span>
            <div className="min-w-0 flex-1">
              <p className="text-label font-medium text-ink">{rule.label}</p>
              <p className="numeric text-meta text-ink-tertiary">{rule.id}</p>
            </div>
            <span className="text-meta font-medium text-severity-red-fg">Fired</span>
          </motion.li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
        <div className="flex items-center gap-2 text-label text-ink">
          <ShieldCheck className="size-4 text-severity-green-fg" strokeWidth={2} />
          Fail-safe on
        </div>
        <p className="text-meta text-ink-tertiary">
          Level locked · not by the LLM
        </p>
      </div>
    </div>
  );
}

/** Three seats, one red — family phone, patient phone, clinician chart. */
function PreviewTruth({ reduce }: { reduce: boolean }) {
  return (
    <div className="relative flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <p className="text-meta tracking-wide text-ink-tertiary uppercase">
            Same clinical truth
          </p>
          <p className="mt-0.5 font-heading text-subhead text-ink">
            One decision · three seats
          </p>
        </div>
        <SeverityChip level="red" size="sm" />
      </div>

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-2.5 sm:grid-cols-3">
        {/* Family */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mx-auto flex w-full max-w-[180px] flex-col rounded-[1.35rem] bg-ink p-[6px] sm:mx-0 sm:max-w-none"
        >
          <div className="relative flex flex-1 flex-col overflow-hidden rounded-[1.05rem] bg-paper px-2.5 pt-6 pb-2.5">
            <div className="absolute top-1.5 left-1/2 h-3 w-10 -translate-x-1/2 rounded-full bg-ink" />
            <p className="text-[9px] font-medium tracking-[0.12em] text-ink-tertiary uppercase">
              Family
            </p>
            <div className="pt-2">
              <SeverityChip level="red" size="sm" />
            </div>
            <p className="pt-2 font-heading text-[13px] leading-snug text-ink">
              Drive over today.
            </p>
            <div className="mt-auto flex h-8 items-center justify-center gap-1 rounded-lg bg-ink text-[10px] font-medium text-paper">
              <Phone className="size-3" strokeWidth={2} />
              Call Mom
            </div>
          </div>
        </motion.div>

        {/* Patient */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="mx-auto flex w-full max-w-[180px] flex-col rounded-[1.35rem] bg-ink p-[6px] sm:mx-0 sm:max-w-none"
        >
          <div className="relative flex flex-1 flex-col overflow-hidden rounded-[1.05rem] bg-paper px-2.5 pt-6 pb-2.5">
            <div className="absolute top-1.5 left-1/2 h-3 w-10 -translate-x-1/2 rounded-full bg-ink" />
            <p className="text-[9px] font-medium tracking-[0.12em] text-ink-tertiary uppercase">
              Patient
            </p>
            <div className="pt-2">
              <SeverityChip level="red" size="sm" />
            </div>
            <p className="pt-2 font-heading text-[13px] leading-snug text-ink">
              Call 911 now.
            </p>
            <p className="pt-1 text-[10px] leading-snug text-ink-secondary">
              Mend will stay on the line until help is coming.
            </p>
          </div>
        </motion.div>

        {/* Clinician */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="flex flex-col rounded-xl border border-line bg-raised p-3 shadow-[0_12px_28px_-22px_rgba(28,25,23,0.4)]"
        >
          <div className="flex items-center justify-between gap-1">
            <p className="font-heading text-label text-ink">Chart</p>
            <span className="text-[10px] text-ink-tertiary">Overview</span>
          </div>
          <p className="numeric pt-1 text-meta text-ink-tertiary">
            Margaret · Day 4
          </p>
          <div className="mt-2 rounded-lg border border-severity-red-border bg-severity-red-bg p-2.5">
            <SeverityChip level="red" size="sm" />
            <p className="pt-1.5 text-meta leading-snug text-ink">
              Suspected PE — escalate now.
            </p>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-1.5 pt-2">
            <div className="rounded-md bg-wash px-2 py-1.5">
              <p className="text-[9px] text-ink-tertiary">HR</p>
              <p className="numeric text-meta font-medium text-ink">122</p>
            </div>
            <div className="rounded-md bg-wash px-2 py-1.5">
              <p className="text-[9px] text-ink-tertiary">SpO₂</p>
              <p className="numeric text-meta font-medium text-ink">91%</p>
            </div>
          </div>
        </motion.div>
      </div>

      <p className="pt-3 text-center text-meta text-ink-tertiary">
        Same engine verdict on every surface — no rewritten story.
      </p>
    </div>
  );
}
