"use client";

import { AlertTriangle, Loader2, Phone, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { CallStage } from "@/app/components/call/CallStage";
import type { LoadedCallStageProps } from "@/app/components/call/load-call-stage-props";
import { Button } from "@/components/ui/button";
import { SeverityChip, SeverityPanel } from "@/components/ui/severity-chip";
import { getLiveCall, startLiveCall, subscribeLiveCall } from "@/lib/sim/live-call";
import type { RosterPatient } from "@/lib/sim/roster";
import { cn } from "@/lib/utils";
import { DecisionAudit } from "./AuditTrail";
import { BillingPanel } from "./BillingPanel";
import {
  CHART_TABS,
  type ChartTabId,
  chartTabHref,
} from "./chart-tabs";
import { ChartNotes } from "./ChartNotes";
import { Panel, SectionHeading } from "./ClinicianShell";
import { clockTime, fullDate, timeAgo } from "./format";
import { HubOpsPanel } from "./HubOpsPanel";
import { LatestReading } from "./LatestReading";
import { SbarCard } from "./SbarCard";
import { TrendChart } from "./TrendChart";
import {
  TREND_METRICS,
  TREND_WINDOW_DAYS,
  buildTrendSeries,
} from "./trend-series";

type CallActionState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

function useLiveCallActive(): boolean {
  return useSyncExternalStore(
    subscribeLiveCall,
    () => getLiveCall().active,
    () => false,
  );
}

function liveHref(patientId: string, tab: ChartTabId): string {
  const base = chartTabHref(patientId, tab);
  return base.includes("?") ? `${base}&live=1` : `${base}?live=1`;
}

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

export function PatientChart({
  patient,
  patients,
  nowIso,
  callStageProps,
  initialTab,
  initialLiveFocus,
}: {
  patient: RosterPatient;
  /** Other panel patients — compact switcher only (not a side table). */
  patients: RosterPatient[];
  nowIso: string;
  callStageProps: LoadedCallStageProps;
  initialTab: ChartTabId;
  initialLiveFocus: boolean;
}) {
  const router = useRouter();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const liveActive = useLiveCallActive();
  const [focusLive, setFocusLive] = useState(initialLiveFocus);
  const [activeTab, setActiveTab] = useState<ChartTabId>(initialTab);
  const [callState, setCallState] = useState<CallActionState>({ kind: "idle" });
  const [opsOpen, setOpsOpen] = useState(false);
  const prevLiveActive = useRef(liveActive);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (initialLiveFocus && liveActive) {
      setFocusLive(true);
    }
  }, [initialLiveFocus, liveActive]);

  useEffect(() => {
    if (liveActive && !prevLiveActive.current) {
      setFocusLive(true);
    }
    if (!liveActive) {
      setFocusLive(false);
    }
    prevLiveActive.current = liveActive;
  }, [liveActive]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#ops") {
      setOpsOpen(true);
    }
    const onHash = () => {
      if (window.location.hash === "#ops") setOpsOpen(true);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

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
      setFocusLive(true);
      router.replace(liveHref(patient.id, activeTab));
    } catch {
      setCallState({ kind: "error", message: "Could not reach /api/call." });
    }
  }, [activeTab, patient.id, router]);

  const showChart = useCallback(() => {
    setFocusLive(false);
    router.replace(chartTabHref(patient.id, activeTab));
  }, [activeTab, patient.id, router]);

  const latest = patient.latest;
  const envelope = patient.phase.normalEnvelope;
  const history = [...patient.checkins].reverse();
  const trendInputs = patient.checkins.map((checkin) => ({
    dayPostOp: checkin.dayPostOp,
    vitals: checkin.vitals,
    symptoms: checkin.symptoms,
  }));

  const showLivePane = liveActive && focusLive;

  return (
    <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pt-8 pb-2">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-heading text-ink">{patient.name}</h1>
              <SeverityChip level={latest.decision.level} size="sm" />
            </div>
            <p className="numeric flex flex-wrap items-baseline gap-x-3 gap-y-1 text-label text-ink-secondary">
              <span>{patient.age}</span>
              <span aria-hidden="true" className="text-ink-tertiary">
                ·
              </span>
              <span>{patient.procedure}</span>
              <span aria-hidden="true" className="text-ink-tertiary">
                ·
              </span>
              <span className="font-medium text-ink">Day {patient.dayPostOp}</span>
              <span aria-hidden="true" className="text-ink-tertiary">
                ·
              </span>
              <span>{patient.phase.name}</span>
              <span aria-hidden="true" className="text-ink-tertiary">
                ·
              </span>
              <span className="text-ink-tertiary">
                surgery {fullDate(patient.surgeryDate)}
              </span>
            </p>
            <p className="numeric text-meta text-ink-tertiary">
              Caregiver on file: {patient.caregiver} · {patient.openEscalations}{" "}
              open escalation{patient.openEscalations === 1 ? "" : "s"} ·{" "}
              {patient.closedEscalations} reviewed
            </p>
          </div>
          <div className="flex w-full max-w-xl flex-col gap-2 sm:w-auto sm:items-end">
            <p className="max-w-sm text-meta text-ink-secondary sm:text-right">
              <span className="font-medium text-ink">Twilio trial:</span> answer on
              speaker, then <span className="font-medium text-ink">press any key</span>{" "}
              when you hear the trial message.
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <label className="sr-only" htmlFor="patient-switcher">
                Switch patient
              </label>
              <select
                id="patient-switcher"
                value={patient.id}
                onChange={(e) => {
                  router.push(chartTabHref(e.target.value, activeTab));
                }}
                className="min-h-11 max-w-[14rem] rounded-md border border-line bg-raised px-3 text-label text-ink"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Link
                href="/clinician/patients"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-label text-ink-secondary hover:bg-wash"
              >
                <Users aria-hidden="true" className="size-4" />
                All patients
              </Link>
              <Link
                href="/family"
                className="inline-flex min-h-11 items-center rounded-md border border-line px-4 text-label text-ink-secondary hover:bg-wash"
              >
                Family view
              </Link>
              <Button
                type="button"
                onClick={() => void callNow()}
                disabled={callState.kind === "pending"}
                className="min-h-11"
              >
                {callState.kind === "pending" ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Phone aria-hidden="true" className="size-4" />
                )}
                Call now
              </Button>
            </div>
            <CallStatus state={callState} />
          </div>
        </div>

        {showLivePane ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-label font-medium text-ink">Live check-in</p>
              <Button
                type="button"
                variant="outline"
                onClick={showChart}
                className="min-h-11"
              >
                Show chart
              </Button>
            </div>
            <CallStage {...callStageProps} variant="hub" />
          </div>
        ) : (
          <>
            <div
              role="tablist"
              aria-label="Patient chart sections"
              className="flex flex-wrap gap-1 border-b border-line"
            >
              {CHART_TABS.map((tab) => {
                const current = tab.id === activeTab;
                return (
                  <Link
                    key={tab.id}
                    href={chartTabHref(patient.id, tab.id)}
                    role="tab"
                    aria-current={current ? "page" : undefined}
                    aria-selected={current}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "inline-flex min-h-11 items-center border-b-2 px-3 text-label transition-colors",
                      current
                        ? "border-ink font-medium text-ink"
                        : "border-transparent text-ink-secondary hover:text-ink",
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>

            <div role="tabpanel" className="space-y-6 pt-2">
              {activeTab === "overview" ? (
                <div className="space-y-5">
                  <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                    <SeverityPanel
                      level={latest.decision.level}
                      headline={latest.decision.condition ?? undefined}
                      className="self-start"
                    >
                      <p className="font-serif text-lede leading-snug text-ink-secondary">
                        {latest.decision.action}
                      </p>
                      <p className="numeric text-meta">
                        Day {latest.dayPostOp} check-in at {clockTime(latest.at)} ·{" "}
                        {timeAgo(latest.at, now)} · fired{" "}
                        {latest.decision.firedRules.join(", ") || "no rule"}
                      </p>
                    </SeverityPanel>

                    <Panel className="self-start p-5">
                      <SectionHeading
                        title="Latest reading"
                        meta={`day ${latest.dayPostOp} · ${patient.phase.name}`}
                      />
                      <div className="pt-3">
                        <LatestReading
                          vitals={latest.vitals}
                          ecg={latest.ecg}
                          phase={patient.phase}
                          painScore={latest.symptoms.painScore}
                          callSeconds={latest.callSeconds}
                        />
                      </div>
                    </Panel>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-3">
                    <Panel className="space-y-3 p-5">
                      <SectionHeading
                        title="Envelope in force"
                        meta={patient.phase.name}
                      />
                      <dl className="space-y-1.5">
                        {[
                          ["Heart rate", `≤ ${envelope.hrMax} bpm`],
                          ["Oxygen saturation", `≥ ${envelope.spo2Min}%`],
                          ["Temperature", `≤ ${envelope.tempCMax.toFixed(1)} °C`],
                          [
                            "Tachycardia threshold",
                            `> ${envelope.hrMax + 10} bpm (hrMax + 10)`,
                          ],
                          [
                            "PE oxygen floor",
                            `< ${envelope.spo2Min - 2}% (spo2Min − 2)`,
                          ],
                          [
                            "Phase days",
                            `${patient.phase.dayStart}–${patient.phase.dayEnd}`,
                          ],
                        ].map(([term, value]) => (
                          <div
                            key={term}
                            className="flex items-baseline justify-between gap-3 border-b border-line py-1 last:border-b-0"
                          >
                            <dt className="text-meta text-ink-secondary">{term}</dt>
                            <dd className="numeric text-meta font-medium text-ink">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <p className="text-meta text-ink-tertiary">
                        <span className="uppercase tracking-[0.14em]">Source</span>{" "}
                        <span className="italic">{envelope.source}</span>
                      </p>
                    </Panel>

                    <Panel className="space-y-3 p-5">
                      <SectionHeading
                        title="Rehab this phase"
                        meta={patient.phase.weightBearing}
                      />
                      <ul className="space-y-1.5">
                        {patient.phase.rehab.map((item) => (
                          <li
                            key={item}
                            className="border-b border-line py-1 text-label text-ink-secondary last:border-b-0"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </Panel>

                    <Panel className="space-y-3 p-5">
                      <SectionHeading
                        title="Precautions"
                        meta="reinforced on every call"
                      />
                      <ul className="space-y-1.5">
                        {patient.phase.precautions.map((item) => (
                          <li
                            key={item}
                            className="border-b border-line py-1 text-label text-ink-secondary last:border-b-0"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </Panel>
                  </div>
                </div>
              ) : null}

              {activeTab === "readings" ? (
                <div className="space-y-4">
                  <SectionHeading
                    title="Trends against the phase envelope"
                    meta={`${Math.min(patient.checkins.length, TREND_WINDOW_DAYS)} days · ${patient.phase.name}`}
                  />
                  <p className="max-w-4xl text-label text-ink-secondary">
                    The shaded band is the recovery graph&apos;s envelope for each
                    individual day, so a breach is visible rather than asserted — and
                    where the phase changes, the band steps with it under an otherwise
                    unchanged patient. A chart can also be flagged with no breach at all:
                    that is the trend engine, escalating on the slope of a line that never
                    leaves the band.
                  </p>
                  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                    {TREND_METRICS.map((metric) => (
                      <TrendChart
                        key={metric}
                        series={buildTrendSeries(trendInputs, metric)}
                        trend={latest.trendFindings.find((f) => f.metric === metric)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {activeTab === "handoff" ? (
                <div className="space-y-5">
                  <Panel className="p-5">
                    <SectionHeading
                      title="SBAR handoff"
                      meta={`generated for day ${latest.dayPostOp}`}
                    />
                    <div className="pt-4">
                      <SbarCard sbar={latest.sbar} patientName={patient.name} />
                    </div>
                  </Panel>
                  <ChartNotes patientId={patient.id} patientName={patient.name} />
                </div>
              ) : null}

              {activeTab === "billing" ? (
                <div className="space-y-4">
                  <SectionHeading
                    title="Billing capture"
                    meta={`RPM and RTM · period ${patient.billing.periodStart} to ${patient.billing.periodEnd}`}
                  />
                  <p className="max-w-4xl text-label text-ink-secondary">
                    A daily voice check-in that records a physiologic reading and logs
                    review time is already doing the work these codes reimburse. Grayscale
                    on purpose: an unmet billing threshold is not a clinical event and must
                    not compete with a red row for the same attention.
                  </p>
                  <Panel className="overflow-hidden">
                    <BillingPanel period={patient.billing} />
                  </Panel>
                </div>
              ) : null}

              {activeTab === "audit" ? (
                <div className="space-y-4">
                  <SectionHeading
                    title="Check-in history and audit trail"
                    meta={`${patient.checkins.length} check-ins · newest first`}
                  />
                  <p className="max-w-4xl text-label text-ink-secondary">
                    Every decision expands to the rule that produced it, the exact input
                    values that rule read, and the provenance of every threshold it
                    compared them against.
                  </p>
                  <Panel className="overflow-hidden">
                    {history.map((checkin, index) => (
                      <DecisionAudit
                        key={checkin.id}
                        checkin={checkin}
                        patientId={patient.id}
                        now={now}
                        defaultOpen={index === 0}
                      />
                    ))}
                  </Panel>
                </div>
              ) : null}
            </div>
          </>
        )}

        <section id="ops" className="scroll-mt-24 space-y-4 border-t border-line pt-8">
          <details
            open={opsOpen}
            onToggle={(e) => setOpsOpen((e.target as HTMLDetailsElement).open)}
            className="group"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-lg border border-line bg-raised px-4 py-3 text-label font-medium text-ink shadow-card marker:content-none [&::-webkit-details-marker]:hidden">
              <span>Ops — scenario, vitals, ECG, BLE, transcript</span>
              <span className="numeric text-meta font-normal text-ink-tertiary group-open:hidden">
                Show
              </span>
              <span className="numeric hidden text-meta font-normal text-ink-tertiary group-open:inline">
                Hide
              </span>
            </summary>
            <div className="pt-5">
              <HubOpsPanel />
            </div>
          </details>
        </section>
    </div>
  );
}
