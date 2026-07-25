import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Row/insert shapes mirroring lib/db/schema.sql verbatim (table and column
 * names match exactly). These exist purely for client-side typing — the
 * clinical shapes (`Symptoms`, `VitalsReading`, `Decision`, `TrendFinding`)
 * live in lib/clinical/types.ts and are serialized into the jsonb columns
 * below as-is, never re-derived here.
 */
export interface PatientRow {
  id: string;
  name: string;
  procedure: string;
  surgery_date: string;
  phone: string | null;
  caregiver_phone: string | null;
}

export interface PatientInsert {
  id?: string;
  name: string;
  procedure: string;
  surgery_date: string;
  phone?: string | null;
  caregiver_phone?: string | null;
}

export interface VitalsRow {
  id: string;
  patient_id: string;
  recorded_at: string;
  hr: number | null;
  sbp: number | null;
  dbp: number | null;
  temp_c: number | null;
  spo2: number | null;
  resp_rate: number | null;
  source: string;
  device_label: string | null;
  quality: string;
}

export interface VitalsInsert {
  id?: string;
  patient_id: string;
  recorded_at: string;
  hr?: number | null;
  sbp?: number | null;
  dbp?: number | null;
  temp_c?: number | null;
  spo2?: number | null;
  resp_rate?: number | null;
  source: string;
  device_label?: string | null;
  quality: string;
}

export interface EcgReadingRow {
  id: string;
  patient_id: string;
  recorded_at: string;
  determination: string;
  bpm: number | null;
  source: string;
  pdf_url: string | null;
}

export interface EcgReadingInsert {
  id?: string;
  patient_id: string;
  recorded_at: string;
  determination: string;
  bpm?: number | null;
  source?: string;
  pdf_url?: string | null;
}

export interface CheckinRow {
  id: string;
  patient_id: string;
  created_at: string;
  day_post_op: number;
  transcript: string | null;
  symptoms: unknown;
  vitals: unknown;
  decision: unknown;
  trend_findings: unknown;
  sbar: string | null;
}

export interface CheckinInsert {
  id?: string;
  patient_id: string;
  created_at?: string;
  day_post_op: number;
  transcript?: string | null;
  symptoms?: unknown;
  vitals?: unknown;
  decision?: unknown;
  trend_findings?: unknown;
  sbar?: string | null;
}

export interface EscalationRow {
  id: string;
  patient_id: string;
  checkin_id: string | null;
  level: string;
  condition: string | null;
  notified_caregiver_at: string | null;
}

export interface EscalationInsert {
  id?: string;
  patient_id: string;
  checkin_id?: string | null;
  level: string;
  condition?: string | null;
  notified_caregiver_at?: string | null;
}

interface TableDef<Row, Insert> {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
}

export interface Database {
  public: {
    Tables: {
      patients: TableDef<PatientRow, PatientInsert>;
      vitals: TableDef<VitalsRow, VitalsInsert>;
      ecg_readings: TableDef<EcgReadingRow, EcgReadingInsert>;
      checkins: TableDef<CheckinRow, CheckinInsert>;
      escalations: TableDef<EscalationRow, EscalationInsert>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

let cachedClient: SupabaseClient<Database> | null | undefined;

/**
 * Server-side Supabase client. Prefers the service-role key (bypasses the
 * intentionally-disabled RLS for trusted server code) and falls back to the
 * anon key so a teammate holding only public keys can still read/write the
 * synthetic demo data.
 *
 * Never throws at import or call time: with no URL or no key configured
 * this logs a warning once and returns null so `npm run dev` still starts,
 * and every caller is expected to treat null as "persistence unavailable"
 * rather than a fatal error.
 */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL and/or a Supabase key are not set — " +
        "persistence is disabled and callers will receive a null client.",
    );
    cachedClient = null;
    return cachedClient;
  }

  cachedClient = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
  return cachedClient;
}
