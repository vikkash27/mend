"use client";

import {
  AlertTriangle,
  ChevronDown,
  Loader2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { BleHeartRate } from "@/app/components/BleHeartRate";
import { Button } from "@/components/ui/button";
import type { EcgDetermination, EcgReading } from "@/lib/clinical/types";
import { PLAUSIBLE_RANGES, validateManualVitals } from "@/lib/clinical/vitals";
import { SCENARIO_META, SCENARIOS } from "@/lib/sim/active-scenario";
import type { Scenario } from "@/lib/sim/fixtures";
import { captureHref } from "@/lib/ui/capture-route";
import { cn } from "@/lib/utils";

interface DemoStatus {
  anthropic: boolean;
  supabase: boolean;
  elevenlabs: boolean;
  twilio: boolean;
  demoPatientPhone: boolean;
  amplifier: boolean;
  missing: string[];
}

type ActionState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

const ECG_LABELS: Record<EcgDetermination, string> = {
  normal_sinus_rhythm: "Normal sinus rhythm",
  atrial_fibrillation: "Atrial fibrillation",
  tachycardia: "Tachycardia",
  bradycardia: "Bradycardia",
  unclassified: "Unclassified",
};

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "space-y-4 rounded-md border-2 border-line-strong bg-raised p-5",
        className,
      )}
    >
      <h3 className="eyebrow">{title}</h3>
      {children}
    </section>
  );
}

