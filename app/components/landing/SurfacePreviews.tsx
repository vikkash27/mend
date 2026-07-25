"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Phone, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { MendLogo } from "@/app/components/brand/MendLogo";
import { MendMark } from "@/app/components/brand/MendMark";
import { PhoneFrame } from "@/app/components/device/PhoneFrame";
import { SeverityChip } from "@/components/ui/severity-chip";
import { useLandingMotion } from "./motion";

/**
 * Marketing walkthroughs of the three seats — wide clinician hub on top,
 * family/patient phones underneath as secondary seats. Simulated taps; deep links below.
 */
export function SurfacePreviews() {
  const { reduce, fadeUp } = useLandingMotion();

  return (
    <motion.div variants={fadeUp} className="mt-12 flex flex-col gap-14">
      <PreviewBlock
        href="/clinician"
        label="Clinician hub"
        note="Worklist, chart, and live check-in"
        align="start"
      >
        <LaptopFrame>
          <ClinicianWalkthrough reduce={reduce} />
        </LaptopFrame>
      </PreviewBlock>

      <div className="grid items-start justify-items-center gap-10 sm:grid-cols-2 sm:gap-8">
        <PreviewBlock href="/family" label="Family" note="Caregiver morning update">
          <PhoneFrame preview>
            <FamilyWalkthrough reduce={reduce} />
          </PhoneFrame>
        </PreviewBlock>
        <PreviewBlock href="/patient" label="Patient" note="Request a check-in call">
          <PhoneFrame preview>
            <PatientWalkthrough reduce={reduce} />
          </PhoneFrame>
        </PreviewBlock>
      </div>
    </motion.div>
  );
}

function PreviewBlock({
  href,
  label,
  note,
  children,
  align = "center",
}: {
  href: string;
  label: string;
  note: string;
  children: ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div
      className={`flex w-full flex-col gap-4 ${
        align === "start" ? "items-stretch" : "items-center"
      }`}
    >
      {children}
      <Link
        href={href}
        className={`group transition-opacity hover:opacity-80 ${
          align === "start" ? "text-left" : "text-center"
        }`}
      >
        <p className="font-heading text-subhead text-ink group-hover:text-ink-secondary">
          {label}
        </p>
        <p className="mt-1 text-label text-ink-tertiary">{note}</p>
      </Link>
    </div>
  );
}

function LaptopFrame({ children }: { children: ReactNode }) {
  return (
    <div className="w-full">
      <div className="rounded-t-2xl border border-b-0 border-line-strong bg-ink px-4 pt-3 pb-0 sm:px-5">
        <div className="mx-auto mb-2.5 h-1.5 w-20 rounded-full bg-ink-secondary/40" />
        <div className="h-[min(520px,58vh)] overflow-hidden rounded-t-lg bg-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
          {children}
        </div>
      </div>
      <div className="h-3.5 rounded-b-lg border border-t-0 border-line-strong bg-wash-strong" />
    </div>
  );
}

/** Soft finger/cursor that lands on a control during the walkthrough. */
function TapHint({
  show,
  className,
}: {
  show: boolean;
  className?: string;
}) {
  if (!show) return null;
  return (
    <motion.span
      aria-hidden="true"
      className={`pointer-events-none absolute z-30 size-9 rounded-full border-2 border-ink/30 bg-ink/15 shadow-[0_0_0_6px_rgba(28,25,23,0.06)] ${className ?? ""}`}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1, 0.92, 1.15] }}
      transition={{ duration: 1.1, times: [0, 0.25, 0.7, 1], ease: "easeOut" }}
    />
  );
}

function useWalkStep(stepCount: number, dwellMs: number, reduce: boolean) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % stepCount);
    }, dwellMs);
    return () => window.clearInterval(id);
  }, [reduce, stepCount, dwellMs]);
  return reduce ? 0 : step;
}

const CHECKIN_DAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;

