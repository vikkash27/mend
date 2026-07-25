/**
 * Fetch conversation audio bytes from ElevenLabs ConvAI.
 *
 * Degrades gracefully: with ELEVENLABS_API_KEY absent, logs one warning and
 * returns `{ status: "skipped" }` — never throws, so teammates without
 * credentials can still exercise the rest of the app.
 */

const AUDIO_URL = (conversationId: string) =>
  `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`;

export type RecordingFetch = typeof fetch;

export type FetchConversationAudioResult =
  | { status: "ok"; bytes: Uint8Array; contentType: string }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string };

async function safeReadText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}

/**
 * GETs conversation audio. Never throws: missing key, non-OK response, and
 * network failures all return a typed result.
 */
export async function fetchConversationAudio(args: {
  conversationId: string;
  fetchImpl?: RecordingFetch;
}): Promise<FetchConversationAudioResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.warn(
      "[telephony] ELEVENLABS_API_KEY not set — conversation audio fetch is disabled.",
    );
    return {
      status: "skipped",
      reason: "ElevenLabs API key is not configured.",
    };
  }

  const fetchImpl = args.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(AUDIO_URL(args.conversationId), {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const detail = await safeReadText(response);
      console.warn(
        `[telephony] fetchConversationAudio: ElevenLabs responded with status ${response.status}.`,
      );
      return {
        status: "error",
        reason: `ElevenLabs conversation audio request failed with status ${response.status}${detail ? `: ${detail}` : ""}.`,
      };
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("Content-Type") ?? "audio/mpeg";
    return {
      status: "ok",
      bytes: new Uint8Array(buffer),
      contentType,
    };
  } catch (err) {
    console.warn("[telephony] fetchConversationAudio: request to ElevenLabs failed.", err);
    return {
      status: "error",
      reason: err instanceof Error ? err.message : "Unknown error calling ElevenLabs.",
    };
  }
}
