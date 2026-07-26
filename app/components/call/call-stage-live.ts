import type { CallLogRow } from "@/lib/telephony/call-log";
import type { LiveCallFeed } from "./use-live-call-feed";
import { liveTurnsToEvents } from "./live-turns";
import type { CallEvent } from "./timeline";

/** True when an active/finalizing session has at least one turn to render. */
export function hasLiveTranscript(feed: LiveCallFeed): boolean {
  if (feed.status !== "active" && feed.status !== "finalizing") {
    return false;
  }
  return (feed.session?.turns.length ?? 0) > 0;
}

/**
 * Prefer live turns over the scripted fixture once the first live turn arrives
 * during an active or finalizing session; otherwise keep the fixture events.
 */
export function transcriptEventsForStage(
  scriptedEvents: CallEvent[],
  feed: LiveCallFeed,
): CallEvent[] {
  if (!hasLiveTranscript(feed) || !feed.session) {
    return scriptedEvents;
  }
  return liveTurnsToEvents(feed.session.turns);
}

/** Past-call rows for the compact log (excludes the in-progress live row). */
export function compactCallLogRows(rows: CallLogRow[]): CallLogRow[] {
  return rows.filter((row) => !row.inProgress);
}