/** Mirrors /family: calm green → urgent red with Call Mom / Forward taps. */
function FamilyWalkthrough({ reduce }: { reduce: boolean }) {
  // 0 calm · 1 tap Call · 2 urgent · 3 tap Forward · 4 urgent held
  const step = useWalkStep(5, 2200, reduce);
  const urgent = step >= 2;
  const tapCall = step === 1;
  const tapForward = step === 3;

  return (
    <div className="relative flex h-full flex-col bg-paper px-5 pt-10 pb-5">
      <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.12em] text-ink-tertiary uppercase">
        <MendMark size="sm" className="!size-3.5 text-ink" />
        Mend · Recovery updates
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={urgent ? "urgent" : "well"}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.35 }}
          className="pt-5"
        >
          <SeverityChip level={urgent ? "red" : "green"} size="sm" />
          <p className="pt-4 font-heading text-[1.15rem] leading-snug text-ink">
            {urgent ? "Drive over today." : "Mom is doing fine."}
          </p>
          <p className="pt-2 text-[12px] leading-relaxed text-ink-secondary">
            Mend called her today at 8:14 AM.
          </p>
          {urgent ? (
            <p className="pt-3 font-serif text-[13px] leading-relaxed text-ink">
              Her breathing and heart rate together can be a sign of a blood clot
              in her lung. Mend asked her to get urgent help.
            </p>
          ) : (
            <p className="pt-3 font-serif text-[13px] leading-relaxed text-ink">
              She said the pain keeps easing, she slept through the night, and
              she&apos;s been up with her walker.
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="relative mt-auto space-y-2 pt-6">
        {urgent ? (
          <>
            <div className="relative">
              <motion.div
                animate={
                  tapCall
                    ? { scale: 0.96, backgroundColor: "#292524" }
                    : { scale: 1 }
                }
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-ink text-[13px] font-medium text-paper"
              >
                <Phone className="size-3.5" strokeWidth={2} />
                Call Mom
              </motion.div>
              <TapHint show={tapCall} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="relative">
              <motion.div
                animate={tapForward ? { scale: 0.97 } : { scale: 1 }}
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-line-strong bg-raised text-[13px] font-medium text-ink"
              >
                <Send className="size-3.5" strokeWidth={2} />
                Forward the care summary
              </motion.div>
              <TapHint
                show={tapForward}
                className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              />
            </div>
          </>
        ) : (
          <div className="relative">
            <motion.div
              animate={tapCall ? { scale: 0.96 } : { scale: 1 }}
              className="flex h-10 items-center justify-center gap-2 rounded-xl bg-ink text-[13px] font-medium text-paper"
            >
              <Phone className="size-3.5" strokeWidth={2} />
              Call Mom
            </motion.div>
            <TapHint show={tapCall} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
        )}

        <div className="flex justify-between pt-4">
          {CHECKIN_DAYS.map((letter, i) => (
            <div key={`${letter}-${i}`} className="flex flex-col items-center gap-1">
              <span
                className={`flex size-6 items-center justify-center rounded-full ${
                  i < 6
                    ? "bg-wash-strong text-ink-secondary"
                    : "ring-1 ring-line-strong ring-offset-1 ring-offset-paper bg-wash-strong text-ink-secondary"
                }`}
              >
                <Check className="size-2.5" strokeWidth={2.5} />
              </span>
              <span className="text-[9px] text-ink-tertiary">{letter}</span>
            </div>
          ))}
        </div>
        <p className="pt-1 text-[11px] text-ink-tertiary">
          Mend calls her every morning.
        </p>
      </div>
    </div>
  );
}

