import { afterEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = [
  "ELEVENLABS_API_KEY",
  "AMPLIFIER_API_KEY",
  "AMPLIFIER_ACCOUNT_ID",
] as const;

const AUDIO_URL =
  "https://api.elevenlabs.io/v1/convai/conversations/conv_test/audio";
const ANALYZE_URL = "https://api.amplifierhealth.com/v2/use-case/analyze";
const JOB_URL = (id: string) => `https://api.amplifierhealth.com/v2/jobs/${id}`;

async function freshModule() {
  vi.resetModules();
  return import("./analyze-live-snapshot");
}

function setAllCredentials() {
  process.env.ELEVENLABS_API_KEY = "xi_test";
  process.env.AMPLIFIER_API_KEY = "mak_test";
  process.env.AMPLIFIER_ACCOUNT_ID = "acct_test";
}

function clearCredentials() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

function domainResult(level: string, label: string): unknown {
  return {
    audio_quality: { voice_percentage: 80, issues: [], audio_clarity: 4 },
    signals: [{ level, score: level === "high" ? 0.9 : 0.2, label }],
    summary: { overall_level: level, recommended_action: "follow_up" },
  };
}

function fakeFetch(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    return handler(String(input), init ?? {});
  }) as typeof fetch;
}

describe("analyzeLiveVoiceSnapshot", () => {
  afterEach(() => {
    clearCredentials();
  });

  it("sets phase during and mapped on success without returning decision", async () => {
    setAllCredentials();
    const { analyzeLiveVoiceSnapshot } = await freshModule();

    const fetchImpl = fakeFetch((url, init) => {
      if (url === AUDIO_URL) {
        return new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 200,
          headers: { "Content-Type": "audio/wav" },
        });
      }
      if (url === ANALYZE_URL && init.method === "POST") {
        const form = init.body as FormData;
        const domain = String(form.get("use_case"));
        expect(["respiratory", "cognitive"]).toContain(domain);
        return new Response(
          JSON.stringify({ job_id: `job-${domain}`, status: "queued" }),
          { status: 200 },
        );
      }
      if (url === JOB_URL("job-respiratory")) {
        return new Response(
          JSON.stringify({
            status: "done",
            result: domainResult("low", "COPD"),
          }),
          { status: 200 },
        );
      }
      if (url === JOB_URL("job-cognitive")) {
        return new Response(
          JSON.stringify({
            status: "done",
            result: domainResult("high", "Cognitive Impairment"),
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected url ${url}`);
    });

    const record = await analyzeLiveVoiceSnapshot({
      conversationId: "conv_test",
      fetchImpl,
    });

    expect(record.status).toBe("ready");
    expect(record.phase).toBe("during");
    expect(record.conversationId).toBe("conv_test");
    expect(record.mapped).toMatchObject({
      source: "amplifier",
      quality: "ok",
      cognitive: { level: "high" },
      respiratory: { level: "low" },
    });
    expect(record).not.toHaveProperty("decision");
  });

  it("fail-opens to unavailable with phase during when audio fetch errors", async () => {
    process.env.ELEVENLABS_API_KEY = "xi_test";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { analyzeLiveVoiceSnapshot } = await freshModule();

    const fetchImpl = fakeFetch((url) => {
      if (url === AUDIO_URL) {
        return new Response("not found", { status: 404 });
      }
      throw new Error(`unexpected url ${url}`);
    });

    const record = await analyzeLiveVoiceSnapshot({
      conversationId: "conv_test",
      fetchImpl,
    });

    expect(record.status).toBe("unavailable");
    expect(record.phase).toBe("during");
    expect(record.conversationId).toBe("conv_test");
    expect(record.error).toMatch(/404|ElevenLabs/i);
    expect(record).not.toHaveProperty("decision");
    warn.mockRestore();
  });

  it("fail-opens to error with phase during when Amplifier credentials are missing", async () => {
    process.env.ELEVENLABS_API_KEY = "xi_test";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { analyzeLiveVoiceSnapshot } = await freshModule();

    const fetchImpl = fakeFetch((url) => {
      if (url === AUDIO_URL) {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      }
      throw new Error(`unexpected url ${url}`);
    });

    const record = await analyzeLiveVoiceSnapshot({
      conversationId: "conv_test",
      fetchImpl,
    });

    expect(record.status).toBe("error");
    expect(record.phase).toBe("during");
    expect(record.error).toMatch(/credential|configured|AMPLIFIER/i);
    expect(record).not.toHaveProperty("decision");
    warn.mockRestore();
  });
});
