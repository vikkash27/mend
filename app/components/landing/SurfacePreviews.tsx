"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Loader2,
  Phone,
  Send,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { MendLogo } from "@/app/components/brand/MendLogo";
import { MendMark } from "@/app/components/brand/MendMark";
import { PhoneFrame } from "@/app/components/device/PhoneFrame";
import { SeverityChip } from "@/components/ui/severity-chip";
import { useLandingMotion } from "./motion";

/**
 * Marketing walkthroughs of the three seats — wide clinician product on top,
 * family/patient phones underneath. Literal feature chrome, not wireframes.
 */
export function SurfacePreviews() {
  const { reduce, fadeUp } = useLandingMotion();

  return (
    <motion.div variants={fadeUp} className="mt-14 flex flex-col gap-16">
      <PreviewBlock
        href="/clinician"
        label="Clinician"
        note="Hub → patients → chart → live call"
        align="start"
      >
        <PreviewStage>
          <LaptopFrame>
            <ClinicianWalkthrough reduce={reduce} />
          </LaptopFrame>
        </PreviewStage>
      </PreviewBlock>

      <div className="grid items-start justify-items-center gap-12 sm:grid-cols-2 sm:gap-10">
        <PreviewBlock href="/family" label="Family" note="Caregiver morning update">
          <PreviewStage compact>
            <PhoneFrame preview>
              <FamilyWalkthrough reduce={reduce} />
            </PhoneFrame>
          </PreviewStage>
        </PreviewBlock>
        <PreviewBlock href="/patient" label="Patient" note="Request a check-in call">
          <PreviewStage compact>
            <PhoneFrame preview>
              <PatientWalkthrough reduce={reduce} />
            </PhoneFrame>
          </PreviewStage>
        </PreviewBlock>
      </div>
    </motion.div>
  );
}