/** Mirrors /patient: request call → pending → connected banner. */
function PatientWalkthrough({ reduce }: { reduce: boolean }) {
  // 0 idle · 1 hover/tap · 2 pending · 3 ok · 4 idle settle
  const step = useWalkStep(5, 2000, reduce);
  const pending = step === 2;
  const ok = step === 3;
  const tapping = step === 1;

  return (
    <div className="relative flex h-full flex-col bg-paper px-5 pt-10 pb-5">
      <p className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.12em] text-ink-tertiary uppercase">
        <MendMark size="sm" className="!size-3.5 text-ink" />
        Mend · Your recovery
      </p>

      <p className="pt-5 text-[12px] text-ink-secondary">
        Margaret · day 4 after hip hemiarthroplasty
      </p>
      <div className="pt-4">
        <SeverityChip level="green" size="sm" />
      </div>
      <p className="pt-4 font-heading text-[1.15rem] leading-snug text-ink">
        You&apos;re doing well today.
      </p>
      <p className="pt-2 font-serif text-[13px] leading-relaxed text-ink">
        Your pain has been easing, you slept through the night, and you&apos;ve
        been up with your walker.
      </p>

      <div className="relative mt-auto space-y-2 pt-6">
        <div className="relative">
          <motion.div
            animate={
              tapping || pending
                ? { scale: 0.97, opacity: pending ? 0.85 : 1 }
                : { scale: 1, opacity: 1 }
            }
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-ink text-[13px] font-medium text-paper"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Phone className="size-3.5" strokeWidth={2} />
            )}
            {pending ? "Calling you now…" : "Request a check-in call"}
          </motion.div>
          <TapHint show={tapping} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="flex h-10 items-center justify-center rounded-xl border border-line-strong bg-raised text-[13px] font-medium text-ink">
          Open family updates
        </div>

        <AnimatePresence>
          {ok ? (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-line bg-wash px-3 py-2.5 text-[12px] leading-relaxed text-ink"
            >
              Mend is calling you now. Answer on speaker — then Mend speaks.
            </motion.p>
          ) : null}
        </AnimatePresence>

        <p className="pt-2 text-[11px] text-ink-tertiary">
          Mend can call you now when you ask, and every morning.
        </p>
      </div>
    </div>
  );
}

const HUB_ROWS = [
  {
    id: "margaret",
    name: "Margaret Ellison",
    meta: "78 · Daughter",
    procedure: "Hip hemiarthroplasty",
    day: 4,
    level: "red" as const,
    condition: "Suspected pulmonary embolism",
  },
  {
    id: "doris",
    name: "Doris Whitfield",
    meta: "81 · Son",
    procedure: "TKA",
    day: 9,
    level: "amber" as const,
    condition: "HR drift",
  },
  {
    id: "eileen",
    name: "Eileen Prosser",
    meta: "74 · Niece",
    procedure: "THA",
    day: 6,
    level: "green" as const,
    condition: "No active finding",
  },
] as const;

/**
 * Hub walkthrough sized for the wide laptop frame:
 * worklist select → chart → Call now → live session.
 * Patient names match the seeded roster.
 */
