"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bluetooth, FileText, Loader2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { SeverityChip } from "@/components/ui/severity-chip";
import { KardiaSensorDrawing, WatchDrawing } from "./DeviceIllustrations";
import { landingCopy } from "./copy";
import { useLandingMotion } from "./motion";

/**
 * Device integrations — Kardia / Garmin actions that visibly update the
 * clinician dashboard chart in the same frame.
 */
export function Integrations() {
  const { fadeUp, staggerContainer, viewportOnce, initial, reduce } =
    useLandingMotion();
  const c = landingCopy.devices;

  return (
    <section
      id="devices"
      className="scroll-mt-8 border-t border-line bg-wash/40 px-6 py-14 sm:px-10 sm:py-16 lg:px-14 lg:py-20"
    >
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
          className="mt-4 max-w-2xl font-heading text-heading tracking-tight text-ink"
        >
          {c.title}
        </motion.h2>
        <motion.p variants={fadeUp} className="prose-support mt-4">
          {c.support}
        </motion.p>

        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-12">
          <motion.div variants={fadeUp} className="flex flex-col gap-5">
            <DeviceDemoShell label="Capture → chart">
              <KardiaWalkthrough reduce={reduce} />
            </DeviceDemoShell>
            <div className="pt-1">
              <p className="text-body-lg text-ink">{c.kardia.benefit}</p>
              <h3 className="mt-4 font-heading text-subhead text-ink">
                {c.kardia.title}
              </h3>
              <p className="mt-3 text-body text-ink-secondary">{c.kardia.body}</p>
              <p className="mt-3 text-meta text-ink-tertiary">{c.kardia.note}</p>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="flex flex-col gap-5">
            <DeviceDemoShell label="Patient phone → clinician">
              <WatchWalkthrough reduce={reduce} />
            </DeviceDemoShell>
            <div className="pt-1">
              <p className="text-body-lg text-ink">{c.watch.benefit}</p>
              <h3 className="mt-4 font-heading text-subhead text-ink">
                {c.watch.title}
              </h3>
              <p className="mt-3 text-body text-ink-secondary">{c.watch.body}</p>
              <p className="mt-3 text-meta text-ink-tertiary">{c.watch.note}</p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

function DeviceDemoShell({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_28px_60px_-36px_rgba(28,25,23,0.42)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,var(--color-signal-soft)_0%,transparent_45%),radial-gradient(ellipse_at_100%_0%,var(--color-wash-strong)_0%,transparent_40%)]"
      />
      <div className="relative flex items-center gap-1.5 border-b border-line bg-gradient-to-b from-wash to-wash/60 px-4 py-2.5">
        <span className="size-2 rounded-full bg-line-strong" />
        <span className="size-2 rounded-full bg-line-strong" />
        <span className="size-2 rounded-full bg-line-strong" />
        <span className="ml-3 text-meta text-ink-tertiary">
          Live feature · {label}
        </span>
      </div>
      <div className="relative min-h-[360px] p-4 sm:min-h-[380px] sm:p-5">
        {children}
      </div>
    </div>
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

function ChartHeader({ live }: { live?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <p className="font-heading text-label text-ink">Margaret Ellison</p>
        <p className="numeric text-meta text-ink-tertiary">Day 4 · chart</p>
      </div>
      {live ? (
        <span className="flex items-center gap-1.5 text-meta text-severity-green-fg">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-severity-green-fg opacity-40" />
            <span className="relative inline-flex size-2 rounded-full bg-severity-green-fg" />
          </span>
          Live
        </span>
      ) : (
        <span className="text-meta text-ink-tertiary">Dashboard</span>
      )}
    </div>
  );
}

/** Upload PDF in Capture → determination + BPM flash onto the patient chart. */
function KardiaWalkthrough({ reduce }: { reduce: boolean }) {
  // 0 idle · 1 drop · 2 extracting · 3 chart updated
  const step = useWalkStep(4, 2400, reduce);
  const dropping = step === 1;
  const extracting = step === 2;
  const ready = step === 3;

  return (
    <div className="grid h-full gap-3 sm:grid-cols-2">
      {/* Capture */}
      <div className="flex flex-col rounded-xl border border-line bg-wash/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-meta font-medium tracking-wide text-ink-tertiary uppercase">
            Capture · Kardia PDF
          </p>
          <KardiaSensorDrawing className="h-8 w-auto opacity-80" />
        </div>
        <div className="relative mt-3 flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-paper p-3 text-center">
          <AnimatePresence mode="wait">
            {extracting ? (
              <motion.div
                key="ex"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-2"
              >
                <Loader2 className="size-5 animate-spin text-ink-secondary" />
                <p className="text-meta text-ink">Reading report…</p>
              </motion.div>
            ) : ready ? (
              <motion.div
                key="ok"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-2"
              >
                <FileText className="size-5 text-severity-green-fg" />
                <p className="text-meta font-medium text-ink">Uploaded</p>
                <p className="text-meta text-ink-tertiary">Margaret_rest_6L.pdf</p>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-2"
              >
                <KardiaSensorDrawing
                  className="h-12 w-auto"
                  pulse={dropping && !reduce}
                />
                <motion.div
                  animate={
                    dropping
                      ? { y: 12, scale: 0.95 }
                      : { y: 0, scale: 1 }
                  }
                  className="flex items-center gap-2 rounded-md border border-line bg-raised px-2.5 py-1.5"
                >
                  <FileText className="size-3.5 text-ink-secondary" />
                  <span className="text-meta text-ink">Margaret_rest_6L.pdf</span>
                </motion.div>
                <p className="text-meta text-ink-secondary">
                  {dropping ? "Dropping…" : "Drop PDF from the 6L sensor"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Chart */}
      <div className="flex flex-col rounded-xl border border-line bg-raised p-3">
        <ChartHeader />
        <div className="mt-3 flex flex-1 flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            <DashTile
              label="ECG"
              highlight={ready}
              value={ready ? "Sinus tach" : "—"}
              hint={ready ? "from Kardia" : "awaiting PDF"}
            />
            <DashTile
              label="HR"
              highlight={ready}
              value={ready ? "122" : "—"}
              unit={ready ? "bpm" : undefined}
              hint={ready ? "report BPM" : "awaiting PDF"}
            />
          </div>
          <AnimatePresence mode="wait">
            {ready ? (
              <motion.div
                key="sev"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-lg border border-severity-amber-border bg-severity-amber-bg p-2.5"
              >
                <SeverityChip level="amber" size="sm" />
                <p className="pt-1.5 text-meta leading-snug text-ink">
                  Chart updated — determination on the worklist now.
                </p>
              </motion.div>
            ) : (
              <motion.p
                key="wait"
                className="rounded-lg border border-line bg-wash px-2.5 py-3 text-meta text-ink-tertiary"
              >
                {extracting
                  ? "Pushing values to the chart…"
                  : "Upload a PDF — values appear here immediately."}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/** Patient phone shows live animated HR; clinician chart mirrors the same BPM. */
function WatchWalkthrough({ reduce }: { reduce: boolean }) {
  // 0 idle · 1 pairing · 2–3 streaming (synced both sides)
  const step = useWalkStep(4, 2200, reduce);
  const pairing = step === 1;
  const live = step >= 2;

  const [bpm, setBpm] = useState(78);
  useEffect(() => {
    if (reduce || !live) {
      setBpm(78);
      return;
    }
    const id = window.setInterval(() => {
      setBpm((b) => {
        const next = b + (Math.random() > 0.4 ? 1 : -1);
        return Math.min(118, Math.max(74, next));
      });
    }, 550);
    return () => window.clearInterval(id);
  }, [live, reduce]);

  const elevated = live && bpm >= 100;

  return (
    <div className="grid h-full items-stretch gap-2 sm:grid-cols-[0.9fr_auto_1.1fr] sm:gap-1.5">
      {/* Patient phone */}
      <div className="mx-auto flex w-full max-w-[200px] flex-col rounded-[1.6rem] bg-ink p-[7px] sm:mx-0">
        <div className="relative flex flex-1 flex-col overflow-hidden rounded-[1.25rem] bg-paper px-3 pt-7 pb-3">
          <div
            aria-hidden="true"
            className="absolute top-2 left-1/2 h-4 w-14 -translate-x-1/2 rounded-full bg-ink"
          />
          <p className="text-[9px] font-medium tracking-[0.12em] text-ink-tertiary uppercase">
            Your recovery · live
          </p>
          <AnimatePresence mode="wait">
            {live ? (
              <motion.div
                key="live"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-3 flex flex-1 flex-col"
              >
                <div className="flex items-center gap-1.5">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-severity-green-fg opacity-40" />
                    <span className="relative inline-flex size-2 rounded-full bg-severity-green-fg" />
                  </span>
                  <p className="text-[10px] font-medium text-ink">Watch · synced</p>
                </div>
                <div className="mt-2 flex items-center justify-center">
                  <WatchDrawing
                    className="h-16 w-auto"
                    pulse={!reduce}
                    bpm={bpm}
                  />
                </div>
                <div className="mt-1 flex items-end justify-center gap-1.5">
                  <motion.p
                    key={bpm}
                    initial={reduce ? false : { opacity: 0.45, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="numeric text-3xl leading-none tracking-tight text-ink"
                  >
                    {bpm}
                  </motion.p>
                  <p className="pb-0.5 text-[11px] text-ink-tertiary">bpm</p>
                </div>
                <p className="mt-auto pt-2 text-[10px] leading-snug text-ink-secondary">
                  Streaming from your watch to Mend.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="pair"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-4 flex flex-1 flex-col items-center justify-center gap-3 text-center"
              >
                <motion.div
                  animate={
                    pairing
                      ? { scale: [1, 1.04, 1], opacity: [0.75, 1, 0.75] }
                      : { scale: 1 }
                  }
                  transition={
                    pairing
                      ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                      : undefined
                  }
                  className="relative"
                >
                  <WatchDrawing className="h-[4.5rem] w-auto" pulse={pairing} />
                  {pairing ? (
                    <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full border border-line bg-raised">
                      <Bluetooth className="size-3.5 text-signal" />
                    </span>
                  ) : null}
                </motion.div>
                <p className="text-[11px] text-ink">
                  {pairing ? "Linking watch…" : "Connect your watch"}
                </p>
                <div className="flex h-8 w-full items-center justify-center rounded-lg bg-ink text-[11px] font-medium text-paper">
                  {pairing ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin" />
                      Pairing
                    </span>
                  ) : (
                    "Sync heart rate"
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Sync cue */}
      <div className="hidden flex-col items-center justify-center gap-1 sm:flex">
        <motion.div
          animate={
            live
              ? { opacity: [0.35, 1, 0.35], scaleX: [0.85, 1, 0.85] }
              : { opacity: 0.35 }
          }
          transition={
            live ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : undefined
          }
          className="h-px w-6 bg-ink"
        />
        <p className="max-w-[3.5rem] text-center text-[9px] leading-tight text-ink-tertiary">
          {live ? "Synced live" : "Waiting"}
        </p>
        <motion.div
          animate={
            live
              ? { opacity: [0.35, 1, 0.35], scaleX: [0.85, 1, 0.85] }
              : { opacity: 0.35 }
          }
          transition={
            live
              ? { duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: 0.2 }
              : undefined
          }
          className="h-px w-6 bg-ink"
        />
      </div>

      {/* Clinician chart — same bpm */}
      <div className="flex flex-col rounded-xl border border-line bg-raised p-3">
        <ChartHeader live={live} />
        <div className="mt-3 flex flex-1 flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            <motion.div
              key={live ? bpm : "off"}
              animate={live ? { scale: [1, 1.03, 1] } : undefined}
              transition={{ duration: 0.35 }}
              className={`rounded-lg border px-2.5 py-2 ${
                live ? "border-ink/20 bg-wash" : "border-line bg-wash/60"
              }`}
            >
              <p className="text-meta text-ink-tertiary">HR</p>
              <div className="mt-1 flex items-end gap-1">
                <p className="numeric text-2xl leading-none text-ink">
                  {live ? bpm : "—"}
                </p>
                {live ? (
                  <span className="pb-0.5 text-meta text-ink-tertiary">bpm</span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[10px] text-ink-tertiary">
                {live ? "from patient phone" : "awaiting sync"}
              </p>
            </motion.div>
            <DashTile
              label="Quality"
              highlight={live}
              value={live ? "Contact OK" : "—"}
              hint={live ? "GATT contact" : "watch offline"}
            />
          </div>
          {live ? <HrSpark reduce={reduce} compact /> : null}
          <AnimatePresence mode="wait">
            {live ? (
              <motion.div
                key="stream"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-lg border p-2.5 ${
                  elevated
                    ? "border-severity-amber-border bg-severity-amber-bg"
                    : "border-line bg-wash"
                }`}
              >
                {elevated ? (
                  <SeverityChip level="amber" size="sm" label="HR climbing" />
                ) : (
                  <SeverityChip level="green" size="sm" />
                )}
                <p className="pt-1.5 text-meta leading-snug text-ink">
                  {elevated
                    ? "Same BPM as her phone — engine sees the drift now."
                    : "Doctor view mirrors her phone HR in realtime."}
                </p>
              </motion.div>
            ) : (
              <motion.p
                key="idle"
                className="rounded-lg border border-line bg-wash px-2.5 py-3 text-meta text-ink-tertiary"
              >
                {pairing
                  ? "Patient phone linking — chart will mirror BPM…"
                  : "When her watch syncs to her phone, this chart updates live."}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function HrSpark({
  reduce,
  compact,
}: {
  reduce: boolean;
  compact?: boolean;
}) {
  const bars = compact ? 18 : 22;
  return (
    <div className={`flex items-end gap-0.5 ${compact ? "mt-2 h-7" : "mt-4 h-9"}`}>
      {Array.from({ length: bars }, (_, i) => (
        <motion.span
          key={i}
          className="w-full rounded-sm bg-ink/80"
          animate={
            reduce
              ? { height: 6 + (i % 5) * 3 }
              : {
                  height: [
                    6 + (i % 4) * 2,
                    12 + ((i * 3) % 7) * 2.5,
                    8 + (i % 5) * 3,
                  ],
                }
          }
          transition={
            reduce
              ? undefined
              : {
                  duration: 1.25,
                  repeat: Infinity,
                  delay: i * 0.035,
                  ease: "easeInOut",
                }
          }
          style={{ height: 10 }}
        />
      ))}
    </div>
  );
}

function DashTile({
  label,
  value,
  unit,
  hint,
  highlight,
  pulse,
}: {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  highlight?: boolean;
  pulse?: boolean;
}) {
  return (
    <motion.div
      animate={
        highlight
          ? {
              backgroundColor: [
                "var(--color-wash)",
                "var(--color-raised)",
                "var(--color-wash)",
              ],
            }
          : undefined
      }
      transition={pulse ? { duration: 1.2, repeat: Infinity } : { duration: 0.6 }}
      className={`rounded-lg border px-2.5 py-2 ${
        highlight ? "border-ink/20 bg-wash" : "border-line bg-wash/60"
      }`}
    >
      <p className="text-meta text-ink-tertiary">{label}</p>
      <p className="numeric mt-1 text-body leading-tight text-ink">
        {value}
        {unit ? (
          <span className="ml-1 text-meta text-ink-tertiary">{unit}</span>
        ) : null}
      </p>
      <p className="mt-0.5 text-[10px] text-ink-tertiary">{hint}</p>
    </motion.div>
  );
}
