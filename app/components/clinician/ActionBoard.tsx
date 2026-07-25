"use client";

import { AlertTriangle, Loader2, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { startLiveCall } from "@/lib/sim/live-call";
import type { RosterPatient } from "@/lib/sim/roster";
import { cn } from "@/lib/utils";
import { pickDefaultPatientId } from "./hub-selection";
import { PracticeSummary } from "./PracticeSummary";

type CallActionState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

function CallStatus({ state }: { state: CallActionState }) {
  if (state.kind === "idle") return null;
  if (state.kind === "pending") {
    return (
      <p className="flex items-center gap-2 text-label text-ink-secondary">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        Placing call…
      </p>
    );
  }
  const tone =
    state.kind === "error"
      ? "border-severity-red-border bg-severity-red-bg text-severity-red-fg"
      : "border-line bg-wash text-ink-secondary";
  return (
    <p
      role={state.kind === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-label",
        tone,
      )}
    >
      {state.kind === "error" ? (
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      ) : null}
      <span>{state.message}</span>
    </p>
  );
}

export function ActionBoard({
  patients,
  onCallPlaced,
}: {
  patients: RosterPatient[];
  onCallPlaced?: () => void;
}) {
  const router = useRouter();
  const [callState, setCallState] = useState<CallActionState>({ kind: "idle" });

  const callNow = useCallback(async () => {
    setCallState({ kind: "pending" });
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "clinician" }),
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
            `Call failed (${res.status}). Check DEMO_PATIENT_PHONE and ElevenLabs credentials.`,
        });
        return;
      }
      startLiveCall({
        conversationId: json.conversationId ?? null,
        source: "clinician",
      });
      setCallState({
        kind: "ok",
        message: json.conversationId
          ? `Call placed (${json.conversationId}). Answer on speaker — press any key at the Twilio trial message, then Mend speaks.`
          : "Call placed. Answer on speaker — press any key at the Twilio trial message, then Mend speaks.",
      });
      onCallPlaced?.();
      const id = pickDefaultPatientId(patients);
      if (id) router.push(`/clinician/${id}?live=1`);
    } catch {
      setCallState({ kind: "error", message: "Could not reach /api/call." });
    }
  }, [onCallPlaced, patients, router]);

  return (
    <div className="space-y-5">
      <PracticeSummary patients={patients} />

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-raised p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-label font-medium text-ink">Call now</p>
          <p className="max-w-xl text-meta text-ink-secondary">
            <span className="font-medium text-ink">Twilio trial:</span> answer on
            speaker, then <span className="font-medium text-ink">press any key</span>{" "}
            when you hear the trial message — Mend starts after that.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href="/family"
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-line px-4 text-label text-ink-secondary hover:bg-wash"
          >
            Open family view
          </Link>
          <Button
            type="button"
            size="lg"
            onClick={() => void callNow()}
            disabled={callState.kind === "pending"}
            className="min-h-12"
          >
            {callState.kind === "pending" ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Phone aria-hidden="true" className="size-4" />
            )}
            Call now
          </Button>
        </div>
      </div>
      <CallStatus state={callState} />
    </div>
  );
}
