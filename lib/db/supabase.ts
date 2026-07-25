import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Row/insert shapes mirroring lib/db/schema.sql verbatim (table and column
 * names match exactly). These exist purely for client-side typing — the
 * clinical shapes (`Symptoms`, `VitalsReading`, `Decision`, `TrendFinding`)
 * live in lib/clinical/types.ts and are serialized into the jsonb columns
 * below as-is, never re-derived here.
 *
 * These are declared with `type`, not `interface`: Supabase's generated
 * `Database` type requires each table's Row/Insert/Update to structurally
 * satisfy `Record<string, unknown>`, and an `interface` — unlike an object
 * type alias — does not satisfy that check even when its fields are
 * compatible, which otherwise silently collapses every `.from(table)` call
 * to `never` with no useful error at the call site.
 */
export type PatientRow = {
  id: string;
  name: string;
  procedure: string;
  surgery_date: string;
  phone: string | null;
  caregiver_phone: string | null;
};

export type PatientInsert = {
  id?: string;
  name: string;
  procedure: string;
  surgery_date: string;
  phone?: string | null;
  caregiver_phone?: string | null;
};

export type VitalsRow = {
  id: string;
  patient_id: string;
  recorded_at: string;
  hr: number | null;
  sbp: number | null;
  dbp: number | null;
  temp_c: number | null;
  spo2: number | null;
  resp_rate: number | null;
  pain_score: number | null;
  source: string;
  device_label: string | null;
  quality: string;
};

export type VitalsInsert = {
  id?: string;
  patient_id: string;
  recorded_at: string;
  hr?: number | null;
  sbp?: number | null;
  dbp?: number | null;
  temp_c?: number | null;
  spo2?: number | null;
  resp_rate?: number | null;
  pain_score?: number | null;
  source: string;
  device_label?: string | null;
  quality: string;
};

export type EcgReadingRow = {
  id: string;
  patient_id: string;
  recorded_at: string;
  determination: string;
  bpm: number | null;
  source: string;
  pdf_url: string | null;
};

export type EcgReadingInsert = {
  id?: string;
  patient_id: string;
  recorded_at: string;
  determination: string;
  bpm?: number | null;
  source?: string;
  pdf_url?: string | null;
};

export type CheckinRow = {
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
};

export type CheckinInsert = {
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
};

export type EscalationRow = {
  id: string;
  patient_id: string;
  checkin_id: string | null;
  level: string;
  condition: string | null;
  notified_caregiver_at: string | null;
};

export type EscalationInsert = {
  id?: string;
  patient_id: string;
  checkin_id?: string | null;
  level: string;
  condition?: string | null;
  notified_caregiver_at?: string | null;
};

export type MedicationRow = {
  id: string;
  patient_id: string;
  name: string;
  dose: string;
  route: string;
  schedule: string;
  frequency: string;
  indication: string;
  min_interval_hours: number | null;
  max_doses_in_24h: number | null;
  is_opioid: boolean;
  contraindication_note: string | null;
};

export type MedicationInsert = Omit<MedicationRow, "is_opioid"> & { is_opioid?: boolean };

export type MedicationAdministrationRow = {
  id: string;
  patient_id: string;
  medication_id: string;
  taken_at: string;
  source: string;
  created_at: string;
};

export type MedicationAdministrationInsert = {
  id?: string;
  patient_id: string;
  medication_id: string;
  taken_at: string;
  source: string;
  created_at?: string;
};

export type PrnRequestRow = {
  id: string;
  patient_id: string;
  medication_id: string;
  checkin_id: string | null;
  requested_at: string;
  pain_score: number | null;
  /** Frozen assessPrnRequest() output — never rewritten after the fact. */
  assessment: unknown;
  notified_clinician_at: string | null;
  decision: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
};

export type PrnRequestInsertRow = {
  id?: string;
  patient_id: string;
  medication_id: string;
  checkin_id?: string | null;
  requested_at?: string;
  pain_score?: number | null;
  assessment: unknown;
  notified_clinician_at?: string | null;
  decision?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  decision_note?: string | null;
};

export type OhsResponseRow = {
  id: string;
  patient_id: string;
  submitted_at: string;
  day_post_op: number | null;
  answers: unknown;
  total: number | null;
  band: string | null;
  complete: boolean;
  placeholder_wording: boolean;
};

export type OhsResponseInsert = {
  id?: string;
  patient_id: string;
  submitted_at?: string;
  day_post_op?: number | null;
  answers: unknown;
  total?: number | null;
  band?: string | null;
  complete?: boolean;
  placeholder_wording?: boolean;
};

type TableDef<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  // No embedded-resource (foreign-table select) relationships are declared
  // for this demo schema, so this is always empty — but postgrest-js's
  // GenericTable requires the field to be present, and omitting it makes
  // every `.from(table)` call silently collapse to `never`.
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      patients: TableDef<PatientRow, PatientInsert>;
      vitals: TableDef<VitalsRow, VitalsInsert>;
      ecg_readings: TableDef<EcgReadingRow, EcgReadingInsert>;
      checkins: TableDef<CheckinRow, CheckinInsert>;
      escalations: TableDef<EscalationRow, EscalationInsert>;
      medications: TableDef<MedicationRow, MedicationInsert>;
      medication_administrations: TableDef<
        MedicationAdministrationRow,
        MedicationAdministrationInsert
      >;
      prn_requests: TableDef<PrnRequestRow, PrnRequestInsertRow>;
      ohs_responses: TableDef<OhsResponseRow, OhsResponseInsert>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

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