function ClinicianWalkthrough({ reduce }: { reduce: boolean }) {
  // 0 worklist · 1 select Margaret · 2 chart · 3 tap Call · 4 live session
  const step = useWalkStep(5, 2400, reduce);
  const selected = step >= 1 ? "margaret" : null;
  const showChart = step >= 2 && step < 4;
  const tapCall = step === 3;
  const live = step >= 4;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-paper">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-3 text-ink">
          <MendLogo variant="lockup" size="sm" wordmarkClassName="!text-base" />
          <span className="eyebrow">Clinician</span>
        </div>
        <div className="flex gap-1">
          <span className="rounded-md bg-wash-strong px-3 py-1 text-meta font-medium text-ink">
            Hub
          </span>
          <span className="rounded-md px-3 py-1 text-meta text-ink-secondary">
            Rule engine
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {live ? (
          <motion.div
            key="live"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col px-5 py-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-heading text-subhead text-ink">Live check-in</p>
                <p className="pt-0.5 text-meta text-ink-tertiary">
                  Margaret · embedded
                </p>
              </div>
              <span className="rounded-full border border-severity-red-border bg-severity-red-bg px-3 py-1 text-meta font-medium text-severity-red-fg">
                In progress
              </span>
            </div>
            <div className="mt-4 flex flex-1 flex-col rounded-xl border border-line bg-wash/40 p-4">
              <p className="text-meta tracking-wide text-ink-tertiary uppercase">
                Transcript
              </p>
              <div className="mt-3 space-y-2.5">
                <p className="rounded-lg bg-raised px-3 py-2.5 text-label text-ink-secondary">
                  <span className="font-medium text-ink">Mend — </span>
                  Any shortness of breath when you stood up this morning?
                </p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-lg border border-line bg-paper px-3 py-2.5 text-label text-ink"
                >
                  <span className="font-medium">Margaret — </span>
                  A little — nothing like yesterday.
                </motion.p>
              </div>
              <div className="mt-auto grid grid-cols-3 gap-4 border-t border-line pt-4">
                {[
                  ["HR", "122", "bpm"],
                  ["SpO₂", "94", "%"],
                  ["Level", "Red", ""],
                ].map(([k, v, u]) => (
                  <div key={k}>
                    <p className="text-meta text-ink-tertiary">{k}</p>
                    <p className="numeric mt-1 text-body text-ink">
                      {v}
                      {u ? (
                        <span className="ml-1 text-meta text-ink-tertiary">{u}</span>
                      ) : null}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="hub"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col gap-3 overflow-hidden px-5 py-4"
          >
            <div>
              <p className="font-heading text-subhead text-ink">Clinician hub</p>
              <p className="pt-0.5 text-meta text-ink-tertiary">
                Worklist, chart, and live check-in
              </p>
            </div>

            <div className="relative flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-raised px-4 py-3">
              <div>
                <p className="text-label font-medium text-ink">Call now</p>
                <p className="text-meta text-ink-tertiary">Outbound check-in</p>
              </div>
              <motion.div
                animate={tapCall ? { scale: 0.96 } : { scale: 1 }}
                className="flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-label font-medium text-paper"
              >
                {tapCall ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Phone className="size-4" />
                )}
                Call now
              </motion.div>
              <TapHint show={tapCall} className="top-1/2 right-10 -translate-y-1/2" />
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-xl border border-line bg-raised">
                <p className="border-b border-line bg-wash px-3 py-2 text-meta font-medium tracking-wide text-ink-tertiary uppercase">
                  Patients · worst first
                </p>
                <ul>
                  {HUB_ROWS.map((row) => {
                    const isSelected = selected === row.id;
                    const selecting = step === 1 && row.id === "margaret";
                    return (
                      <li
                        key={row.id}
                        className="relative border-b border-line last:border-0"
                      >
                        <motion.div
                          animate={
                            selecting || isSelected
                              ? { backgroundColor: "var(--color-wash)" }
                              : { backgroundColor: "transparent" }
                          }
                          className="px-3 py-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-label font-medium text-ink">
                                {row.name}
                              </p>
                              <p className="numeric pt-0.5 text-meta text-ink-tertiary">
                                {row.meta} · {row.procedure} · day {row.day}
                              </p>
                              <p className="pt-1 text-meta text-ink-secondary">
                                {row.condition}
                              </p>
                            </div>
                            <SeverityChip level={row.level} size="sm" />
                          </div>
                        </motion.div>
                        <TapHint
                          show={selecting}
                          className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="overflow-hidden rounded-xl border border-line bg-raised p-4">
                <AnimatePresence mode="wait">
                  {showChart || selected ? (
                    <motion.div
                      key="chart"
                      initial={reduce ? false : { opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex h-full flex-col gap-3"
                    >
                      <div>
                        <p className="font-heading text-subhead text-ink">
                          Margaret Ellison
                        </p>
                        <p className="numeric pt-1 text-meta text-ink-tertiary">
                          78 · Hip hemiarthroplasty · Day 4 · Acute
                        </p>
                      </div>
                      <div className="rounded-xl border border-severity-red-border bg-severity-red-bg p-3.5">
                        <SeverityChip level="red" size="sm" />
                        <p className="pt-2 font-serif text-label leading-snug text-ink">
                          Suspected pulmonary embolism — escalate now.
                        </p>
                      </div>
                      <p className="numeric text-meta text-ink-tertiary">
                        Check-in 8:14 AM · fired pe_breathless_hr
                      </p>
                      <div className="mt-auto flex h-10 items-center justify-center rounded-md border border-line text-label text-ink-secondary">
                        Open full chart
                      </div>
                    </motion.div>
                  ) : (
                    <motion.p
                      key="empty"
                      className="flex h-full items-center justify-center text-label text-ink-tertiary"
                    >
                      Select a row for the chart summary.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
