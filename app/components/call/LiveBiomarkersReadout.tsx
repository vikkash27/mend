import { SeverityChip } from "@/components/ui/severity-chip";
import type { VoiceBiomarkersRecord } from "@/lib/amplifier/types";
import { cn } from "@/lib/utils";
import {
  voiceLevelLabel,
  voiceLevelSeverity,
  voiceStatusPresentation,
} from "@/app/components/clinician/VoiceBiomarkersPanel";

const LABEL = "text-eyebrow font-medium uppercase";

function phaseLabel(phase: VoiceBiomarkersRecord["phase"]): string | null {
  if (phase === "during") return "during call";
  if (phase === "final") return "final";
  return null;
}

/**
 * Compact Amplifier voice-biomarker strip for the CallStage clinical column.
 * Matches LiveVitals density: eyebrow + numeric + SeverityChip, no card stack.
 */
export function LiveBiomarkersReadout({
  record,
  className,
}: {
  record: VoiceBiomarkersRecord;
  className?: string;
}) {
  const phase = phaseLabel(record.phase);
  const status = voiceStatusPresentation(record.status);
  const mapped = record.mapped;

  return (
    <div className={cn("space-y-4 border-t border-line pt-5", className)}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={cn(LABEL, "text-ink-tertiary")}>Amplifier readout</p>
        {phase ? (
          <p className="numeric text-meta text-ink-tertiary">{phase}</p>
        ) : null}
      </header>

      {record.status === "ready" && mapped ? (
        <div className="space-y-3">
          <DomainLine
            label="Respiratory"
            level={mapped.respiratory.level}
            score={mapped.respiratory.score}
          />
          <DomainLine
            label="Cognitive"
            level={mapped.cognitive.level}
            score={mapped.cognitive.score}
          />
          <p className="numeric text-meta text-ink-tertiary">
            Quality {mapped.quality}
            {mapped.overallLevel ? ` · overall ${mapped.overallLevel}` : ""}
          </p>
        </div>
      ) : (
        <p className="text-meta text-ink-secondary">{status.description}</p>
      )}
    </div>
  );
}

function DomainLine({
  label,
  level,
  score,
}: {
  label: string;
  level: NonNullable<VoiceBiomarkersRecord["mapped"]>["respiratory"]["level"];
  score?: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <p className="font-serif text-lede leading-snug text-ink">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityChip
          level={voiceLevelSeverity(level)}
          label={voiceLevelLabel(level)}
          size="sm"
        />
        {score !== undefined ? (
          <span className="numeric text-meta text-ink-tertiary">
            {score.toFixed(2)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
