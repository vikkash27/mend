import { NextRequest, NextResponse } from "next/server";
import {
  OHS_ITEMS,
  OHS_RECALL_PERIOD,
  scoreOhs,
  ohsChange,
  OhsAnswers,
} from "@/lib/clinical/ohs";
import { getSupabaseClient } from "@/lib/db/supabase";
import { fetchDemoPatient } from "@/lib/db/queries";

export const runtime = "nodejs";

/**
 * GET  /api/ohs — the questionnaire, plus this patient's previous scores.
 * POST /api/ohs — a submission. Scored server-side; the client never sends a total.
 *
 * Scoring on the server is deliberate. A PROM total is the thing a clinician
 * acts on, and it should be derived in one place from the stored answers rather
 * than trusted from whatever posted it.
 */

export async function GET() {
  const supabase = getSupabaseClient();
  let history: { submittedAt: string; dayPostOp: number | null; total: number | null; band: string | null }[] = [];
  const warnings: string[] = [];

  if (supabase) {
    try {
      const patient = await fetchDemoPatient(supabase);
      if (patient) {
        const { data } = await supabase
          .from("ohs_responses")
          .select("submitted_at, day_post_op, total, band, complete")
          .eq("patient_id", patient.id)
          .eq("complete", true)
          .order("submitted_at", { ascending: true });
        history = (data ?? []).map((r) => ({
          submittedAt: r.submitted_at as string,
          dayPostOp: r.day_post_op as number | null,
          total: r.total as number | null,
          band: r.band as string | null,
        }));
      }
    } catch {
      warnings.push("Previous scores unavailable.");
    }
  } else {
    warnings.push("Previous scores unavailable — no database configured.");
  }

  return NextResponse.json({
    recallPeriod: OHS_RECALL_PERIOD,
    items: OHS_ITEMS,
    history,
    // Surfaced so no client can present a total as a published-comparable score
    // by simply not knowing about the caveat.
    placeholderWording: true,
    licensingNote:
      "The Oxford Hip Score is copyright Oxford University Innovation. Item wording here is placeholder text; totals are within-patient trend only until the licensed instrument is used.",
    ...(warnings.length > 0 ? { warnings } : {}),
  });
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const body = (raw ?? {}) as Record<string, unknown>;
  const answers = body.answers;
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
    return NextResponse.json(
      { error: "Expected { answers: { [itemId]: 0-4 }, dayPostOp?: number }." },
      { status: 400 },
    );
  }

  const dayPostOp = typeof body.dayPostOp === "number" ? body.dayPostOp : null;
  const result = scoreOhs(answers as OhsAnswers);

  const supabase = getSupabaseClient();
  const warnings: string[] = [];
  let change: ReturnType<typeof ohsChange>;

  if (supabase) {
    try {
      const patient = await fetchDemoPatient(supabase);
      if (patient) {
        // Compare against the most recent completed score before writing this one.
        if (result.complete) {
          const { data: prev } = await supabase
            .from("ohs_responses")
            .select("answers")
            .eq("patient_id", patient.id)
            .eq("complete", true)
            .order("submitted_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (prev?.answers) {
            change = ohsChange(scoreOhs(prev.answers as OhsAnswers), result);
          }
        }

        await supabase.from("ohs_responses").insert({
          patient_id: patient.id,
          day_post_op: dayPostOp,
          answers: answers as unknown,
          total: result.total ?? null,
          band: result.band ?? null,
          complete: result.complete,
          placeholder_wording: result.usesPlaceholderWording,
        });
      }
    } catch {
      warnings.push("Your answers were scored but could not be saved.");
    }
  } else {
    warnings.push("Your answers were scored but not saved — no database configured.");
  }

  return NextResponse.json({
    result,
    change,
    ...(warnings.length > 0 ? { warnings } : {}),
  });
}
