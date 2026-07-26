import type { VoiceBiomarkersRecord } from "@/lib/amplifier/types";
import type { LiveCallSession } from "./live-session";

const MAX_SUMMARY_CHARS = 120;

export type CallLogRow = {
  id: string;
  at: string;
  dayPostOp?: number;
  summary: string;
  decisionLevel?: "green" | "amber" | "red";
  biomarkersStatus?: VoiceBiomarkersRecord["status"];
  biomarkersPhase?: VoiceBiomarkersRecord["phase"];
  inProgress: boolean;
  conversationId?: string;
};

type CheckinLike = {
  id: string;
  created_at: string;
  day_post_op?: number | null;
  transcript?: string | null;
  decision?: { level?: string } | null;
  voice_biomarkers?: VoiceBiomarkersRecord | null;
};

function truncateSummary(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_SUMMARY_CHARS) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_SUMMARY_CHARS - 1)}…`;
}

function parseDecisionLevel(level?: string): CallLogRow["decisionLevel"] {
  if (level === "green" || level === "amber" || level === "red") {
    return level;
  }
  return undefined;
}

function summaryFromTurns(turns: LiveCallSession["turns"]): string {
  if (turns.length === 0) {
    return "Call in progress";
  }
  return truncateSummary(turns.map((turn) => turn.text).join(" "));
}

function rowFromCheckin(checkin: CheckinLike): CallLogRow {
  const biomarkers = checkin.voice_biomarkers ?? undefined;
  return {
    id: checkin.id,
    at: checkin.created_at,
    ...(typeof checkin.day_post_op === "number" ? { dayPostOp: checkin.day_post_op } : {}),
    summary: truncateSummary(checkin.transcript ?? ""),
    decisionLevel: parseDecisionLevel(checkin.decision?.level),
    ...(biomarkers?.status ? { biomarkersStatus: biomarkers.status } : {}),
    ...(biomarkers?.phase ? { biomarkersPhase: biomarkers.phase } : {}),
    inProgress: false,
    ...(biomarkers?.conversationId ? { conversationId: biomarkers.conversationId } : {}),
  };
}

function rowFromActiveSession(session: LiveCallSession): CallLogRow {
  const biomarkers = session.biomarkers ?? undefined;
  return {
    id: session.conversationId,
    at: session.startedAt,
    summary: summaryFromTurns(session.turns),
    ...(biomarkers?.status ? { biomarkersStatus: biomarkers.status } : {}),
    ...(biomarkers?.phase ? { biomarkersPhase: biomarkers.phase } : {}),
    inProgress: true,
    conversationId: session.conversationId,
  };
}

export function callLogFromCheckins(checkins: CheckinLike[]): CallLogRow[] {
  return checkins.map(rowFromCheckin);
}

export function prependActiveSession(
  rows: CallLogRow[],
  session: LiveCallSession | null,
): CallLogRow[] {
  if (session?.status !== "active") {
    return rows;
  }
  return [rowFromActiveSession(session), ...rows];
}
