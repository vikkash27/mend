import { NextResponse } from "next/server";
import { fetchDemoPatient, fetchRecentCheckins } from "@/lib/db/queries";
import { getSupabaseClient } from "@/lib/db/supabase";
import { findPatient } from "@/lib/sim/roster";
import {
  callLogFromCheckins,
  prependActiveSession,
  type CallLogRow,
} from "@/lib/telephony/call-log";
import { getLiveSession, type LiveCallSession } from "@/lib/telephony/live-session";
import { runLiveTick } from "@/lib/telephony/live-tick";

type LiveCallResponse =
  | {
      status: "idle";
      session: null;
      recentCalls: CallLogRow[];
    }
  | {
      status: "active" | "finalizing" | "completed" | "error";
      session: Pick<
        LiveCallSession,
        "conversationId" | "patientId" | "turns" | "biomarkers" | "updatedAt" | "tickInFlight"
      > & {
        callStatus: LiveCallSession["status"];
      };
      recentCalls: CallLogRow[];
    };

function rosterRecentCalls(): CallLogRow[] {
  const patient = findPatient("margaret-ellison");
  if (!patient) {
    return [];
  }

  return callLogFromCheckins(
    patient.checkins.map((checkin) => ({
      id: checkin.id,
      created_at: checkin.at,
      day_post_op: checkin.dayPostOp,
      transcript: checkin.said,
      decision: checkin.decision,
      voice_biomarkers: checkin.voiceBiomarkers ?? null,
    })),
  );
}

async function loadRecentCalls(): Promise<CallLogRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return rosterRecentCalls();
  }

  const patient = await fetchDemoPatient(supabase);
  if (!patient) {
    return rosterRecentCalls();
  }

  const recentCheckins = await fetchRecentCheckins(supabase, patient.id);
  if (recentCheckins.length === 0) {
    return rosterRecentCalls();
  }

  return callLogFromCheckins(recentCheckins);
}

export async function GET(request: Request): Promise<NextResponse<LiveCallResponse>> {
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId") ?? undefined;
  const session = getLiveSession(conversationId);
  const recentCalls = prependActiveSession(await loadRecentCalls(), session);

  if (!session) {
    return NextResponse.json({
      status: "idle",
      session: null,
      recentCalls,
    });
  }

  if (session.status === "active" || session.status === "finalizing") {
    void runLiveTick({ conversationId: session.conversationId }).catch((error) => {
      console.warn("[api/live-call] failed to refresh live call session.", error);
    });
  }

  return NextResponse.json({
    status: session.status,
    session: {
      conversationId: session.conversationId,
      patientId: session.patientId,
      callStatus: session.status,
      turns: session.turns,
      biomarkers: session.biomarkers,
      updatedAt: session.updatedAt,
      tickInFlight: session.tickInFlight,
    },
    recentCalls,
  });
}
