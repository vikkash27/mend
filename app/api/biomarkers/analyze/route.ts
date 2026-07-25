import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeCheckinVoiceBiomarkers } from "@/lib/amplifier/analyze-checkin";
import { updateCheckinAfterBiomarkers } from "@/lib/db/queries";
import { getSupabaseClient } from "@/lib/db/supabase";

/**
 * POST /api/biomarkers/analyze — post-call Amplifier voice biomarker analysis.
 *
 * Prefer clinical snapshots in the request body (symptoms, vitals, ecg?,
 * priorDecision) rather than reloading from Supabase. Demo callers already
 * have the check-in context in memory; body snapshots avoid racey DB reads
 * and keep the path reliable when persistence is skipped or lagging.
 *
 * Flow: parse body → analyzeCheckinVoiceBiomarkers → if Supabase is available,
 * updateCheckinAfterBiomarkers → return { record, decision, decisionChanged }.
 */

const SeveritySchema = z.enum(["green", "amber", "red"]);

const SymptomsSchema = z
  .object({
    breathless: z.boolean().optional(),
    chestPain: z.boolean().optional(),
    calfPainOrSwelling: z.boolean().optional(),
    woundDischarge: z.boolean().optional(),
    feverSubjective: z.boolean().optional(),
    suddenSevereHipPain: z.boolean().optional(),
    legShortenedOrRotated: z.boolean().optional(),
    unableToWeightBear: z.boolean().optional(),
    painControlled: z.boolean().optional(),
    newConfusion: z.boolean().optional(),
    painScore: z.number().finite().optional(),
  })
  .strict();

const VitalsReadingSchema = z.object({
  timestamp: z.string().min(1),
  hr: z.number().finite().optional(),
  sbp: z.number().finite().optional(),
  dbp: z.number().finite().optional(),
  tempC: z.number().finite().optional(),
  spo2: z.number().finite().optional(),
  respRate: z.number().finite().optional(),
  painScore: z.number().finite().optional(),
  source: z.enum(["ble_heart_rate", "manual", "kardia_6l", "simulated"]),
  deviceLabel: z.string().optional(),
  quality: z.enum(["ok", "poor", "stale"]),
});

const EcgReadingSchema = z.object({
  recordedAt: z.string().min(1),
  determination: z.enum([
    "normal_sinus_rhythm",
    "atrial_fibrillation",
    "tachycardia",
    "bradycardia",
    "unclassified",
  ]),
  bpm: z.number().finite().optional(),
  source: z.literal("kardia_6l"),
  pdfUrl: z.string().optional(),
});

const DecisionSchema = z.object({
  level: SeveritySchema,
  condition: z.string().optional(),
  action: z.string(),
  call: z.enum(["911", "ER", "surgeon_office", "nurse_line"]).optional(),
  rationale: z.array(z.string()),
  firedRules: z.array(z.string()),
});

const RequestBodySchema = z.object({
  checkinId: z.string().min(1),
  conversationId: z.string().min(1),
  dayPostOp: z.number().finite(),
  symptoms: SymptomsSchema,
  vitals: VitalsReadingSchema,
  ecg: EcgReadingSchema.optional(),
  priorDecision: DecisionSchema,
});

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const parsed = RequestBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Expected { checkinId, conversationId, dayPostOp, symptoms, vitals, priorDecision, ecg? }.",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const body = parsed.data;

  const result = await analyzeCheckinVoiceBiomarkers({
    conversationId: body.conversationId,
    dayPostOp: body.dayPostOp,
    symptoms: body.symptoms,
    vitals: body.vitals,
    ecg: body.ecg,
    priorDecision: body.priorDecision,
  });

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const ok = await updateCheckinAfterBiomarkers(supabase, body.checkinId, {
        voice_biomarkers: result.record,
        decision: result.decision,
      });
      if (!ok) {
        console.warn(
          "[api/biomarkers/analyze] updateCheckinAfterBiomarkers returned false — analysis still returned to caller.",
        );
      }
    } catch (err) {
      console.warn("[api/biomarkers/analyze] failed to persist biomarkers:", err);
    }
  }

  return NextResponse.json({
    record: result.record,
    decision: result.decision,
    decisionChanged: result.decisionChanged,
  });
}
