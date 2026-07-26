/**
 * Fetch conversation transcript and status from ElevenLabs ConvAI.
 *
 * Degrades gracefully: with ELEVENLABS_API_KEY absent, returns
 * `{ status: "unavailable" }` — never throws.
 */

import type { LiveTurn } from "./live-session";

const CONVERSATION_URL = (conversationId: string) =>
  `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`;

const ENDED_STATUSES = new Set(["done", "failed", "completed"]);

export type ConversationFetch = typeof fetch;

export type ConversationFetchResult =
  | {
      status: "ok";
      conversationId: string;
      callStatus: string;
      turns: LiveTurn[];
      ended: boolean;
    }
  | { status: "error"; reason: string }
  | { status: "unavailable"; reason: string };

type TranscriptEntry = {
  role?: unknown;
  message?: unknown;
};

type ConversationResponse = {
  conversation_id?: unknown;
  status?: unknown;
  transcript?: unknown;
};

async function safeReadText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}

function mapTranscriptToTurns(transcript: unknown): LiveTurn[] {
  if (!Array.isArray(transcript)) {
    return [];
  }

  const turns: LiveTurn[] = [];
  for (const entry of transcript) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const { role, message } = entry as TranscriptEntry;
    if (role !== "agent" && role !== "user") {
      continue;
    }
    if (typeof message !== "string" || message.length === 0) {
      continue;
    }
    turns.push({ role, text: message });
  }
  return turns;
}

/**
 * GETs conversation details. Never throws: missing key, non-OK response, and
 * network failures all return a typed result.
 */
export async function fetchConversationDetails(args: {
  conversationId: string;
  fetchImpl?: ConversationFetch;
  apiKey?: string;
}): Promise<ConversationFetchResult> {
  const apiKey =
    args.apiKey !== undefined ? args.apiKey : process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.warn(
      "[telephony] ELEVENLABS_API_KEY not set — conversation details fetch is disabled.",
    );
    return {
      status: "unavailable",
      reason: "ElevenLabs API key is not configured.",
    };
  }

  const fetchImpl = args.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(CONVERSATION_URL(args.conversationId), {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const detail = await safeReadText(response);
      console.warn(
        `[telephony] fetchConversationDetails: ElevenLabs responded with status ${response.status}.`,
      );
      return {
        status: "error",
        reason: `ElevenLabs conversation request failed with status ${response.status}${detail ? `: ${detail}` : ""}.`,
      };
    }

    const body = (await response.json()) as ConversationResponse;
    const callStatus =
      typeof body.status === "string" ? body.status : "unknown";
    const conversationId =
      typeof body.conversation_id === "string"
        ? body.conversation_id
        : args.conversationId;

    return {
      status: "ok",
      conversationId,
      callStatus,
      turns: mapTranscriptToTurns(body.transcript),
      ended: ENDED_STATUSES.has(callStatus),
    };
  } catch (err) {
    console.warn(
      "[telephony] fetchConversationDetails: request to ElevenLabs failed.",
      err,
    );
    return {
      status: "error",
      reason: err instanceof Error ? err.message : "Unknown error calling ElevenLabs.",
    };
  }
}
