"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FileText, Phone, ShieldCheck, Watch } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { MendMark } from "@/app/components/brand/MendMark";
import { SeverityChip } from "@/components/ui/severity-chip";
import { useLandingMotion } from "./motion";

type Beat = "call" | "engine" | "truth";

const BEATS: { id: Beat; label: string; punchline: string }[] = [
  { id: "call", label: "Call", punchline: "Voice check-in — not another app" },
  {
    id: "engine",
    label: "Engine",
    punchline: "Deterministic triage — LLM never chooses red",
  },
  {
    id: "truth",
    label: "Truth",
    punchline: "One clinical truth · three surfaces",
  },
];
const DWELL_MS = 4000;

/**
 * Hero product theater — looping workflow (research: Linear/Ramp pacing,
 * TORTUS-style visible engine, shared-truth dual frames).
 */
export function ProductTheater({ className }: { className?: string }) {
  const { reduce } = useLandingMotion();
  const [beat, setBeat] = useState<Beat>("call");

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setBeat((current) => {
        const i = BEATS.findIndex((b) => b.id === current);
        return BEATS[(i + 1) % BEATS.length]!.id;
      });
    }, DWELL_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  const active = reduce ? "truth" : beat;
  const activeMeta = BEATS.find((b) => b.id === active)!;
  const activeIndex = BEATS.findIndex((b) => b.id === active);

  return (
    <div
      className={`relative flex h-full min-h-[24rem] flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_28px_60px_-36px_rgba(28,25,23,0.45)] sm:min-h-[30rem] ${className ?? ""}`}
      aria-hidden="true"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,var(--color-wash-strong)_0%,transparent_55%),radial-gradient(ellipse_at_100%_80%,var(--color-severity-red-bg)_0%,transparent_45%)] opacity-80" />

      <div className="relative flex items-center justify-between gap-3 border-b border-line px-5 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-ink">
          <MendMark size="sm" />
          <p className="text-meta font-medium tracking-[0.08em] text-ink-tertiary uppercase">
            Live product
          </p>
          {!reduce ? (
            <span className="relative ml-1 flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-severity-green-fg opacity-40" />
              <span className="relative inline-flex size-2 rounded-full bg-severity-green-fg" />
            </span>
          ) : null}
        </div>
        <BeatTabs active={active} />
      </div>

      <div className="relative h-0.5 w-full bg-line">
        <motion.div
          className="absolute inset-y-0 left-0 bg-ink"
          animate={{ width: `${((activeIndex + 1) / BEATS.length) * 100}%` }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <div className="relative flex flex-1 flex-col p-5 sm:p-6">
        <AnimatePresence mode="wait">
          {active === "call" ? <CallStage key="call" reduce={reduce} /> : null}
          {active === "engine" ? (
            <EngineStage key="engine" reduce={reduce} />
          ) : null}
          {active === "truth" ? (
            <TruthStage key="truth" reduce={reduce} />
          ) : null}
        </AnimatePresence>

        <p className="relative mt-4 text-center text-meta font-medium tracking-wide text-ink-tertiary">
          {activeMeta.punchline}
        </p>
      </div>
    </div>
  );
}