function PreviewStage({
  children,
  compact,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-3xl border border-line ${
        compact ? "px-4 py-8 sm:px-8 sm:py-10" : "px-3 py-6 sm:px-8 sm:py-10"
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,var(--color-wash-strong)_0%,transparent_50%),radial-gradient(ellipse_at_90%_100%,var(--color-severity-red-bg)_0%,transparent_42%),linear-gradient(180deg,var(--color-wash)_0%,var(--color-paper)_55%,var(--color-wash)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-line-strong to-transparent"
      />
      <div className="relative">{children}</div>
    </div>
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
      className={`flex w-full flex-col gap-5 ${
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
        <p className="mt-2 text-meta font-medium text-ink underline decoration-line-strong underline-offset-4 group-hover:decoration-ink">
          Open live surface →
        </p>
      </Link>
    </div>
  );
}

function LaptopFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="overflow-hidden rounded-t-[1.15rem] border border-b-0 border-ink/80 bg-gradient-to-b from-ink to-[#2a2522] px-3 pt-3 shadow-[0_32px_80px_-40px_rgba(28,25,23,0.55)] sm:px-4">
        <div className="mb-2.5 flex items-center gap-2 px-1">
          <span className="size-2 rounded-full bg-ink-secondary/50" />
          <span className="size-2 rounded-full bg-ink-secondary/40" />
          <span className="size-2 rounded-full bg-ink-secondary/30" />
          <div className="mx-auto h-5 w-[min(100%,18rem)] rounded-md bg-ink-secondary/25 ring-1 ring-ink-secondary/20" />
          <span className="w-8" />
        </div>
        <div className="h-[min(560px,62vh)] overflow-hidden rounded-t-md bg-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
          {children}
        </div>
      </div>
      <div className="relative h-3 rounded-b-xl border border-t-0 border-line-strong bg-gradient-to-b from-wash-strong to-line">
        <div className="absolute inset-x-[28%] top-0 h-px bg-line-strong/80" />
      </div>
      <div className="mx-auto mt-1 h-1 w-[42%] rounded-full bg-ink/10" />
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

function StatusBar({ time = "8:14" }: { time?: string }) {
  return (
    <div className="flex items-center justify-between px-1 pb-2 text-[10px] font-medium text-ink">
      <span className="numeric">{time}</span>
      <span className="flex items-center gap-1 text-ink-tertiary">
        <span className="h-1.5 w-3.5 rounded-[1px] border border-ink/40">
          <span className="block h-full w-2/3 bg-ink/50" />
        </span>
      </span>
    </div>
  );
}

const CHECKIN_DAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;

/** Mirrors /family: calm green → urgent red with Call Mom / Forward taps. */
function FamilyWalkthrough({ reduce }: { reduce: boolean }) {
  const step = useWalkStep(5, 2200, reduce);
  const urgent = step >= 2;
  const tapCall = step === 1;
  const tapForward = step === 3;

  return (
    <div className="relative flex h-full flex-col bg-[linear-gradient(180deg,var(--color-wash)_0%,var(--color-paper)_28%)] px-5 pt-11 pb-5">
      <StatusBar />
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
          <p className="pt-4 font-heading text-[1.2rem] leading-snug text-ink">
            {urgent ? "Drive over today." : "Mom is doing fine."}
          </p>
          <p className="pt-2 text-[12px] leading-relaxed text-ink-secondary">
            Mend called her today at 8:14 AM.
          </p>
          <div
            className={`mt-4 rounded-2xl border p-3.5 ${
              urgent
                ? "border-severity-red-border bg-severity-red-bg"
                : "border-line bg-raised shadow-[0_8px_24px_-18px_rgba(28,25,23,0.35)]"
            }`}
          >
            <p className="font-serif text-[13px] leading-relaxed text-ink">
              {urgent
                ? "Her breathing and heart rate together can be a sign of a blood clot in her lung. Mend asked her to get urgent help."
                : "She said the pain keeps easing, she slept through the night, and she’s been up with her walker."}
            </p>
          </div>
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
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-ink text-[13px] font-medium text-paper"
              >
                <Phone className="size-3.5" strokeWidth={2} />
                Call Mom
              </motion.div>
              <TapHint show={tapCall} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="relative">
              <motion.div
                animate={tapForward ? { scale: 0.97 } : { scale: 1 }}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-raised text-[13px] font-medium text-ink"
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
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-ink text-[13px] font-medium text-paper"
            >
              <Phone className="size-3.5" strokeWidth={2} />
              Call Mom
            </motion.div>
            <TapHint show={tapCall} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
        )}

        <div className="flex justify-between rounded-xl border border-line bg-raised/80 px-2 py-3 pt-3">
          {CHECKIN_DAYS.map((letter, i) => (
            <div key={`${letter}-${i}`} className="flex flex-col items-center gap-1">
              <span
                className={`flex size-6 items-center justify-center rounded-full ${
                  i < 6
                    ? "bg-wash-strong text-ink-secondary"
                    : "bg-wash-strong text-ink-secondary ring-1 ring-line-strong ring-offset-1 ring-offset-paper"
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
  const step = useWalkStep(5, 2000, reduce);
  const pending = step === 2;
  const ok = step === 3;
  const tapping = step === 1;

  return (
    <div className="relative flex h-full flex-col bg-[linear-gradient(180deg,var(--color-wash)_0%,var(--color-paper)_28%)] px-5 pt-11 pb-5">
      <StatusBar time="8:16" />
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
      <p className="pt-4 font-heading text-[1.2rem] leading-snug text-ink">
        You&apos;re doing well today.
      </p>
      <div className="mt-4 rounded-2xl border border-line bg-raised p-3.5 shadow-[0_8px_24px_-18px_rgba(28,25,23,0.35)]">
        <p className="font-serif text-[13px] leading-relaxed text-ink">
          Your pain has been easing, you slept through the night, and you&apos;ve
          been up with your walker.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
          {[
            ["HR", "78"],
            ["SpO₂", "97%"],
            ["Pain", "3"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-wash px-2 py-1.5">
              <p className="text-[9px] tracking-wide text-ink-tertiary uppercase">
                {k}
              </p>
              <p className="numeric text-[13px] font-medium text-ink">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mt-auto space-y-2 pt-6">
        <div className="relative">
          <motion.div
            animate={
              tapping || pending
                ? { scale: 0.97, opacity: pending ? 0.85 : 1 }
                : { scale: 1, opacity: 1 }
            }
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-ink text-[13px] font-medium text-paper"
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

        <div className="flex h-11 items-center justify-center rounded-xl border border-line-strong bg-raised text-[13px] font-medium text-ink">
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
      </div>
    </div>
  );
}

const DIRECTORY_ROWS = [
  {
    id: "margaret",
    name: "Margaret Ellison",
    meta: "82 · Hip hemiarthroplasty · Day 4",
    level: "red" as const,
    condition: "Suspected PE",
  },
  {
    id: "doris",
    name: "Doris Whitfield",
    meta: "79 · TKA · Day 9",
    level: "amber" as const,
    condition: "HR drift",
  },
  {
    id: "eileen",
    name: "Eileen Prosser",
    meta: "74 · THA · Day 6",
    level: "green" as const,
    condition: "On track",
  },
  {
    id: "beatrice",
    name: "Beatrice Nkemelu",
    meta: "68 · TKA · Day 12",
    level: "green" as const,
    condition: "On track",
  },
] as const;

const CHART_TABS = [
  "Overview",
  "Readings & trends",
  "Handoff",
  "Billing",
  "Audit",
] as const;

/**
 * Hub → Patients directory → Chart tabs → Call now → Live.
 * Matches the shipped clinician IA.
 */
function ClinicianWalkthrough({ reduce }: { reduce: boolean }) {
  // 0 hub · 1 patients · 2 select row · 3 chart · 4 tap call · 5 live
  const step = useWalkStep(6, 2300, reduce);
  const onHub = step === 0;
  const onPatients = step === 1 || step === 2;
  const selecting = step === 2;
  const onChart = step === 3 || step === 4;
  const tapCall = step === 4;
  const live = step >= 5;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper/95 px-4 py-2.5 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5 text-ink">
          <MendLogo variant="lockup" size="sm" wordmarkClassName="!text-base" />
          <span className="eyebrow">Clinician</span>
          <span className="hidden text-meta text-ink-tertiary sm:inline">
            Ridgeview Orthopedics
          </span>
          {(onChart || live) && (
            <span className="flex items-center gap-1.5 text-meta text-ink-tertiary">
              <span>/</span>
              <span className="text-ink-secondary">Patients</span>
              <span>/</span>
              <span className="font-medium text-ink">Margaret Ellison</span>
            </span>
          )}
          {onPatients && (
            <span className="flex items-center gap-1.5 text-meta text-ink-tertiary">
              <span>/</span>
              <span className="font-medium text-ink">Patients</span>
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {[
            { label: "Hub", on: onHub },
            { label: "Patients", on: onPatients || onChart || live },
            { label: "Rule engine", on: false },
          ].map((item) => (
            <span
              key={item.label}
              className={`rounded-md px-2.5 py-1 text-meta ${
                item.on
                  ? "bg-wash-strong font-medium text-ink ring-1 ring-inset ring-line-strong"
                  : "text-ink-secondary"
              }`}
            >
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {live ? (
          <motion.div
            key="live"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col px-4 py-4 sm:px-5"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-heading text-subhead text-ink">Live check-in</p>
                <p className="pt-0.5 text-meta text-ink-tertiary">
                  Margaret · embedded on chart
                </p>
              </div>
              <span className="rounded-full border border-severity-red-border bg-severity-red-bg px-3 py-1 text-meta font-medium text-severity-red-fg">
                In progress
              </span>
            </div>
            <div className="mt-4 grid min-h-0 flex-1 gap-3 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="flex flex-col rounded-xl border border-line bg-[linear-gradient(180deg,var(--color-wash)_0%,var(--color-raised)_40%)] p-4">
                <p className="text-meta tracking-wide text-ink-tertiary uppercase">
                  Transcript
                </p>
                <div className="mt-3 space-y-2.5">
                  <p className="max-w-[92%] rounded-2xl rounded-tl-md bg-wash px-3 py-2.5 text-label text-ink-secondary">
                    <span className="font-medium text-ink">Mend — </span>
                    Any shortness of breath when you stood up this morning?
                  </p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="ml-auto max-w-[88%] rounded-2xl rounded-tr-md border border-line bg-paper px-3 py-2.5 text-label text-ink"
                  >
                    <span className="font-medium">Margaret — </span>
                    A little — nothing like yesterday.
                  </motion.p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 self-start rounded-xl border border-line bg-raised p-3 lg:grid-cols-1">
                {[
                  ["HR", "122", "bpm", true],
                  ["SpO₂", "91", "%", true],
                  ["Level", "Urgent", "", true],
                ].map(([k, v, u, warn]) => (
                  <div
                    key={String(k)}
                    className={`rounded-lg border px-3 py-2.5 ${
                      warn
                        ? "border-severity-red-border bg-severity-red-bg"
                        : "border-line bg-wash"
                    }`}
                  >
                    <p className="text-meta text-ink-tertiary">{k}</p>
                    <p className="numeric mt-1 text-body font-medium text-ink">
                      {v}
                      {u ? (
                        <span className="ml-1 text-meta font-normal text-ink-tertiary">
                          {u}
                        </span>
                      ) : null}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : onChart ? (
          <motion.div
            key="chart"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col overflow-hidden px-4 py-4 sm:px-5"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className="font-heading text-heading text-ink">
                    Margaret Ellison
                  </p>
                  <SeverityChip level="red" size="sm" />
                </div>
                <p className="numeric pt-1 text-meta text-ink-secondary">
                  82 · Hip hemiarthroplasty · Day 4 · Early protected
                </p>
              </div>
              <div className="relative flex flex-wrap items-center gap-2">
                <span className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-meta text-ink-secondary">
                  <Users className="size-3.5" />
                  All patients
                </span>
                <motion.div
                  animate={tapCall ? { scale: 0.96 } : { scale: 1 }}
                  className="flex min-h-9 items-center gap-2 rounded-md bg-ink px-3.5 text-label font-medium text-paper"
                >
                  {tapCall ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Phone className="size-3.5" />
                  )}
                  Call now
                </motion.div>
                <TapHint show={tapCall} className="top-1/2 right-4 -translate-y-1/2" />
              </div>
            </div>

            <div className="mt-4 flex gap-1 border-b border-line">
              {CHART_TABS.map((tab, i) => (
                <span
                  key={tab}
                  className={`inline-flex min-h-9 items-center border-b-2 px-2.5 text-meta sm:px-3 sm:text-label ${
                    i === 0
                      ? "border-ink font-medium text-ink"
                      : "border-transparent text-ink-secondary"
                  }`}
                >
                  {tab}
                </span>
              ))}
            </div>

            <div className="mt-4 grid min-h-0 flex-1 items-start gap-3 xl:grid-cols-[1.15fr_1fr]">
              <div className="h-fit rounded-xl border border-severity-red-border bg-severity-red-bg p-4">
                <p className="font-heading text-subhead text-severity-red-fg">
                  Suspected pulmonary embolism
                </p>
                <p className="pt-2 font-serif text-label leading-snug text-ink">
                  Call 911 now. This combination can indicate a pulmonary embolism.
                </p>
                <p className="numeric pt-2 text-meta text-ink-secondary">
                  Day 4 check-in · 8:14 AM · fired pe_breathless_hr
                </p>
              </div>
              <div className="rounded-xl border border-line bg-raised p-4 shadow-[0_12px_32px_-24px_rgba(28,25,23,0.4)]">
                <p className="text-meta font-medium tracking-wide text-ink-tertiary uppercase">
                  Latest reading
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    ["Heart rate", "122", "bpm", true],
                    ["Oxygen", "91", "%", true],
                    ["Temp", "37.0", "°C", false],
                    ["Pain", "4", "/10", false],
                  ].map(([label, value, unit, bad]) => (
                    <div
                      key={String(label)}
                      className={`rounded-lg border px-2.5 py-2 ${
                        bad
                          ? "border-severity-red-border bg-severity-red-bg"
                          : "border-line bg-wash"
                      }`}
                    >
                      <p className="text-[10px] text-ink-tertiary">{label}</p>
                      <p className="numeric text-label font-medium text-ink">
                        {value}
                        <span className="ml-1 text-meta font-normal text-ink-tertiary">
                          {unit}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : onPatients ? (
          <motion.div
            key="patients"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col overflow-hidden px-4 py-4 sm:px-5"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-heading text-heading text-ink">Patients</p>
                <p className="pt-1 text-meta text-ink-tertiary">
                  Full panel · worst first · open a row for the chart
                </p>
              </div>
              <div className="flex h-9 items-center gap-2 rounded-md bg-ink px-3.5 text-label font-medium text-paper">
                <Phone className="size-3.5" />
                Call now
              </div>
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-xl border border-line bg-raised shadow-[0_16px_40px_-28px_rgba(28,25,23,0.45)]">
              <div className="grid grid-cols-[1.4fr_1fr_0.7fr_0.9fr] gap-2 border-b border-line bg-wash px-4 py-2.5 text-meta font-medium tracking-wide text-ink-tertiary uppercase">
                <span>Patient</span>
                <span className="hidden sm:inline">Detail</span>
                <span>Day</span>
                <span>Severity</span>
              </div>
              <ul>
                {DIRECTORY_ROWS.map((row) => {
                  const isMargaret = row.id === "margaret";
                  const highlight = selecting && isMargaret;
                  return (
                    <li
                      key={row.id}
                      className="relative border-b border-line last:border-0"
                    >
                      <motion.div
                        animate={
                          highlight
                            ? { backgroundColor: "var(--color-wash)" }
                            : { backgroundColor: "transparent" }
                        }
                        className="grid grid-cols-[1.4fr_1fr_0.7fr_0.9fr] items-center gap-2 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-label font-medium text-ink">
                            {row.name}
                          </p>
                          <p className="numeric truncate text-meta text-ink-tertiary sm:hidden">
                            {row.meta}
                          </p>
                        </div>
                        <p className="hidden numeric truncate text-meta text-ink-secondary sm:block">
                          {row.meta}
                        </p>
                        <p className="numeric text-label text-ink">
                          {row.meta.match(/Day (\d+)/)?.[1] ?? "—"}
                        </p>
                        <SeverityChip
                          level={row.level}
                          size="sm"
                          label={row.condition}
                        />
                      </motion.div>
                      <TapHint
                        show={highlight}
                        className="top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2"
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="hub"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col gap-3 overflow-hidden px-4 py-4 sm:px-5"
          >
            <div>
              <p className="font-heading text-heading text-ink">Clinician hub</p>
              <p className="pt-1 text-meta text-ink-tertiary">
                What needs attention · what to do next
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["On the panel", "5", "patients"],
                ["Needing a clinician", "1 urgent", "1 attention"],
                ["Open escalations", "1", "to review"],
              ].map(([label, value, detail]) => (
                <div
                  key={label}
                  className="rounded-xl border border-line bg-raised px-3.5 py-3"
                >
                  <p className="text-meta tracking-wide text-ink-tertiary uppercase">
                    {label}
                  </p>
                  <p className="numeric mt-1.5 text-body font-medium text-ink">
                    {value}
                  </p>
                  <p className="text-meta text-ink-tertiary">{detail}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-raised px-4 py-3 shadow-[0_12px_32px_-24px_rgba(28,25,23,0.35)]">
              <div>
                <p className="text-label font-medium text-ink">Call now</p>
                <p className="text-meta text-ink-tertiary">
                  Outbound check-in · lands on Margaret&apos;s chart
                </p>
              </div>
              <div className="flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-label font-medium text-paper">
                <Phone className="size-4" />
                Call now
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-severity-red-border/70 bg-severity-red-bg/40">
              <p className="border-b border-severity-red-border/50 px-4 py-2 text-meta font-medium tracking-wide text-severity-red-fg uppercase">
                Needs attention
              </p>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-label font-medium text-ink">
                    Margaret Ellison
                  </p>
                  <p className="numeric text-meta text-ink-secondary">
                    Suspected pulmonary embolism · Day 4
                  </p>
                </div>
                <SeverityChip level="red" size="sm" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-wash/60 px-4 py-3">
              <div>
                <p className="text-label font-medium text-ink">Panel directory</p>
                <p className="text-meta text-ink-tertiary">
                  5 monitored — open the full worklist
                </p>
              </div>
              <span className="inline-flex min-h-9 items-center rounded-md bg-ink px-3 text-meta font-medium text-paper">
                View all patients
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
