/**
 * Clinician chart notes — keyed by roster patient id.
 *
 * In-process store (shared across Route Handlers in one Node process) plus
 * optional durable JSON in `demo_state` under `chart_notes:<patientId>` so
 * notes survive serverless isolates when Supabase is configured. No new
 * table required for the demo.
 */

export type ChartNote = {
  id: string;
  patientId: string;
  body: string;
  author: string;
  createdAt: string;
};

const GLOBAL_KEY = "__mendChartNotes" as const;
const DEMO_STATE_PREFIX = "chart_notes:";
const SUPABASE_TIMEOUT_MS = 800;
const MAX_NOTES_PER_PATIENT = 50;
const MAX_BODY_CHARS = 4000;

type MendGlobal = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, ChartNote[]>;
};

function store(): Map<string, ChartNote[]> {
  const g = globalThis as MendGlobal;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map();
  }
  return g[GLOBAL_KEY];
}

export function listChartNotes(patientId: string): ChartNote[] {
  // Store keeps newest-first insertion order.
  return [...(store().get(patientId) ?? [])];
}

export function addChartNote(input: {
  patientId: string;
  body: string;
  author?: string;
}): ChartNote | { error: string } {
  const body = input.body.trim();
  if (!input.patientId.trim()) {
    return { error: "patientId is required." };
  }
  if (!body) {
    return { error: "Note cannot be empty." };
  }
  if (body.length > MAX_BODY_CHARS) {
    return { error: `Note must be under ${MAX_BODY_CHARS} characters.` };
  }

  const note: ChartNote = {
    id: crypto.randomUUID(),
    patientId: input.patientId,
    body,
    author: (input.author?.trim() || "Demo clinician").slice(0, 80),
    createdAt: new Date().toISOString(),
  };

  const existing = store().get(input.patientId) ?? [];
  store().set(input.patientId, [note, ...existing].slice(0, MAX_NOTES_PER_PATIENT));
  return note;
}

function supabaseRestConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | undefined> {
  try {
    return await Promise.race([
      work,
      new Promise<undefined>((resolve) => {
        setTimeout(() => resolve(undefined), ms);
      }),
    ]);
  } catch {
    return undefined;
  }
}

function isNote(value: unknown): value is ChartNote {
  if (!value || typeof value !== "object") return false;
  const n = value as Record<string, unknown>;
  return (
    typeof n.id === "string" &&
    typeof n.patientId === "string" &&
    typeof n.body === "string" &&
    typeof n.author === "string" &&
    typeof n.createdAt === "string"
  );
}

export async function loadChartNotes(patientId: string): Promise<ChartNote[]> {
  const config = supabaseRestConfig();
  if (config) {
    const key = `${DEMO_STATE_PREFIX}${patientId}`;
    const remote = await withTimeout(
      (async () => {
        const res = await fetch(
          `${config.url}/rest/v1/demo_state?key=eq.${encodeURIComponent(key)}&select=value`,
          {
            method: "GET",
            headers: {
              apikey: config.key,
              Authorization: `Bearer ${config.key}`,
              Accept: "application/json",
            },
            cache: "no-store",
          },
        );
        if (!res.ok) return null;
        const rows = (await res.json()) as Array<{ value?: unknown }>;
        const raw = rows[0]?.value;
        if (typeof raw !== "string") return null;
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (!Array.isArray(parsed)) return null;
          return parsed.filter(isNote);
        } catch {
          return null;
        }
      })(),
      SUPABASE_TIMEOUT_MS,
    );
    if (remote && remote.length > 0) {
      store().set(patientId, remote.slice(0, MAX_NOTES_PER_PATIENT));
      return listChartNotes(patientId);
    }
  }
  return listChartNotes(patientId);
}

export async function persistChartNotes(patientId: string): Promise<boolean> {
  const config = supabaseRestConfig();
  if (!config) return false;
  const notes = listChartNotes(patientId);
  const key = `${DEMO_STATE_PREFIX}${patientId}`;
  const result = await withTimeout(
    (async () => {
      const res = await fetch(`${config.url}/rest/v1/demo_state`, {
        method: "POST",
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${config.key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          key,
          value: JSON.stringify(notes),
          updated_at: new Date().toISOString(),
        }),
      });
      return res.ok;
    })(),
    SUPABASE_TIMEOUT_MS,
  );
  return result === true;
}
