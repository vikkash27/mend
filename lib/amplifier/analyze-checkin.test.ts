import { afterEach, describe, expect, it, vi } from "vitest";
import type { Decision, Symptoms, VitalsReading } from "../clinical/types";

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
  return import("./analyze-checkin");
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

function greenPrior(): Decision {
  return {
    level: "green",
    action: "Continue the current recovery plan.",
    rationale: ["Baseline green prior decision."],
    firedRules: [],
  };
}

function baselineArgs(overrides: {
  priorDecision?: Decision;
  fetchImpl?: typeof fetch;
  symptoms?: Symptoms;
} = {}) {
  const vitals: VitalsReading = {
    timestamp: "2026-07-25T12:00:00.000Z",
    hr: 72,
    spo2: 98,
    tempC: 36.6,
    source: "manual",
    quality: "ok",
  };
  return {
    conversationId: "conv_test",
    dayPostOp: 5,
    symptoms: overrides.symptoms ?? {},
    vitals,
    priorDecision: overrides.priorDecision ?? greenPrior(),
    fetchImpl: overrides.fetchImpl,
  };
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

describe("analyzeCheckinVoiceBiomarkers", () => {
  afterEach(() => {
    clearCredentials();
  });

  it("fail-opens to unavailable + priorDecision when audio fetch is skipped", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { analyzeCheckinVoiceBiomarkers } = await freshModule();
    const prior = greenPrior();
    const fetchSpy = vi.fn();

    const result = await analyzeCheckinVoiceBiomarkers(
      baselineArgs({ priorDecision: prior, fetchImpl: fetchSpy as unknown as typeof fetch }),
    );

    expect(result.decision).toEqual(prior);
    expect(result.decisionChanged).toBe(false);
    expect(result.record.status).toBe("unavailable");
    expect(result.record.conversationId).toBe("conv_test");
    expect(result.record.error).toMatch(/ElevenLabs|configured/i);
    expect(fetchSpy).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("fail-opens to unavailable + priorDecision when audio fetch errors", async () => {
    process.env.ELEVENLABS_API_KEY = "xi_test";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { analyzeCheckinVoiceBiomarkers } = await freshModule();
    const prior = greenPrior();

    const fetchImpl = fakeFetch((url) => {
      if (url === AUDIO_URL) {
        return new Response("not found", { status: 404 });
      }
      throw new Error(`unexpected url ${url}`);
    });

    const result = await analyzeCheckinVoiceBiomarkers(
      baselineArgs({ priorDecision: prior, fetchImpl }),
    );

    expect(result.decision).toEqual(prior);
    expect(result.decisionChanged).toBe(false);
    expect(result.record.status).toBe("unavailable");
    expect(result.record.error).toMatch(/404|ElevenLabs/i);
    warn.mockRestore();
  });

  it("fail-opens to error + priorDecision when Amplifier credentials are missing", async () => {
    process.env.ELEVENLABS_API_KEY = "xi_test";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { analyzeCheckinVoiceBiomarkers } = await freshModule();
    const prior = greenPrior();

    const fetchImpl = fakeFetch((url) => {
      if (url === AUDIO_URL) {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      }
      throw new Error(`unexpected url ${url}`);
    });

    const result = await analyzeCheckinVoiceBiomarkers(
      baselineArgs({ priorDecision: prior, fetchImpl }),
    );

    expect(result.decision).toEqual(prior);
    expect(result.decisionChanged).toBe(false);
    expect(result.record.status).toBe("error");
    expect(result.record.error).toMatch(/credential|configured|AMPLIFIER/i);
    warn.mockRestore();
  });

  it("fail-opens to error + priorDecision when an Amplifier job fails", async () => {
    setAllCredentials();
    const { analyzeCheckinVoiceBiomarkers } = await freshModule();
    const prior = greenPrior();

    const fetchImpl = fakeFetch((url, init) => {
      if (url === AUDIO_URL) {
        return new Response(new Uint8Array([9, 9, 9]), {
          status: 200,
          headers: { "Content-Type": "audio/wav" },
        });
      }
      if (url === ANALYZE_URL && init.method === "POST") {
        const form = init.body as FormData;
        const domain = String(form.get("use_case"));
        return new Response(
          JSON.stringify({ job_id: `job-${domain}`, status: "queued" }),
          { status: 200 },
        );
      }
      if (url === JOB_URL("job-respiratory") || url === JOB_URL("job-cognitive")) {
        return new Response(
          JSON.stringify({ status: "failed", error: "vendor boom" }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected url ${url}`);
    });

    const result = await analyzeCheckinVoiceBiomarkers(
      baselineArgs({ priorDecision: prior, fetchImpl }),
    );

    expect(result.decision).toEqual(prior);
    expect(result.decisionChanged).toBe(false);
    expect(result.record.status).toBe("error");
    expect(result.record.error).toMatch(/failed|boom|Amplifier/i);
  });

  it("on success maps biomarkers, re-evaluates, and sets decisionChanged when voice rules fire", async () => {
    setAllCredentials();
    const { analyzeCheckinVoiceBiomarkers } = await freshModule();
    const prior = greenPrior();

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

    const result = await analyzeCheckinVoiceBiomarkers(
      baselineArgs({ priorDecision: prior, fetchImpl }),
    );

    expect(result.record.status).toBe("ready");
    expect(result.record.conversationId).toBe("conv_test");
    expect(result.record.jobIds).toEqual(
      expect.arrayContaining(["job-respiratory", "job-cognitive"]),
    );
    expect(result.record.analyzedAt).toEqual(expect.any(String));
    expect(result.record.mapped).toMatchObject({
      source: "amplifier",
      quality: "ok",
      cognitive: { level: "high" },
      respiratory: { level: "low" },
    });
    expect(result.decision.level).toBe("amber");
    expect(result.decision.firedRules).toContain("voice.cognitive_high");
    expect(result.decisionChanged).toBe(true);
  });

  it("on success keeps priorDecision and decisionChanged=false when level and firedRules match", async () => {
    setAllCredentials();
    const { analyzeCheckinVoiceBiomarkers } = await freshModule();
    const prior = greenPrior();

    const fetchImpl = fakeFetch((url, init) => {
      if (url === AUDIO_URL) {
        return new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "Content-Type": "audio/wav" },
        });
      }
      if (url === ANALYZE_URL && init.method === "POST") {
        const form = init.body as FormData;
        const domain = String(form.get("use_case"));
        return new Response(
          JSON.stringify({ job_id: `job-${domain}`, status: "queued" }),
          { status: 200 },
        );
      }
      if (url.startsWith("https://api.amplifierhealth.com/v2/jobs/")) {
        return new Response(
          JSON.stringify({
            status: "done",
            result: domainResult("low", "COPD"),
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected url ${url}`);
    });

    const result = await analyzeCheckinVoiceBiomarkers(
      baselineArgs({ priorDecision: prior, fetchImpl }),
    );

    expect(result.record.status).toBe("ready");
    expect(result.record.mapped?.quality).toBe("ok");
    expect(result.decision.level).toBe("green");
    expect(result.decision.firedRules).toEqual([]);
    expect(result.decisionChanged).toBe(false);
  });

  it("passes the same fetchImpl through audio and Amplifier client calls", async () => {
    setAllCredentials();
    const { analyzeCheckinVoiceBiomarkers } = await freshModule();
    const urls: string[] = [];

    const fetchImpl = fakeFetch((url, init) => {
      urls.push(`${init.method ?? "GET"} ${url}`);
      if (url === AUDIO_URL) {
        return new Response(new Uint8Array([7]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      }
      if (url === ANALYZE_URL) {
        const form = init.body as FormData;
        const domain = String(form.get("use_case"));
        return new Response(JSON.stringify({ job_id: `job-${domain}` }), {
          status: 200,
        });
      }
      if (url.startsWith("https://api.amplifierhealth.com/v2/jobs/")) {
        return new Response(
          JSON.stringify({
            status: "done",
            result: domainResult("moderate", "Allergy"),
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected url ${url}`);
    });

    await analyzeCheckinVoiceBiomarkers(baselineArgs({ fetchImpl }));

    expect(urls.some((u) => u.includes("elevenlabs.io"))).toBe(true);
    expect(urls.some((u) => u.includes("/use-case/analyze"))).toBe(true);
    expect(urls.some((u) => u.includes("/v2/jobs/"))).toBe(true);
  });
});
