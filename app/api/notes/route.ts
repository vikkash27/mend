import { NextResponse } from "next/server";
import { findPatient } from "@/lib/sim/roster";
import {
  addChartNote,
  loadChartNotes,
  persistChartNotes,
} from "@/lib/sim/chart-notes";

/**
 * GET /api/notes?patientId=… — list notes for a roster patient.
 * POST /api/notes — { patientId, body, author? } add a chart note.
 */

export async function GET(request: Request) {
  const patientId = new URL(request.url).searchParams.get("patientId")?.trim();
  if (!patientId) {
    return NextResponse.json({ error: "patientId is required." }, { status: 400 });
  }
  if (!findPatient(patientId)) {
    return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  }
  const notes = await loadChartNotes(patientId);
  return NextResponse.json({ notes });
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const body = json as { patientId?: unknown; body?: unknown; author?: unknown };
  const patientId = typeof body.patientId === "string" ? body.patientId.trim() : "";
  const noteBody = typeof body.body === "string" ? body.body : "";
  const author = typeof body.author === "string" ? body.author : undefined;

  if (!findPatient(patientId)) {
    return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  }

  const result = addChartNote({ patientId, body: noteBody, author });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  void persistChartNotes(patientId);
  return NextResponse.json({ note: result }, { status: 201 });
}