function BeatTabs({ active }: { active: Beat }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-wash p-1">
      {BEATS.map((b) => (
        <span
          key={b.id}
          className={`rounded-full px-2.5 py-1 text-meta transition-colors ${
            b.id === active ? "bg-ink text-paper" : "text-ink-tertiary"
          }`}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

function StageShell({
  children,
  reduce,
}: {
  children: ReactNode;
  reduce: boolean;
}) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-h-0 flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}

function CallStage({ reduce }: { reduce: boolean }) {
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
    <StageShell reduce={reduce}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-meta tracking-wide text-ink-tertiary uppercase">
            Morning check-in
          </p>
          <p className="mt-1 font-heading text-subhead text-ink">
            Margaret · on the call
          </p>
        </div>
        <span className="rounded-full border border-severity-red-border bg-severity-red-bg px-2.5 py-1 text-meta font-medium text-severity-red-fg">
          Live
        </span>
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-2.5">
        <motion.p
          initial={reduce ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-[92%] rounded-2xl rounded-tl-md bg-wash px-3.5 py-2.5 text-label text-ink-secondary"
        >
          <span className="font-medium text-ink">Mend — </span>
          Any shortness of breath when you stood up this morning?
        </motion.p>
        <motion.p
          initial={reduce ? false : { opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 }}
          className="ml-auto max-w-[88%] rounded-2xl rounded-tr-md border border-line bg-raised px-3.5 py-2.5 text-label text-ink"
        >
          A little — nothing like yesterday.
        </motion.p>
        <motion.p
          initial={reduce ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.55 }}
          className="max-w-[85%] rounded-2xl rounded-tl-md bg-wash px-3.5 py-2.5 text-label text-ink-secondary"
        >
          <span className="font-medium text-ink">Mend — </span>
          And any chest pain with that?
        </motion.p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4">
        <VitalTile
          label="HR"
          value={String(bpm)}
          unit="bpm"
          pulse={!reduce}
          tone="warn"
        />
        <VitalTile label="Rhythm" value="Sinus tach" />
        <VitalTile label="SpO₂" value="94" unit="%" tone="warn" />
      </div>
    </StageShell>
  );
}

function EngineStage({ reduce }: { reduce: boolean }) {
  const inputs = [
    { icon: Watch, label: "Watch HR · 122", delay: 0.05 },
    { icon: FileText, label: "Kardia · sinus tach", delay: 0.18 },
    { icon: Phone, label: "Call · breathless", delay: 0.3 },
  ];
  const rules = [
    { id: "pe_breathless_hr", label: "Breathless + elevated HR", delay: 0.55 },
    { id: "pe_chest_pain", label: "Chest pain early post-op", delay: 0.85 },
  ];

  return (
    <StageShell reduce={reduce}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-meta tracking-wide text-ink-tertiary uppercase">
            Deterministic engine
          </p>
          <p className="mt-1 font-heading text-subhead text-ink">
            Escalation · PE pathway
          </p>
        </div>
        <motion.div
          initial={reduce ? false : { scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            delay: 1.1,
            type: "spring",
            stiffness: 260,
            damping: 18,
          }}
        >
          <SeverityChip level="red" size="md" />
        </motion.div>
      </div>

      {/* Device / call inputs fly in */}
      <div className="mt-4 flex flex-wrap gap-2">
        {inputs.map((input) => {
          const Icon = input.icon;
          return (
            <motion.span
              key={input.label}
              initial={reduce ? false : { opacity: 0, y: -10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: input.delay, duration: 0.35 }}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-1 text-meta text-ink"
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
        <p className="text-meta text-ink-tertiary">Level locked · not by the LLM</p>
      </div>
    </StageShell>
  );
}

/** Dual frame: family phone + clinician board, same severity chip. */
function TruthStage({ reduce }: { reduce: boolean }) {
  return (
    <StageShell reduce={reduce}>
      <div className="grid flex-1 grid-cols-1 items-stretch gap-3 sm:grid-cols-[0.9fr_1.1fr]">
        {/* Family phone */}
        <div className="mx-auto flex w-full max-w-[200px] flex-col rounded-[1.5rem] bg-ink p-[7px] sm:mx-0">
          <div className="relative flex flex-1 flex-col overflow-hidden rounded-[1.2rem] bg-paper px-3 pt-7 pb-3">
            <div className="absolute top-2 left-1/2 h-3.5 w-12 -translate-x-1/2 rounded-full bg-ink" />
            <p className="text-[9px] font-medium tracking-[0.12em] text-ink-tertiary uppercase">
              Family
            </p>
            <div className="pt-3">
              <motion.div
                animate={
                  reduce
                    ? undefined
                    : { scale: [1, 1.04, 1] }
                }
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <SeverityChip level="red" size="sm" />
              </motion.div>
            </div>
            <p className="pt-2.5 font-heading text-[15px] leading-snug text-ink">
              Drive over today.
            </p>
            <div className="mt-auto flex h-8 items-center justify-center gap-1.5 rounded-lg bg-ink text-[11px] font-medium text-paper">
              <Phone className="size-3" strokeWidth={2} />
              Call Mom
            </div>
          </div>
        </div>

        {/* Clinician board */}
        <div className="flex flex-col rounded-xl border border-line bg-raised p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-heading text-label text-ink">Clinician hub</p>
            <span className="text-meta text-ink-tertiary">Worklist</span>
          </div>
          <div className="mt-3 rounded-lg border border-line bg-wash px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-label font-medium text-ink">Margaret Ellison</p>
                <p className="numeric text-meta text-ink-tertiary">
                  Day 4 · hip hemiarthroplasty
                </p>
              </div>
              <motion.div
                animate={
                  reduce
                    ? undefined
                    : { scale: [1, 1.04, 1] }
                }
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.15,
                }}
              >
                <SeverityChip level="red" size="sm" />
              </motion.div>
            </div>
            <p className="mt-2 text-meta text-ink-secondary">
              Suspected PE · same engine decision
            </p>
          </div>
          <p className="mt-auto pt-3 text-center text-meta text-ink-tertiary">
            Family phone + hub · locked together
          </p>
        </div>
      </div>
    </StageShell>
  );
}

function VitalTile({
  label,
  value,
  unit,
  pulse,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  pulse?: boolean;
  tone?: "warn";
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        tone === "warn"
          ? "border-severity-amber-border bg-severity-amber-bg"
          : "border-line bg-wash"
      }`}
    >
      <p className="text-meta text-ink-tertiary">{label}</p>
      <motion.p
        key={value}
        initial={pulse ? { opacity: 0.5, y: 3 } : false}
        animate={{ opacity: 1, y: 0 }}
        className="numeric mt-1 text-body leading-none text-ink sm:text-lg"
      >
        {value}
        {unit ? (
          <span className="ml-1 text-meta text-ink-tertiary">{unit}</span>
        ) : null}
      </motion.p>
    </div>
  );
}
