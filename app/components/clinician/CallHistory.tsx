"use client";

import { SeverityChip } from "@/components/ui/severity-chip";
import type { VoiceBiomarkersRecord } from "@/lib/amplifier/types";
import type { CheckinRecord } from "@/lib/sim/roster";
import { cn } from "@/lib/utils";
import { Panel, SectionHeading } from "./ClinicianShell";
import { callLength, clockTime, timeAgo } from "./format";
import { voiceStatusPresentation } from "./VoiceBiomarkersPanel";

const MAX_SUMMARY_CHARS = 120;

export type ChartCallRow = {
  id: string;
  at: string;
  dayPostOp?: number;
  summary: string;
  decisionLevel?: "green" | "amber" | "red";
  biomarkersStatus?: VoiceBiomarkersRecord["status"];
  biomarkersPhase?: VoiceBiomarkersRecord["phase"];
  callSeconds?: number;
  inProgress: boolean;
};

type LiveSessionLike = {
  conversationId: string;
  patientId: string;
  callStatus: "active" | "finalizing" | "completed" | "error";
  turns: Array<{ role: "agent" | "user"; text: string; at?: string }>;
  biomarkers: VoiceBiomarkersRecord | null;
  updatedAt: string;
};

function truncateSummary(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_SUMMARY_CHARS) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_SUMMARY_CHARS - 1)}…`;
}

function summaryFromTurns(turns: LiveSessionLike["turns"]): string {
  if (turns.length === 0) {
    return "Call in progress";
  }
  return truncateSummary(turns.map((turn) => turn.text).join(" "));
}

function phaseLabel(phase?: VoiceBiomarkersRecord["phase"]): string | null {
  if (phase === "during") return "during";
  if (phase === "final") return "final";
  return null;
}

/** Newest-first call rows from roster check-ins. */
export function callHistoryRowsFromCheckins(
  checkins: CheckinRecord[],
): ChartCallRow[] {
  return [...checkins].reverse().map((checkin) => {
    const biomarkers = checkin.voiceBiomarkers;
    return {
      id: checkin.id,
      at: checkin.at,
      dayPostOp: checkin.dayPostOp,
      summary: truncateSummary(checkin.said),
      decisionLevel: checkin.decision.level,
      ...(biomarkers?.status ? { biomarkersStatus: biomarkers.status } : {}),
      ...(biomarkers?.phase ? { biomarkersPhase: biomarkers.phase } : {}),
      callSeconds: checkin.callSeconds,
      inProgress: false,
    };
  });
}

/**
 * While a live session is active/finalizing for this patient, put an
 * in-progress row at the top of the call list.
 */
export function withLiveInProgressRow(
  rows: ChartCallRow[],
  args: {
    patientId: string;
    session: LiveSessionLike | null;
  },
): ChartCallRow[] {
  const { patientId, session } = args;
  if (!session || session.patientId !== patientId) {
    return rows;
  }
  if (session.callStatus !== "active" && session.callStatus !== "finalizing") {
    return rows;
  }

  const biomarkers = session.biomarkers ?? undefined;
  const liveRow: ChartCallRow = {
    id: session.conversationId,
    at: session.updatedAt,
    summary: summaryFromTurns(session.turns),
    ...(biomarkers?.status ? { biomarkersStatus: biomarkers.status } : {}),
    ...(biomarkers?.phase ? { biomarkersPhase: biomarkers.phase } : {}),
    inProgress: true,
  };

  return [liveRow, ...rows];
}

/**
 * Bind VoiceBiomarkersPanel to live session biomarkers for this patient
 * (during-call or post-call final on the session). Fall back to the latest
 * check-in's record when there is no matching session payload.
 */
export function resolveChartVoiceBiomarkers(args: {
  patientId: string;
  latestCheckin?: Pick<CheckinRecord, "voiceBiomarkers"> | null;
  session: Pick<LiveSessionLike, "patientId" | "biomarkers"> | null;
}): VoiceBiomarkersRecord | undefined {
  const { patientId, latestCheckin, session } = args;
  if (session && session.patientId === patientId && session.biomarkers) {
    return session.biomarkers;
  }
  return latestCheckin?.voiceBiomarkers;
}

function CallHistoryRowView({
  row,
  now,
}: {
  row: ChartCallRow;
  now: Date;
}) {
  const status = row.biomarkersStatus
    ? voiceStatusPresentation(row.biomarkersStatus)
    : null;
  const phase = phaseLabel(row.biomarkersPhase);

  return (
    <li
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-b-0",
        row.inProgress && "bg-wash/80",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-label text-ink-secondary">
          {row.inProgress ? (
            <span className="font-medium text-ink">In progress · </span>
          ) : null}
          {row.summary || "No transcript summary"}
        </p>
        <p className="numeric text-meta text-ink-tertiary">
          {typeof row.dayPostOp === "number" ? `Day ${row.dayPostOp} · ` : ""}
          {clockTime(row.at)} · {timeAgo(row.at, now)}
          {typeof row.callSeconds === "number"
            ? ` · ${callLength(row.callSeconds)}`
            : row.inProgress
              ? " · live"
              : ""}
          {status ? ` · voice ${status.label.toLowerCase()}` : ""}
          {phase ? ` · ${phase}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {row.decisionLevel ? (
          <SeverityChip level={row.decisionLevel} size="sm" />
        ) : row.inProgress ? (
          <span className="text-meta font-medium text-ink-secondary">Live</span>
        ) : null}
      </div>
    </li>
  );
}

export function CallHistory({
  checkins,
  patientId,
  now,
  session = null,
  className,
}: {
  checkins: CheckinRecord[];
  patientId: string;
  now: Date;
  session?: LiveSessionLike | null;
  className?: string;
}) {
  const rows = withLiveInProgressRow(callHistoryRowsFromCheckins(checkins), {
    patientId,
    session,
  });

  if (rows.length === 0) {
    return null;
  }

  return (
    <Panel className={cn("overflow-hidden", className)}>
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <SectionHeading
          title="Calls"
          meta={`${rows.length} · newest first`}
        />
      </div>
      <ul aria-label="Call history">
        {rows.map((row) => (
          <CallHistoryRowView key={row.id} row={row} now={now} />
        ))}
      </ul>
    </Panel>
  );
}
