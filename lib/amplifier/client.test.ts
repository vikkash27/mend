import { afterEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = ["AMPLIFIER_API_KEY", "AMPLIFIER_ACCOUNT_ID"] as const;

const SUBMIT_URL = "https://api.amplifierhealth.com/v2/use-case/analyze";

async function freshClientModule() {
  vi.resetModules();
  return import("./client");
}

function setAllCredentials() {
  process.env.AMPLIFIER_API_KEY = "mak_test_key";
  process.env.AMPLIFIER_ACCOUNT_ID = "acct_test_account";
}

function fakeFetch(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    return handler(String(input), init ?? {});
  }) as typeof fetch;
}

describe("loadAmplifierCredentials", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  it("returns undefined when credentials are missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { loadAmplifierCredentials } = await freshClientModule();

    expect(loadAmplifierCredentials()).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("AMPLIFIER_API_KEY"),
    );
    warn.mockRestore();
  });

  it("returns apiKey and accountId when both env vars are set", async () => {
    setAllCredentials();
    const { loadAmplifierCredentials } = await freshClientModule();

    expect(loadAmplifierCredentials()).toEqual({
      apiKey: "mak_test_key",
      accountId: "acct_test_account",
    });
  });
});

describe("submitAnalyze", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  it("returns a typed error and never calls fetch when credentials are missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { submitAnalyze } = await freshClientModule();
    const fetchSpy = vi.fn();

    const result = await submitAnalyze({
      domain: "respiratory",
      audio: new Uint8Array([1, 2, 3]),
      contentType: "audio/wav",
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.reason).toMatch(/credential|configured|AMPLIFIER/i);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("POSTs multipart audio + use_case to the spike URL with both auth headers", async () => {
    setAllCredentials();
    const { submitAnalyze } = await freshClientModule();

    let capturedUrl = "";
    let capturedInit: RequestInit = {};
    const fetchImpl = fakeFetch((url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return new Response(JSON.stringify({ job_id: "job-abc", status: "queued" }), {
        status: 200,
      });
    });

    const audio = new Uint8Array([10, 20, 30]);
    const result = await submitAnalyze({
      domain: "cognitive",
      audio,
      contentType: "audio/wav",
      filename: "clip.wav",
      fetchImpl,
    });

    expect(capturedUrl).toBe(SUBMIT_URL);
    expect(capturedInit.method).toBe("POST");
    const headers = capturedInit.headers as Record<string, string>;
    expect(headers["X-Account-ID"]).toBe("acct_test_account");
    expect(headers["X-API-Key"]).toBe("mak_test_key");

    expect(capturedInit.body).toBeInstanceOf(FormData);
    const form = capturedInit.body as FormData;
    expect(form.get("use_case")).toBe("cognitive");
    const audioPart = form.get("audio");
    expect(audioPart).toBeTruthy();

    expect(result).toEqual({ status: "ok", jobId: "job-abc" });
  });

  it("returns a typed error on non-2xx without throwing", async () => {
    setAllCredentials();
    const { submitAnalyze } = await freshClientModule();

    const fetchImpl = fakeFetch(
      () => new Response("AUDIO_TOO_SHORT", { status: 400 }),
    );

    const result = await submitAnalyze({
      domain: "respiratory",
      audio: new Uint8Array([1]),
      contentType: "audio/wav",
      fetchImpl,
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.reason).toContain("400");
    }
  });
});

describe("pollJob", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  it("returns done with result when job status is done", async () => {
    setAllCredentials();
    const { pollJob } = await freshClientModule();

    const doneResult = {
      summary: { overall_level: "inconclusive" },
      signals: [],
    };

    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    const fetchImpl = fakeFetch((url, init) => {
      capturedUrl = url;
      capturedHeaders = (init.headers ?? {}) as Record<string, string>;
      return new Response(
        JSON.stringify({
          job_id: "job-xyz",
          status: "done",
          result: doneResult,
        }),
        { status: 200 },
      );
    });

    const result = await pollJob({
      jobId: "job-xyz",
      fetchImpl,
      maxAttempts: 3,
      delayMs: 0,
    });

    expect(capturedUrl).toBe("https://api.amplifierhealth.com/v2/jobs/job-xyz");
    expect(capturedHeaders["X-Account-ID"]).toBe("acct_test_account");
    expect(capturedHeaders["X-API-Key"]).toBe("mak_test_key");
    expect(result).toEqual({ status: "done", result: doneResult });
  });

  it("returns timeout after maxAttempts when job never reaches done", async () => {
    setAllCredentials();
    const { pollJob } = await freshClientModule();

    let attempts = 0;
    const fetchImpl = fakeFetch(() => {
      attempts += 1;
      return new Response(
        JSON.stringify({ job_id: "job-slow", status: "running" }),
        { status: 200 },
      );
    });

    const result = await pollJob({
      jobId: "job-slow",
      fetchImpl,
      maxAttempts: 3,
      delayMs: 0,
    });

    expect(attempts).toBe(3);
    expect(result.status).toBe("timeout");
    if (result.status === "timeout") {
      expect(result.reason).toMatch(/timeout|maxAttempts|attempts/i);
    }
  });

  it("returns error when job status is failed", async () => {
    setAllCredentials();
    const { pollJob } = await freshClientModule();

    const fetchImpl = fakeFetch(
      () =>
        new Response(
          JSON.stringify({ job_id: "job-bad", status: "failed", error: "boom" }),
          { status: 200 },
        ),
    );

    const result = await pollJob({
      jobId: "job-bad",
      fetchImpl,
      maxAttempts: 2,
      delayMs: 0,
    });

    expect(result.status).toBe("error");
  });
});
