"use client";

import { useState } from "react";

/**
 * The clinician's side of a PRN request.
 *
 * Two things matter here. The assessment is shown *before* the buttons, so a
 * decision cannot be made without the reason being on screen — and when the
 * assessment says assess first, approving is not offered at all. That is not a
 * UI nicety: an approve button next to "pain out of proportion, assess for
 * compartment syndrome" is an invitation to click through the warning.
 */

export interface PrnRequestView {
  requestId: string;
  patientName: string;
  dayPostOp: number;
  medicationName: string;
  medicationDose: string;
  isOpioid: boolean;
  painScore?: number;
  assessment: {
    outcome: string;
    clinicianSummary: string;
    reasons: string[];
    dosesUsedIn24h: number;
    maxDosesIn24h?: number;
    requirementRising: boolean;
  };
}

type Decision = "approved" | "declined" | "call_placed";

export function PrnApprovalCard({
  request,
  decidedBy,
  onDecided,
}: {
  request: PrnRequestView;
  decidedBy: string;
  onDecided?: (d: Decision) => void;
}) {
  const [busy, setBusy] = useState<Decision | null>(null);
  const [done, setDone] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assessFirst = request.assessment.outcome === "assess_first";

  async function decide(decision: Decision) {
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch("/api/prn", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: request.requestId, decision, decidedBy }),
      });
      if (!res.ok) {
        setError("Could not record that. Nothing has been sent to the patient.");
        return;
      }
      setDone(decision);
      onDecided?.(decision);
    } catch {
      setError("Could not record that. Nothing has been sent to the patient.");
    } finally {
      setBusy(null);
    }
  }

  const tone = assessFirst ? "crit" : request.isOpioid ? "warn" : "brand";

  return (
    <article
      style={{
        border: `1px solid var(--${tone}-line, #d7dee6)`,
        borderLeft: `4px solid var(--${tone}, #2f6f9f)`,
        borderRadius: 12,
        padding: "14px 16px",
        background: "var(--surface, #fff)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 16 }}>{request.patientName}</strong>
        <span style={{ fontSize: 12.5, opacity: 0.7 }}>day {request.dayPostOp}</span>
        {assessFirst && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--crit, #c4382f)",
            }}
          >
            Assess first
          </span>
        )}
      </header>

      <div style={{ fontSize: 15 }}>
        Requests <strong>{request.medicationDose} {request.medicationName}</strong>
        {request.painScore !== undefined && <> · pain {request.painScore}/10</>}
      </div>

      {/* The reasoning sits above the actions, deliberately. */}
      <p style={{ fontSize: 13.5, margin: 0, opacity: 0.85, lineHeight: 1.5 }}>
        {request.assessment.clinicianSummary}
      </p>

      <div style={{ fontSize: 12, opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>
        {request.assessment.dosesUsedIn24h}
        {request.assessment.maxDosesIn24h !== undefined && `/${request.assessment.maxDosesIn24h}`} in
        24h{request.assessment.requirementRising && " · requirement rising"}
      </div>

      {done ? (
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {done === "approved" && "Approved — the patient has been told."}
          {done === "declined" && "Declined — the patient has been told."}
          {done === "call_placed" && "Calling the patient now."}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {/* No approve button when the assessment says assess first. */}
          {!assessFirst && (
            <button type="button" onClick={() => decide("approved")} disabled={busy !== null} style={btn("ok")}>
              {busy === "approved" ? "Recording…" : "Approve"}
            </button>
          )}
          <button type="button" onClick={() => decide("call_placed")} disabled={busy !== null} style={btn(assessFirst ? "crit" : "brand")}>
            {busy === "call_placed" ? "Calling…" : assessFirst ? "Call now" : "Call instead"}
          </button>
          <button type="button" onClick={() => decide("declined")} disabled={busy !== null} style={btn("muted")}>
            {busy === "declined" ? "Recording…" : "Decline"}
          </button>
        </div>
      )}

      {error && (
        <div role="alert" style={{ fontSize: 13, color: "var(--crit, #c4382f)" }}>
          {error}
        </div>
      )}
    </article>
  );
}

function btn(tone: string): React.CSSProperties {
  return {
    padding: "9px 15px",
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 9,
    border: tone === "muted" ? "1px solid var(--line, #d7dee6)" : "none",
    background: tone === "muted" ? "transparent" : `var(--${tone}, #2f6f9f)`,
    color: tone === "muted" ? "var(--ink, #171b21)" : "#fff",
    cursor: "pointer",
  };
}
