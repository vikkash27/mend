import type { LiveTurn } from "@/lib/telephony/live-session";
import type { CallEvent, Speaker } from "./timeline";

function roleToSpeaker(role: LiveTurn["role"]): Speaker {
  return role === "agent" ? "mend" : "margaret";
}

function baseTimestampMs(turns: LiveTurn[]): number | null {
  for (const turn of turns) {
    if (!turn.at) {
      continue;
    }
    const parsed = Date.parse(turn.at);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

function turnAtSeconds(turns: LiveTurn[], index: number): number {
  const turn = turns[index];
  const baseMs = baseTimestampMs(turns);

  if (turn?.at && baseMs !== null) {
    const parsed = Date.parse(turn.at);
    if (!Number.isNaN(parsed)) {
      return (parsed - baseMs) / 1000;
    }
  }

  return index * 5;
}

export function liveTurnsToEvents(turns: LiveTurn[]): CallEvent[] {
  return turns.map((turn, index) => ({
    id: `live-${index}`,
    kind: "turn" as const,
    at: turnAtSeconds(turns, index),
    speaker: roleToSpeaker(turn.role),
    text: turn.text,
  }));
}
