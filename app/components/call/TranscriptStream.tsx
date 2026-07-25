"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { SeverityChip } from "@/components/ui/severity-chip";
import { cn } from "@/lib/utils";
import { useHydrated } from "./use-hydrated";
import {
  formatCallClock,
  type CallEvent,
  type ToolResultEvent,
  type ToolStartEvent,
  type TurnEvent,
} from "./timeline";

/**
 * The left half of the stage view: the call as it is spoken.
 *
 * Two things carry the meaning here. Speech is set in the display serif, so
 * the pane reads as two people talking rather than as a log. And every time
 * the agent hands the conversation to the deterministic engine, an inline
 * marker says so — that marker is the architectural claim of the whole
 * project made visible mid-call, so it is legible but deliberately quiet: no
 * fill, no colour of its own, and no motion beyond the working indicator
 * while the engine is actually being waited on.
 */

const LABEL = "text-eyebrow font-medium uppercase";

function SpeakerLine({
  name,
  at,
  emphasis,
}: {
  name: string;
  at: number;
  emphasis: boolean;
}) {
  return (
    <p className="flex items-baseline gap-3">
      <span className={cn(LABEL, emphasis ? "text-ink-secondary" : "text-ink-tertiary")}>
        {name}
      </span>
      <span className="numeric text-meta text-ink-tertiary">{formatCallClock(at)}</span>
    </p>
  );
}

function Turn({
  event,
  patientName,
  animate,
}: {
  event: TurnEvent;
  patientName: string;
  animate: boolean;
}) {
  const isPatient = event.speaker === "margaret";

  return (
    <motion.article
      initial={animate ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: animate ? 0.32 : 0, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "space-y-2",
        isPatient ? "" : "border-l-2 border-line pl-5 2xl:pl-7",
      )}
    >
      <SpeakerLine name={isPatient ? patientName : "Mend"} at={event.at} emphasis={isPatient} />
      <p
        className={cn(
          "font-serif text-lede leading-[1.35] lg:text-subhead 2xl:text-[1.75rem]",
          isPatient ? "text-ink" : "text-ink-secondary",
        )}
      >
        {event.text}
      </p>
      {event.verbatimFrom ? (
        <p className="numeric text-meta text-ink-tertiary">
          Spoken verbatim from{" "}
          <span className="font-medium text-ink-secondary">{event.verbatimFrom}</span> — the
          model wrote none of these words.
        </p>
      ) : null}
    </motion.article>
  );
}

function WorkingDots({ animate }: { animate: boolean }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-ink-tertiary"
          initial={{ opacity: 0.25 }}
          animate={animate ? { opacity: [0.25, 1, 0.25] } : { opacity: 0.6 }}
          transition={
            animate
              ? { duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }
              : { duration: 0 }
          }
        />
      ))}
    </span>
  );
}

function EngineCheck({
  start,
  result,
  animate,
}: {
  start: ToolStartEvent;
  result: ToolResultEvent | undefined;
  animate: boolean;
}) {
  const pending = result === undefined;

  return (
    <motion.aside
      initial={animate ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: animate ? 0.28 : 0 }}
      className="space-y-3 rounded-xl border border-line bg-wash px-5 py-4"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-2.5 text-label font-medium text-ink-secondary">
          <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-ink-tertiary" />
          {pending ? "Checking against the safety engine" : "Checked against the safety engine"}
          {pending ? <WorkingDots animate={animate} /> : null}
        </p>
        <p className="numeric shrink-0 text-meta text-ink-tertiary">
          {pending ? `${start.endpoint}` : `${start.endpoint} · ${result.latencyMs} ms`}
        </p>
      </div>

      <p className="numeric text-meta text-ink-tertiary">
        {start.inputs.map((input) => `${input.key}: ${input.value}`).join("  ·  ")}
      </p>

      {result ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-strong/60 pt-3">
          <SeverityChip level={result.decision.level} size="sm" />
          <p className="numeric text-meta text-ink-tertiary">
            {result.decision.firedRules.length > 0
              ? `${result.decision.firedRules.join(" · ")}`
              : "no rule fired"}
          </p>
        </div>
      ) : null}
    </motion.aside>
  );
}

export function TranscriptStream({
  events,
  patientName,
  priorSummary,
  animate,
  className,
}: {
  events: readonly CallEvent[];
  /** How the patient is named in the speaker column. */
  patientName: string;
  /** One sentence of prior-check-in recall the agent opened with. */
  priorSummary?: string;
  /** False for a frozen capture frame and under reduced motion. */
  animate: boolean;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const settled = useRef(false);
  const reduceMotion = useReducedMotion();

  // Motion is confined to turns that arrive after hydration: the ones already
  // in the server's HTML have no arrival to animate, and `prefers-reduced-
  // motion` is not knowable until the client renders.
  const hydrated = useHydrated();
  const motionOn = animate && hydrated && !reduceMotion;

  // The newest turn is the one being spoken, so it stays pinned to the
  // bottom. The first paint jumps rather than scrolls, so a frozen capture
  // is not caught mid-animation.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: settled.current && motionOn ? "smooth" : "auto",
    });
    settled.current = true;
  }, [events.length, motionOn]);

  const results = new Map(
    events
      .filter((e): e is ToolResultEvent => e.kind === "tool-result")
      .map((e) => [e.startId, e]),
  );

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-baseline justify-between gap-4 pb-5">
        <h2 className={cn(LABEL, "text-ink-tertiary")}>Live transcript</h2>
        <p className="numeric text-meta text-ink-tertiary">
          Transcribed as she speaks · not stored as audio
        </p>
      </div>

      {/* The newest turn sits at the bottom and the call rises up the pane as
          it goes, so the line being spoken is always at the same eye level.
          The mask fades the overflowing turn out rather than slicing it. */}
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto pr-1 [mask-image:linear-gradient(to_bottom,transparent,black_3rem)]"
      >
        <div className="flex min-h-full flex-col justify-end gap-7 pb-1 2xl:gap-9">
          {priorSummary ? (
            <div className="space-y-2.5">
              <p className={cn(LABEL, "text-ink-tertiary")}>Before the call</p>
              <p className="font-serif text-lede leading-snug text-ink-tertiary 2xl:text-subhead">
                {priorSummary}
              </p>
              <p className="numeric text-meta text-ink-tertiary">
                Recalled from her last check-in and spoken in the opener — no model call.
              </p>
            </div>
          ) : null}

          <div className="flex items-center gap-4">
            <span className={cn(LABEL, "shrink-0 text-ink-tertiary")}>Call connected</span>
            <span aria-hidden="true" className="h-px flex-1 bg-line" />
            <span className="numeric hidden shrink-0 text-meta text-ink-tertiary sm:inline">
              Outbound · voice agent · transcribed live
            </span>
          </div>

          {events.map((event) => {
            if (event.kind === "tool-result") return null;
            if (event.kind === "tool-start") {
              return (
                <EngineCheck
                  key={event.id}
                  start={event}
                  result={results.get(event.id)}
                  animate={motionOn}
                />
              );
            }
            return (
              <Turn
                key={event.id}
                event={event}
                patientName={patientName}
                animate={motionOn}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
