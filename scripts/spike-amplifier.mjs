/**
 * Live Amplifier API spike.
 *
 * Discovers which analyze URL works for respiratory/cognitive (or apex fallback),
 * polls the job to done, and writes a sanitized fixture for later TDD.
 *
 *   node scripts/spike-amplifier.mjs [optional.wav]
 *
 * Requires AMPLIFIER_API_KEY + AMPLIFIER_ACCOUNT_ID in .env (or environment).
 */
import { config } from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

config({ path: path.resolve(process.cwd(), ".env") });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FIXTURE_PATH = path.join(ROOT, "lib/amplifier/fixtures/sample-job-done.json");
const BASE = "https://api.amplifierhealth.com";
const POLL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 2_000;

const apiKey = process.env.AMPLIFIER_API_KEY?.trim();
const accountId = process.env.AMPLIFIER_ACCOUNT_ID?.trim();

if (!apiKey || !accountId) {
  console.error("BLOCKED: missing Amplifier credentials.");
  console.error("Add both of these to .env (never commit real values):");
  console.error("  AMPLIFIER_API_KEY=");
  console.error("  AMPLIFIER_ACCOUNT_ID=");
  process.exit(2);
}

const headers = {
  "X-Account-ID": accountId,
  "X-API-Key": apiKey,
};

/** @type {{ label: string, url: string, useCase?: string }[]} */
const CANDIDATES = [
  {
    label: "use-case/analyze respiratory",
    url: `${BASE}/v2/use-case/analyze`,
    useCase: "respiratory",
  },
  {
    label: "use-case/analyze cognitive",
    url: `${BASE}/v2/use-case/analyze`,
    useCase: "cognitive",
  },
  {
    label: "models/respiratory/analyze",
    url: `${BASE}/v2/models/respiratory/analyze`,
  },
  {
    label: "models/cognitive/analyze",
    url: `${BASE}/v2/models/cognitive/analyze`,
  },
  {
    label: "models/apex/analyze (last resort)",
    url: `${BASE}/v2/models/apex/analyze`,
  },
];

function generateToneWav(durationSec = 12, sampleRate = 16_000) {
  const numSamples = durationSec * sampleRate;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Quiet 440 Hz tone — enough signal energy for a ≥10s upload without being silence-only.
  const amp = 0.15;
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * amp;
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), 44 + i * 2);
  }
  return buffer;
}

async function loadAudioBuffer(argPath) {
  if (argPath) {
    const abs = path.resolve(argPath);
    console.log(`Using WAV from arg: ${abs}`);
    return readFile(abs);
  }
  console.log("No WAV arg — generating 12s local 440 Hz tone WAV");
  return generateToneWav(12);
}

function sanitizeJob(job) {
  const clone = JSON.parse(JSON.stringify(job));
  const redactKeys = /email|phone|name|patient|ssn|address|token|api[_-]?key|account/i;

  function walk(node) {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      if (redactKeys.test(k) && typeof v === "string") {
        node[k] = "[REDACTED]";
      } else {
        walk(v);
      }
    }
  }

  walk(clone);
  return clone;
}

