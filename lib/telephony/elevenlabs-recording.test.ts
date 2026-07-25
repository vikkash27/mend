import { afterEach, describe, expect, it, vi } from "vitest";

type RecordingFetch = typeof fetch;

async function freshModule() {
  vi.resetModules();
  return import("./elevenlabs-recording");
}

/** Fake fetch — never make a real network call in tests. */
function fakeFetch(handler: (url: string, init: RequestInit) => Response): RecordingFetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    return handler(String(input), init ?? {});
  }) as RecordingFetch;
}

describe("fetchConversationAudio", () => {
  afterEach(() => {
    delete process.env.ELEVENLABS_API_KEY;
  });

  it("returns skipped when ELEVENLABS_API_KEY is missing and never calls fetch", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchConversationAudio } = await freshModule();
    const fetchSpy = vi.fn();

    const result = await fetchConversationAudio({
      conversationId: "conv_1",
      fetchImpl: fetchSpy as unknown as RecordingFetch,
    });

    expect(result.status).toBe("skipped");
    if (result.status === "skipped") {
      expect(result.reason).toMatch(/ELEVENLABS_API_KEY|not configured/i);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ELEVENLABS_API_KEY"));
    warn.mockRestore();
  });

  it("GETs the conversation audio URL with xi-api-key and returns bytes + content-type", async () => {
    process.env.ELEVENLABS_API_KEY = "test-xi-key";
    const { fetchConversationAudio } = await freshModule();

    const audioBytes = new Uint8Array([1, 2, 3, 4]);
    let capturedUrl = "";
    let capturedInit: RequestInit = {};
    const fetchImpl = fakeFetch((url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return new Response(audioBytes, {
        status: 200,
        headers: { "Content-Type": "audio/wav" },
      });
    });

    const result = await fetchConversationAudio({
      conversationId: "conv_abc",
      fetchImpl,
    });

    expect(capturedUrl).toBe(
      "https://api.elevenlabs.io/v1/convai/conversations/conv_abc/audio",
    );
    expect(capturedInit.method).toBe("GET");
    const headers = capturedInit.headers as Record<string, string>;
    expect(headers["xi-api-key"]).toBe("test-xi-key");

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(Array.from(result.bytes)).toEqual([1, 2, 3, 4]);
      expect(result.contentType).toBe("audio/wav");
    }
  });

  it("defaults contentType to audio/mpeg when Content-Type header is absent", async () => {
    process.env.ELEVENLABS_API_KEY = "test-xi-key";
    const { fetchConversationAudio } = await freshModule();

    const fetchImpl = fakeFetch(
      () => new Response(new Uint8Array([9]), { status: 200 }),
    );

    const result = await fetchConversationAudio({
      conversationId: "conv_2",
      fetchImpl,
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.contentType).toBe("audio/mpeg");
    }
  });

  it("returns a typed error (not a throw) on a non-OK response", async () => {
    process.env.ELEVENLABS_API_KEY = "test-xi-key";
    const { fetchConversationAudio } = await freshModule();

    const fetchImpl = fakeFetch(() => new Response("not found", { status: 404 }));

    const result = await fetchConversationAudio({
      conversationId: "conv_missing",
      fetchImpl,
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.reason).toContain("404");
    }
  });

  it("returns a typed error (not a throw) when fetch itself rejects", async () => {
    process.env.ELEVENLABS_API_KEY = "test-xi-key";
    const { fetchConversationAudio } = await freshModule();

    const fetchImpl: RecordingFetch = (async () => {
      throw new Error("network down");
    }) as unknown as RecordingFetch;

    const result = await fetchConversationAudio({
      conversationId: "conv_3",
      fetchImpl,
    });

    expect(result).toEqual({ status: "error", reason: "network down" });
  });
});
