"use client";

import { useEffect, useState } from "react";

/**
 * What the patient is taking, and the one thing they can ask for.
 *
 * Written for an 82-year-old reading it on a phone: generic names as printed on
 * the box, plain-English timing rather than "QDS", and the reason each one is
 * there — people take medicines more reliably when they know what each is for.
 *
 * A withheld medicine is shown rather than hidden. Seeing "not right for you at
 * the moment" is less alarming than finding a familiar tablet missing from the
 * list and wondering whether someone forgot.
 */

interface Med {
  id: string;
  name: string;
  dose: string;
  schedule: "regular" | "prn";
  frequency: string;
  indication: string;
  isOpioid: boolean;
  withheld: boolean;
  contraindicationNote?: string;
}

interface Assessment {
  outcome: string;
  patientMessage: string;
  notify: "none" | "routine" | "urgent";
  dosesUsedIn24h: number;
  maxDosesIn24h?: number;
}

export function MedicationList({
  dayPostOp,
  currentSeverity = "green",
  firedRules = [],
}: {
  dayPostOp: number;
  currentSeverity?: "green" | "amber" | "red";
  firedRules?: string[];
}) {
  const [meds, setMeds] = useState<Med[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [result, setResult] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/prn")
      .then((r) => r.json())
      .then((d) => setMeds(d.medications ?? []))
      .catch(() => setError("Could not load your medicines. Please try again shortly."));
  }, []);

  async function ask(medicationId: string) {
    setPending(medicationId);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/prn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ medicationId, dayPostOp, currentSeverity, firedRules }),
      });
      if (!res.ok) {
        setError("Something went wrong asking your care team. Please call the nurse line.");
        return;
      }
      const data = await res.json();
      setResult(data.assessment);
    } catch {
      setError("Something went wrong asking your care team. Please call the nurse line.");
    } finally {
      setPending(null);
    }
  }

  if (error && !meds) return <p style={{ fontSize: 17 }}>{error}</p>;
  if (!meds) return <p style={{ fontSize: 17 }}>Loading your medicines…</p>;

  const prn = meds.filter((m) => m.schedule === "prn" && !m.withheld);
  const regular = meds.filter((m) => m.schedule === "regular");
  const withheld = meds.filter((m) => m.withheld);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <h2 style={{ fontSize: 21, margin: "0 0 4px" }}>Your medicines</h2>
        <p style={{ fontSize: 16, opacity: 0.75, margin: 0 }}>
          Take the regular ones at the usual times.
        </p>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {regular.map((m) => (
          <li key={m.id} style={cardStyle}>
            <div style={{ fontSize: 19, fontWeight: 650 }}>
              {m.name} <span style={{ fontWeight: 400 }}>{m.dose}</span>
            </div>
            <div style={{ fontSize: 16, marginTop: 3 }}>{m.frequency}</div>
            <div style={{ fontSize: 15, opacity: 0.7, marginTop: 3 }}>{m.indication}</div>
          </li>
        ))}
      </ul>

      {prn.length > 0 && (
        <div>
          <h3 style={{ fontSize: 19, margin: "0 0 4px" }}>If you need extra</h3>
          <p style={{ fontSize: 16, opacity: 0.75, margin: "0 0 12px" }}>
            Ask, and your care team will decide. Please wait to hear from them.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {prn.map((m) => (
              <li key={m.id} style={cardStyle}>
                <div style={{ fontSize: 19, fontWeight: 650 }}>
                  {m.name} <span style={{ fontWeight: 400 }}>{m.dose}</span>
                </div>
                <div style={{ fontSize: 16, marginTop: 3 }}>{m.frequency}</div>
                <button
                  type="button"
                  onClick={() => ask(m.id)}
                  disabled={pending !== null}
                  style={buttonStyle(pending === m.id)}
                >
                  {pending === m.id ? "Asking your care team…" : "Ask for this"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <div
          role="status"
          aria-live="polite"
          style={{
            ...cardStyle,
            fontSize: 18,
            lineHeight: 1.5,
            borderWidth: 2,
            borderColor: result.notify === "urgent" ? "var(--crit, #c4382f)" : "var(--brand, #2f6f9f)",
          }}
        >
          {result.patientMessage}
        </div>
      )}

      {error && meds && (
        <div role="alert" style={{ ...cardStyle, fontSize: 17 }}>
          {error}
        </div>
      )}

      {withheld.map((m) => (
        <div key={m.id} style={{ ...cardStyle, opacity: 0.75 }}>
          <div style={{ fontSize: 17, fontWeight: 650 }}>{m.name}</div>
          <div style={{ fontSize: 15, marginTop: 4 }}>
            Not right for you at the moment. Your care team has this noted.
          </div>
        </div>
      ))}
    </section>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--line, #d7dee6)",
  borderRadius: 12,
  padding: "14px 16px",
  background: "var(--surface, #fff)",
};

// 19px minimum on patient surfaces — the family-surface type floor already used
// elsewhere in the app, kept here because this is read by the same eyes.
function buttonStyle(busy: boolean): React.CSSProperties {
  return {
    marginTop: 12,
    padding: "13px 20px",
    fontSize: 19,
    fontWeight: 650,
    borderRadius: 10,
    border: "none",
    width: "100%",
    cursor: busy ? "progress" : "pointer",
    background: busy ? "var(--muted, #58636f)" : "var(--brand, #2f6f9f)",
    color: "#fff",
  };
}
