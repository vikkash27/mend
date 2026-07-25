import type {
  AmplifierCredentials,
  AmplifierDomain,
  PollJobResult,
  SubmitAnalyzeResult,
} from "./types";

export type { AmplifierDomain, AmplifierCredentials, PollJobResult, SubmitAnalyzeResult };

const AMPLIFIER_ANALYZE_URL = "https://api.amplifierhealth.com/v2/use-case/analyze";
const AMPLIFIER_JOBS_URL = "https://api.amplifierhealth.com/v2/jobs";

const DEFAULT_MAX_ATTEMPTS = 60;
const DEFAULT_DELAY_MS = 1000;

export function loadAmplifierCredentials(): AmplifierCredentials | undefined {
  const apiKey = process.env.AMPLIFIER_API_KEY;
  const accountId = process.env.AMPLIFIER_ACCOUNT_ID;

  const missing: string[] = [];
  if (!apiKey) missing.push("AMPLIFIER_API_KEY");
  if (!accountId) missing.push("AMPLIFIER_ACCOUNT_ID");

  if (missing.length > 0) {
    console.warn(
      `[amplifier] ${missing.join(", ")} not set — Amplifier voice analysis is disabled.`,
    );
    return undefined;
  }

  return { apiKey: apiKey!, accountId: accountId! };
}

function authHeaders(credentials: AmplifierCredentials): Record<string, string> {
  return {
    "X-Account-ID": credentials.accountId,
    "X-API-Key": credentials.apiKey,
  };
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}

async function safeReadJson(response: Response): Promise<Record<string, unknown> | undefined> {
  try {
    const data: unknown = await response.json();
    return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function submitAnalyze(args: {
  domain: AmplifierDomain;
  audio: Uint8Array;
  contentType: string;
  filename?: string;
  fetchImpl?: typeof fetch;
}): Promise<SubmitAnalyzeResult> {
  const credentials = loadAmplifierCredentials();
  if (!credentials) {
    return {
      status: "error",
      reason: "Amplifier credentials are not configured.",
    };
  }

  const fetchImpl = args.fetchImpl ?? fetch;
  const form = new FormData();
  form.append(
    "audio",
    new Blob([args.audio], { type: args.contentType }),
    args.filename ?? "audio.wav",
  );
  form.append("use_case", args.domain);

  try {
    const response = await fetchImpl(AMPLIFIER_ANALYZE_URL, {
      method: "POST",
      headers: authHeaders(credentials),
      body: form,
    });

    if (!response.ok) {
      const detail = await safeReadText(response);
      return {
        status: "error",
        reason: `Amplifier analyze request failed with status ${response.status}${detail ? `: ${detail}` : ""}.`,
      };
    }

    const data = await safeReadJson(response);
    const jobId = typeof data?.job_id === "string" ? data.job_id : undefined;
    if (!jobId) {
      return { status: "error", reason: "Amplifier analyze response missing job_id." };
    }

    return { status: "ok", jobId };
  } catch (err) {
    return {
      status: "error",
      reason: err instanceof Error ? err.message : "Unknown error calling Amplifier.",
    };
  }
}

export async function pollJob(args: {
  jobId: string;
  fetchImpl?: typeof fetch;
  maxAttempts?: number;
  delayMs?: number;
}): Promise<PollJobResult> {
  const credentials = loadAmplifierCredentials();
  if (!credentials) {
    return {
      status: "error",
      reason: "Amplifier credentials are not configured.",
    };
  }

  const fetchImpl = args.fetchImpl ?? fetch;
  const maxAttempts = args.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const delayMs = args.delayMs ?? DEFAULT_DELAY_MS;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetchImpl(`${AMPLIFIER_JOBS_URL}/${args.jobId}`, {
        method: "GET",
        headers: authHeaders(credentials),
      });

      if (!response.ok) {
        const detail = await safeReadText(response);
        return {
          status: "error",
          reason: `Amplifier job poll failed with status ${response.status}${detail ? `: ${detail}` : ""}.`,
        };
      }

      const data = await safeReadJson(response);
      const jobStatus = typeof data?.status === "string" ? data.status : undefined;

      if (jobStatus === "done") {
        return { status: "done", result: data?.result };
      }

      if (jobStatus === "failed" || jobStatus === "error") {
        return {
          status: "error",
          reason: `Amplifier job ended with status ${jobStatus}.`,
        };
      }
    } catch (err) {
      return {
        status: "error",
        reason: err instanceof Error ? err.message : "Unknown error polling Amplifier.",
      };
    }

    if (attempt < maxAttempts && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return {
    status: "timeout",
    reason: `Amplifier job poll timed out after ${maxAttempts} attempts.`,
  };
}