async function submitAnalyze(candidate, audioBuffer) {
  const form = new FormData();
  form.append(
    "audio",
    new Blob([audioBuffer], { type: "audio/wav" }),
    "spike.wav",
  );
  if (candidate.useCase) {
    form.append("use_case", candidate.useCase);
    form.append("useCase", candidate.useCase);
  }

  const started = Date.now();
  const res = await fetch(candidate.url, {
    method: "POST",
    headers,
    body: form,
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return {
    label: candidate.label,
    url: candidate.url,
    useCase: candidate.useCase,
    status: res.status,
    ok: res.ok,
    latencyMs: Date.now() - started,
    body,
  };
}

async function pollJob(jobId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let last;
  while (Date.now() < deadline) {
    const started = Date.now();
    const res = await fetch(`${BASE}/v2/jobs/${jobId}`, { headers });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 500) };
    }
    last = {
      status: res.status,
      ok: res.ok,
      latencyMs: Date.now() - started,
      body,
    };
    const jobStatus = body?.status ?? body?.state ?? body?.job?.status;
    console.log(`  poll GET /v2/jobs/${jobId} → HTTP ${res.status} status=${jobStatus}`);
    if (!res.ok) return last;
    if (jobStatus === "done" || jobStatus === "failed" || jobStatus === "error") {
      return last;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return { ...last, timedOut: true };
}

function extractJobId(body) {
  return body?.job_id ?? body?.jobId ?? body?.id ?? body?.job?.id ?? null;
}

async function main() {
  const audioArg = process.argv[2];
  const audioBuffer = await loadAudioBuffer(audioArg);
  console.log(`Audio bytes: ${audioBuffer.byteLength}`);

  /** @type {Awaited<ReturnType<typeof submitAnalyze>>[]} */
  const attempts = [];
  let success = null;

  for (const candidate of CANDIDATES) {
    console.log(`\nTrying ${candidate.label}`);
    console.log(`  POST ${candidate.url}`);
    try {
      const result = await submitAnalyze(candidate, audioBuffer);
      attempts.push(result);
      console.log(`  HTTP ${result.status} (${result.latencyMs}ms)`);
      console.log(`  body keys: ${Object.keys(result.body || {}).join(", ") || "(empty)"}`);

      if (!result.ok) continue;

      const jobId = extractJobId(result.body);
      if (!jobId) {
        console.log("  ok response but no job_id — continuing");
        continue;
      }

      console.log(`  job_id=${jobId} — polling…`);
      const pollStarted = Date.now();
      const poll = await pollJob(jobId);
      const totalLatencyMs = Date.now() - pollStarted + result.latencyMs;
      const jobStatus = poll.body?.status ?? poll.body?.state;

      if (poll.ok && jobStatus === "done") {
        success = {
          candidate: candidate.label,
          url: candidate.url,
          useCase: candidate.useCase ?? null,
          jobId,
          submitHttp: result.status,
          submitLatencyMs: result.latencyMs,
          pollHttp: poll.status,
          totalLatencyMs,
          job: poll.body,
        };
        console.log(`SUCCESS via ${candidate.label} in ${totalLatencyMs}ms`);
        break;
      }

      console.log(
        `  job did not reach done (status=${jobStatus}, timedOut=${Boolean(poll.timedOut)})`,
      );
    } catch (err) {
      console.log(`  error: ${err instanceof Error ? err.message : String(err)}`);
      attempts.push({
        label: candidate.label,
        url: candidate.url,
        useCase: candidate.useCase,
        status: 0,
        ok: false,
        latencyMs: 0,
        body: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  await mkdir(path.dirname(FIXTURE_PATH), { recursive: true });

  if (!success) {
    console.error("\nSPIKE FAILED: no candidate returned a done job.");
    console.error(
      JSON.stringify(
        attempts.map((a) => ({
          label: a.label,
          url: a.url,
          status: a.status,
          bodyPreview: a.body,
        })),
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const fixture = {
    _spike: {
      capturedAt: new Date().toISOString(),
      workingEndpoint: success.url,
      candidateLabel: success.candidate,
      useCaseField: success.useCase,
      note: "Sanitized live Amplifier job payload. Secrets/PII stripped.",
      submitHttp: success.submitHttp,
      pollHttp: success.pollHttp,
      totalLatencyMs: success.totalLatencyMs,
    },
    ...sanitizeJob(success.job),
  };

  await writeFile(FIXTURE_PATH, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  console.log(`\nWrote sanitized fixture → ${path.relative(ROOT, FIXTURE_PATH)}`);
  console.log(
    JSON.stringify(
      {
        workingEndpoint: success.url,
        candidate: success.candidate,
        totalLatencyMs: success.totalLatencyMs,
        overall_level: success.job?.result?.summary?.overall_level,
        recommended_action: success.job?.result?.summary?.recommended_action,
        signalsCount: Array.isArray(success.job?.result?.signals)
          ? success.job.result.signals.length
          : null,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