function StatusLine({ state }: { state: ActionState }) {
  if (state.kind === "idle") return null;
  if (state.kind === "pending") {
    return (
      <p className="flex items-center gap-2 text-label text-ink-secondary">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        Working…
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

function parseNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const json: unknown = await res.json();
    if (
      typeof json === "object" &&
      json !== null &&
      "error" in json &&
      typeof (json as { error: unknown }).error === "string"
    ) {
      return (json as { error: string }).error;
    }
    if (
      typeof json === "object" &&
      json !== null &&
      "reason" in json &&
      typeof (json as { reason: unknown }).reason === "string"
    ) {
      return (json as { reason: string }).reason;
    }
  } catch {
    // fall through
  }
  return `Request failed (${res.status}).`;
}

export function PatientCapture(props: {
  patientId: string;
  density: "full" | "strip";
  /** Optional patient display for full header */
  patientName?: string;
  dayPostOp?: number;
  procedure?: string;
}) {
  const { patientId, density, patientName, dayPostOp, procedure } = props;
  const formId = useId();
  const [scenario, setScenario] = useState<Scenario>("green");
  const [scenarioState, setScenarioState] = useState<ActionState>({ kind: "idle" });
  const [status, setStatus] = useState<DemoStatus | null>(null);

  const [spo2, setSpo2] = useState("");
  const [sbp, setSbp] = useState("");
  const [dbp, setDbp] = useState("");
  const [tempC, setTempC] = useState("");
  const [vitalsState, setVitalsState] = useState<ActionState>({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"spo2" | "sbp" | "dbp" | "tempC", string>>
  >({});

  const [ecgState, setEcgState] = useState<ActionState>({ kind: "idle" });
  const [ecgReading, setEcgReading] = useState<EcgReading | null>(null);
  const [stripOpen, setStripOpen] = useState(false);

  useEffect(() => {
    if (density !== "full") return;
    let cancelled = false;
    void (async () => {
      try {
        const [scenarioRes, statusRes] = await Promise.all([
          fetch("/api/scenario"),
          fetch("/api/demo-status"),
        ]);
        if (cancelled) return;
        if (scenarioRes.ok) {
          const json = (await scenarioRes.json()) as { scenario: Scenario };
          setScenario(json.scenario);
        }
        if (statusRes.ok) {
          setStatus((await statusRes.json()) as DemoStatus);
        }
      } catch {
        if (!cancelled) {
          setStatus({
            anthropic: false,
            supabase: false,
            elevenlabs: false,
            twilio: false,
            demoPatientPhone: false,
            amplifier: false,
            missing: ["Unable to reach /api/demo-status"],
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [density]);

  const selectScenario = useCallback(async (next: Scenario) => {
    setScenarioState({ kind: "pending" });
    try {
      const res = await fetch("/api/scenario", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario: next }),
      });
      if (!res.ok) {
        setScenarioState({ kind: "error", message: await readErrorMessage(res) });
        return;
      }
      setScenario(next);
      setScenarioState({
        kind: "ok",
        message: `Care pathway is now ${SCENARIO_META[next].label}. Check-in and triage will use these fixture vitals when Supabase has no rows.`,
      });
    } catch {
      setScenarioState({
        kind: "error",
        message: "Could not reach /api/scenario. Is the dev server running?",
      });
    }
  }, []);

  const submitVitals = useCallback(async () => {
    const parsed = {
      spo2: parseNumber(spo2),
      sbp: parseNumber(sbp),
      dbp: parseNumber(dbp),
      tempC: parseNumber(tempC),
    };

    for (const [field, value] of Object.entries(parsed) as Array<
      [keyof typeof parsed, number | undefined]
    >) {
      if (value !== undefined && Number.isNaN(value)) {
        setFieldErrors({ [field]: "Enter a number." });
        setVitalsState({ kind: "error", message: "Fix the highlighted fields before saving." });
        return;
      }
    }

    const validation = validateManualVitals(parsed);
    setFieldErrors(validation.errors);
    if (!validation.ok) {
      setVitalsState({
        kind: "error",
        message: "Fix the highlighted fields before saving.",
      });
      return;
    }

    if (
      parsed.spo2 === undefined &&
      parsed.sbp === undefined &&
      parsed.dbp === undefined &&
      parsed.tempC === undefined
    ) {
      setVitalsState({
        kind: "error",
        message: "Enter at least one of SpO₂, blood pressure, or temperature.",
      });
      return;
    }

    setVitalsState({ kind: "pending" });
    try {
      const res = await fetch("/api/vitals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          source: "manual",
          quality: "ok",
          deviceLabel: "Capture (operator)",
          patientId,
          ...parsed,
        }),
      });
      if (!res.ok) {
        setVitalsState({ kind: "error", message: await readErrorMessage(res) });
        return;
      }
      const json = (await res.json()) as { persisted?: boolean };
      setVitalsState({
        kind: "ok",
        message: json.persisted
          ? "Vitals saved."
          : "Vitals accepted but not persisted — Supabase credentials are missing (NEXT_PUBLIC_SUPABASE_URL / key).",
      });
    } catch {
      setVitalsState({
        kind: "error",
        message: "Could not reach /api/vitals.",
      });
    }
  }, [spo2, sbp, dbp, tempC, patientId]);

  const uploadEcg = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setEcgReading(null);
      setEcgState({ kind: "pending" });
      try {
        const body = new FormData();
        body.set("pdf", file);
        body.set("patientId", patientId);
        const res = await fetch("/api/ecg", { method: "POST", body });
        if (!res.ok) {
          setEcgState({ kind: "error", message: await readErrorMessage(res) });
          return;
        }
        const json = (await res.json()) as { reading: EcgReading; persisted?: boolean };
        setEcgReading(json.reading);
        const label = ECG_LABELS[json.reading.determination];
        const bpm =
          json.reading.bpm !== undefined ? `${json.reading.bpm} bpm` : "no BPM on report";
        setEcgState({
          kind: "ok",
          message: json.persisted
            ? `Extracted ${label} · ${bpm}.`
            : `Extracted ${label} · ${bpm}. Not persisted — Supabase credentials are missing.`,
        });
      } catch {
        setEcgState({ kind: "error", message: "Could not reach /api/ecg." });
      }
    },
    [patientId],
  );

  const vitalFields = (
    [
      {
        id: `${formId}-spo2`,
        label: "SpO₂",
        hint: `${PLAUSIBLE_RANGES.spo2.min}–${PLAUSIBLE_RANGES.spo2.max} %`,
        value: spo2,
        set: setSpo2,
        field: "spo2" as const,
        step: "1",
      },
      {
        id: `${formId}-temp`,
        label: "Temperature",
        hint: `${PLAUSIBLE_RANGES.tempC.min}–${PLAUSIBLE_RANGES.tempC.max} °C`,
        value: tempC,
        set: setTempC,
        field: "tempC" as const,
        step: "0.1",
      },
      {
        id: `${formId}-sbp`,
        label: "Systolic BP",
        hint: `${PLAUSIBLE_RANGES.sbp.min}–${PLAUSIBLE_RANGES.sbp.max} mmHg`,
        value: sbp,
        set: setSbp,
        field: "sbp" as const,
        step: "1",
      },
      {
        id: `${formId}-dbp`,
        label: "Diastolic BP",
        hint: `${PLAUSIBLE_RANGES.dbp.min}–${PLAUSIBLE_RANGES.dbp.max} mmHg`,
        value: dbp,
        set: setDbp,
        field: "dbp" as const,
        step: "1",
      },
    ] as const
  );

  const vitalsInputs = (
    <div className="grid gap-3 sm:grid-cols-2">
      {vitalFields.map((field) => (
        <label key={field.id} className="block space-y-1.5" htmlFor={field.id}>
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-label font-medium text-ink">{field.label}</span>
            <span className="numeric text-meta text-ink-tertiary">{field.hint}</span>
          </span>
          <input
            id={field.id}
            type="number"
            inputMode="decimal"
            step={field.step}
            value={field.value}
            onChange={(e) => field.set(e.target.value)}
            aria-invalid={fieldErrors[field.field] ? true : undefined}
            aria-describedby={
              fieldErrors[field.field] ? `${field.id}-err` : undefined
            }
            className={cn(
              "numeric h-11 w-full rounded-lg border bg-paper px-3 text-body text-ink",
              "outline-none focus-visible:border-ink focus-visible:ring-3 focus-visible:ring-ink/25",
              fieldErrors[field.field]
                ? "border-severity-red-border"
                : "border-line-strong",
            )}
          />
          {fieldErrors[field.field] ? (
            <span
              id={`${field.id}-err`}
              className="block text-meta text-severity-red-fg"
            >
              {fieldErrors[field.field]}
            </span>
          ) : null}
        </label>
      ))}
    </div>
  );

  const pdfChooser = (
    <label className="relative flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line-strong bg-paper px-4 py-3 hover:bg-wash">
      <Upload aria-hidden="true" className="size-4 shrink-0 text-ink-tertiary" />
      <span className="text-label text-ink">Choose PDF</span>
      <input
        type="file"
        accept="application/pdf,.pdf"
        aria-label="Choose Kardia PDF"
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          void uploadEcg(file);
          e.target.value = "";
        }}
      />
    </label>
  );

  if (density === "strip") {
    const actionError =
      vitalsState.kind === "error"
        ? vitalsState
        : ecgState.kind === "error"
          ? ecgState
          : vitalsState.kind === "ok"
            ? vitalsState
            : ecgState.kind === "ok" || ecgState.kind === "pending"
              ? ecgState
              : vitalsState.kind === "pending"
                ? vitalsState
                : ({ kind: "idle" } as ActionState);

    return (
      <section className="rounded-md border-2 border-line-strong bg-raised">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <button
            type="button"
            aria-expanded={stripOpen}
            aria-controls={`${formId}-capture-strip`}
            onClick={() => setStripOpen((open) => !open)}
            className="inline-flex min-h-11 items-center gap-2 text-left"
          >
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-4 shrink-0 text-ink transition-transform",
                stripOpen ? "rotate-0" : "-rotate-90",
              )}
            />
            <span className="eyebrow text-ink">Capture</span>
            <span className="text-meta text-ink-tertiary">
              Manual vitals · Kardia PDF
            </span>
          </button>
          <Link
            href={captureHref(patientId)}
            className="text-label font-medium text-ink underline-offset-4 hover:underline"
          >
            Open full capture
          </Link>
        </div>
        {stripOpen ? (
          <div
            id={`${formId}-capture-strip`}
            className="space-y-3 border-t-2 border-line-strong px-4 py-4"
          >
            {vitalsInputs}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() => void submitVitals()}
                disabled={vitalsState.kind === "pending"}
              >
                {vitalsState.kind === "pending" ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : null}
                Save vitals
              </Button>
              {pdfChooser}
            </div>
            <StatusLine state={actionError} />
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="font-heading text-heading text-ink">Capture</h2>
          {patientName || dayPostOp !== undefined || procedure ? (
            <p className="text-label text-ink-secondary">
              {[
                patientName,
                dayPostOp !== undefined ? `POD ${dayPostOp}` : null,
                procedure,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
        <Link
          href={`/clinician/${patientId}`}
          className="text-label font-medium text-ink underline-offset-4 hover:underline"
        >
          Back to chart
        </Link>
      </header>

      {status && status.missing.length > 0 ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-line bg-wash px-4 py-3.5"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-ink-tertiary"
          />
          <div className="min-w-0 space-y-1">
            <p className="text-label font-medium text-ink">
              Some services unavailable
            </p>
            <p className="numeric text-meta text-ink-secondary">
              {status.missing.join(" · ")}
            </p>
          </div>
        </div>
      ) : status ? (
        <p className="text-meta text-ink-tertiary" role="status">
          Services connected — Anthropic, Supabase, voice, phone.
        </p>
      ) : null}

      <div
        role="group"
        aria-label="Care pathway"
        className="grid gap-2 sm:grid-cols-3"
      >
        {SCENARIOS.map((key) => {
          const active = scenario === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => void selectScenario(key)}
              className={cn(
                "min-h-11 rounded-lg border px-3 py-2.5 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ink/25",
                active
                  ? "border-ink bg-ink text-paper"
                  : "border-line-strong bg-raised text-ink hover:bg-wash",
              )}
            >
              <span className="block text-label font-medium">
                {SCENARIO_META[key].label}
              </span>
              <span
                className={cn(
                  "mt-0.5 block text-meta leading-snug",
                  active ? "text-paper/75" : "text-ink-tertiary",
                )}
              >
                {SCENARIO_META[key].summary}
              </span>
            </button>
          );
        })}
      </div>
      <StatusLine state={scenarioState} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Manual vitals">
          <p className="text-label text-ink-secondary">
            SpO₂, blood pressure and temperature — operator&apos;s own device readings,
            labelled as such.
          </p>
          {vitalsInputs}
          <Button
            type="button"
            onClick={() => void submitVitals()}
            disabled={vitalsState.kind === "pending"}
          >
            {vitalsState.kind === "pending" ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            Save vitals
          </Button>
          <StatusLine state={vitalsState} />
        </Panel>

        <Panel title="Kardia PDF">
          <p className="text-label text-ink-secondary">
            Upload a KardiaMobile 6L PDF export. Claude extracts the FDA-cleared
            determination and BPM — Mend never re-derives rhythm from the waveform.
          </p>
          {pdfChooser}
          {ecgReading ? (
            <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-wash px-4 py-3">
              <div>
                <dt className="text-meta text-ink-tertiary">Determination</dt>
                <dd className="text-label font-medium text-ink">
                  {ECG_LABELS[ecgReading.determination]}
                </dd>
              </div>
              <div>
                <dt className="text-meta text-ink-tertiary">BPM</dt>
                <dd className="numeric text-label font-medium text-ink">
                  {ecgReading.bpm ?? "—"}
                </dd>
              </div>
            </dl>
          ) : null}
          <StatusLine state={ecgState} />
        </Panel>

        <div className="lg:col-span-2">
          <BleHeartRate />
        </div>
      </div>
    </div>
  );
}
