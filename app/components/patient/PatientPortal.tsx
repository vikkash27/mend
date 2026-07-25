"use client";

import { Loader2, Phone } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { MendLogo } from "@/app/components/brand/MendLogo";
import { PhoneFrame } from "@/app/components/device/PhoneFrame";
import { MedicationList } from "@/app/components/prn/MedicationList";
import { OhsQuestionnaire } from "@/app/components/ohs/OhsQuestionnaire";
import { MedicalAdviceDisclaimer } from "@/app/components/MedicalAdviceDisclaimer";
import { Button } from "@/components/ui/button";
import { SeverityChip } from "@/components/ui/severity-chip";
import type { Severity } from "@/lib/clinical/types";
import { startLiveCall } from "@/lib/sim/live-call";

type CallActionState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

export interface PatientPortalProps {
  patientName: string;
  dayPostOp: number;
  procedure: string;
  level: Severity;
  /** Rule ids behind today's verdict — enriches the clinician's PRN notification. */
  firedRules?: string[];
  headline: string;
  lede: string;
  /** Latest physiologic snapshot for the summary card (patient seat may show numbers). */
  hrBpm: number;
  spo2: number;
  painScore: number;
  /** Phone chrome on md+. False when `?frame=0`. */
  framed?: boolean;
}

function CallStatus({ state }: { state: CallActionState }) {
  if (state.kind === "idle") return null;
  if (state.kind === "pending") {
    return (
      <p className="flex items-center gap-2 text-lg text-ink-secondary">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        Calling you now…
      </p>
    );
  }
  const tone =
    state.kind === "error"
      ? "border-severity-red-border bg-severity-red-bg text-severity-red-fg"
      : "border-line bg-wash text-ink";
  return (
    <p className={`rounded-xl border px-3 py-2.5 text-lg leading-snug ${tone}`}>
      {state.message}
    </p>
  );
}

export function PatientPortal({
  patientName,
  dayPostOp,
  procedure,
  level,
  firedRules = [],
  headline,
  lede,
  hrBpm,
  spo2,
  painScore,
  framed = true,
}: PatientPortalProps) {
  const [callState, setCallState] = useState<CallActionState>({ kind: "idle" });

  const requestCheckIn = useCallback(async () => {
    setCallState({ kind: "pending" });
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "patient" }),
      });
      const json = (await res.json()) as {
        status?: string;
        reason?: string;
        conversationId?: string | null;
        source?: string;
      };
      if (!res.ok || json.status === "skipped" || json.status === "error") {
        setCallState({
          kind: "error",
          message:
            json.reason ??
            `Call failed (${res.status}). Please try again in a moment.`,
        });
        return;
      }
      startLiveCall({
        conversationId: json.conversationId ?? null,
        source: "patient",
      });
      setCallState({
        kind: "ok",
        message:
          "Mend is calling you now. Answer on speaker — press any key at the trial message, then Mend speaks.",
      });
    } catch {
      setCallState({
        kind: "error",
        message: "Could not reach Mend. Please try again in a moment.",
      });
    }
  }, []);

  const [showOhs, setShowOhs] = useState(false);

  return (
    <PhoneFrame framed={framed} stage>
      <main className="mx-auto flex h-full w-full max-w-md flex-col px-5 pt-11 pb-4 md:pt-12">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-ink"
            aria-label="Mend home"
          >
            <MendLogo
              variant="lockup"
              size="sm"
              wordmarkClassName="text-xl"
            />
          </Link>
          <p className="font-sans text-[11px] font-medium tracking-[0.12em] text-ink-tertiary uppercase">
            Your recovery
          </p>
        </div>

        <p className="pt-3 text-lg text-ink-secondary">
          {patientName} · day {dayPostOp} after {procedure.toLowerCase()}
        </p>

        <div className="pt-3">
          <SeverityChip level={level} size="md" />
        </div>

        <h1 className="pt-3 font-heading text-[1.65rem] leading-tight text-balance text-ink sm:text-heading">
          {headline}
        </h1>

        <div className="mt-4 rounded-2xl border border-line bg-raised p-3.5 shadow-[0_8px_24px_-18px_rgba(28,25,23,0.35)]">
          <p className="font-serif text-lg leading-snug text-ink">{lede}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
            {[
              ["HR", String(Math.round(hrBpm))],
              ["SpO₂", `${Math.round(spo2)}%`],
              ["Pain", String(painScore)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-wash px-2.5 py-2">
                <p className="text-[11px] font-medium tracking-[0.12em] text-ink-tertiary uppercase">
                  {label}
                </p>
                <p className="numeric pt-0.5 text-lg font-medium text-ink">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5 pt-4">
          <Button
            type="button"
            size="lg"
            onClick={() => void requestCheckIn()}
            disabled={callState.kind === "pending"}
            className="min-h-12 w-full rounded-xl text-lg"
          >
            {callState.kind === "pending" ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Phone aria-hidden="true" className="size-4" strokeWidth={2} />
            )}
            Request a check-in call
          </Button>
          <Link
            href="/family"
            className="flex min-h-12 items-center justify-center rounded-xl border border-line-strong bg-raised text-lg font-medium text-ink"
          >
            Open family updates
          </Link>
        </div>

        <div className="pt-3">
          <CallStatus state={callState} />
        </div>

        {callState.kind === "idle" ? (
          <p className="pt-2 text-lg leading-snug text-ink-secondary">
            <span className="font-medium text-ink">Twilio trial:</span> answer on
            speaker, then press any key when you hear the trial message.
          </p>
        ) : null}

        {showOhs ? (
          <div className="pt-4">
            <OhsQuestionnaire dayPostOp={dayPostOp} onClose={() => setShowOhs(false)} />
          </div>
        ) : (
          <>
            <div className="pt-4">
              <MedicationList
                dayPostOp={dayPostOp}
                currentSeverity={level}
                firedRules={firedRules}
                painScore={painScore}
              />
            </div>

            {/* The Oxford Hip Score asks about the past four weeks, so it is a
                periodic prompt rather than part of the daily surface. Offered,
                never pushed — a questionnaire that nags stops being answered
                honestly. */}
            <div className="pt-3">
              <button
                type="button"
                onClick={() => setShowOhs(true)}
                className="min-h-12 w-full rounded-xl border border-line bg-wash px-3.5 text-lg text-ink-secondary"
              >
                Answer 12 questions about your hip
              </button>
            </div>
          </>
        )}

        <div className="mt-auto space-y-2 pt-3">
          <p className="text-lg text-ink-tertiary">
            Mend can call you now when you ask, and every morning.
          </p>
          <MedicalAdviceDisclaimer tone="quiet" />
        </div>
      </main>
    </PhoneFrame>
  );
}
