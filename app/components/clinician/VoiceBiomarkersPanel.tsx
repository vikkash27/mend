import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { SeverityChip } from "@/components/ui/severity-chip";
import type {
  VoiceBiomarkersRecord,
  VoiceSignalLevel,
} from "@/lib/amplifier/types";
import type { Severity } from "@/lib/clinical/types";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./ClinicianShell";
import { clockTime } from "./format";

/**
 * Clinician-only voice biomarker readout for a check-in.
 *
 * Status and domain levels are always icon + text (never colour alone).
 * Family surfaces must not import this panel or biomarker jargon.
 */

export type VoiceStatusPresentation = {
  label: string;
  description: string;
  icon: LucideIcon;
  /** Tone classes — ink/paper; no severity fill for non-clinical status. */
  className: string;
};

const STATUS: Record<VoiceBiomarkersRecord["status"], VoiceStatusPresentation> =
  {
    pending: {
      label: "Pending",
      description: "Voice call analysis is still running.",
      icon: Clock,
      className: "text-ink-secondary",
    },
    ready: {
      label: "Ready",
      description: "Voice biomarker analysis complete.",
      icon: CheckCircle2,
      className: "text-ink",
    },
    error: {
      label: "Error",
      description: "Voice biomarker analysis failed.",
      icon: AlertTriangle,
      className: "text-severity-red-fg",
    },
    unavailable: {
      label: "Unavailable",
      description: "No usable voice biomarker result for this check-in.",
      icon: Ban,
      className: "text-ink-tertiary",
    },
  };

/** Map Amplifier signal levels onto Mend severity tokens for chip colour + icon.
 * High biomarkers are amber (not red) — red chips imply PE/urgent clinical severity. */
export function voiceLevelSeverity(level: VoiceSignalLevel): Severity {
  switch (level) {
    case "high":
    case "moderate":
      return "amber";
    case "low":
    case "unknown":
      return "green";
  }
}

export function voiceLevelLabel(level: VoiceSignalLevel): string {
  switch (level) {
    case "high":
      return "High";
    case "moderate":
      return "Moderate";
    case "low":
      return "Low";
    case "unknown":
      return "Unknown";
  }
}

export function voiceStatusPresentation(
  status: VoiceBiomarkersRecord["status"],
): VoiceStatusPresentation {
  return STATUS[status];
}

function DomainRow({
  label,
  level,
  score,
}: {
  label: string;
  level: VoiceSignalLevel;
  score?: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line py-3 last:border-b-0">
      <p className="text-meta text-ink-secondary">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityChip
          level={voiceLevelSeverity(level)}
          label={voiceLevelLabel(level)}
          size="sm"
        />
        {score !== undefined ? (
          <span className="numeric text-meta text-ink-tertiary">
            score {score.toFixed(2)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function VoiceBiomarkersPanel({
  record,
  className,
}: {
  record: VoiceBiomarkersRecord;
  className?: string;
}) {
  const status = voiceStatusPresentation(record.status);
  const StatusIcon = status.icon;
  const mapped = record.mapped;
  const phaseEyebrow =
    record.phase === "during"
      ? "During call"
      : record.phase === "final"
        ? "Final analysis"
        : null;

  return (
    <div className={cn("space-y-3", className)}>
      {phaseEyebrow ? <p className="eyebrow">{phaseEyebrow}</p> : null}
      <SectionHeading title="Voice biomarkers" meta="from voice call" />

      <div
        role="status"
        aria-label={`Voice biomarkers ${status.label}: ${status.description}`}
        className={cn(
          "flex items-start gap-2 rounded-md border border-line bg-wash px-3 py-2.5",
          status.className,
        )}
      >
        <StatusIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 space-y-0.5">
          <p className="text-label font-medium text-ink">
            Status: {status.label}
          </p>
          <p className="text-meta text-ink-secondary">{status.description}</p>
          {record.status === "error" && record.error ? (
            <p className="text-meta text-ink-secondary">{record.error}</p>
          ) : null}
        </div>
      </div>

      {record.status === "ready" && mapped ? (
        <div>
          <DomainRow
            label="Respiratory"
            level={mapped.respiratory.level}
            score={mapped.respiratory.score}
          />
          <DomainRow
            label="Cognitive"
            level={mapped.cognitive.level}
            score={mapped.cognitive.score}
          />
          <p className="numeric pt-3 text-meta text-ink-tertiary">
            Quality {mapped.quality}
            {mapped.overallLevel ? ` · overall ${mapped.overallLevel}` : ""}
            {record.analyzedAt
              ? ` · analyzed ${clockTime(record.analyzedAt)}`
              : ""}
            {" · from voice call"}
          </p>
        </div>
      ) : null}

      {record.status === "pending" ? (
        <p className="text-meta text-ink-tertiary">
          Respiratory and cognitive levels will appear here when the voice call
          analysis finishes.
        </p>
      ) : null}
    </div>
  );
}
