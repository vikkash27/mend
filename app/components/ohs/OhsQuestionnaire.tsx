"use client";

import { useEffect, useState } from "react";

/**
 * The patient's Oxford Hip Score portal.
 *
 * Built for an 82-year-old on a phone: one question per screen, large targets,
 * no scrolling to find the options, and no way to submit an incomplete form by
 * accident. Twelve questions in a single scrolling list looks efficient and is
 * the reason PROM completion rates are what they are.
 *
 * The result deliberately does not congratulate or alarm. A score is shown with
 * its band and nothing more — interpreting it is the clinician's job, and a
 * cheerful "great progress!" on a number the patient cannot contextualise is
 * how a questionnaire stops being answered honestly.
 */

interface Item {
  id: string;
  prompt: string;
  options: string[];
}

interface Result {
  total?: number;
  band?: string;
  bandLabel?: string;
  answered: number;
  totalItems: number;
  complete: boolean;
  missing: string[];
}

export function OhsQuestionnaire({ dayPostOp }: { dayPostOp?: number }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [recall, setRecall] = useState("the past 4 weeks");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ohs")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        if (d.recallPeriod) setRecall(d.recallPeriod);
      })
      .catch(() => setError("Could not load the questions. Please try again shortly."));
  }, []);

  if (error && !items) return <p style={{ fontSize: 19 }}>{error}</p>;
  if (!items) return <p style={{ fontSize: 19 }}>Loading…</p>;

  if (result) {
    return (
      <section style={{ display: "flex", flexDirection: "column", gap: 16 }} aria-live="polite">
        <h2 style={{ fontSize: 24, margin: 0 }}>Thank you</h2>
        {result.complete ? (
          <>
            <div style={card}>
              <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>
                {result.total}
                <span style={{ fontSize: 20, fontWeight: 400, opacity: 0.6 }}> / 48</span>
              </div>
              <div style={{ fontSize: 17, marginTop: 8 }}>{result.bandLabel}</div>
            </div>
            <p style={{ fontSize: 17, opacity: 0.8, margin: 0 }}>
              Your care team can see this. They will talk it through with you at your next
              appointment.
            </p>
          </>
        ) : (
          <p style={{ fontSize: 18 }}>
            {result.answered} of {result.totalItems} answered. A score is only worked out once
            every question is done.
          </p>
        )}
      </section>
    );
  }

  const item = items[index];
  const chosen = answers[item.id];
  const isLast = index === items.length - 1;
  const allAnswered = items.every((i) => Number.isInteger(answers[i.id]));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ohs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers, dayPostOp }),
      });
      if (!res.ok) {
        setError("Could not send your answers. Please try again.");
        return;
      }
      const data = await res.json();
      setResult(data.result);
    } catch {
      setError("Could not send your answers. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={{ fontSize: 15, opacity: 0.7 }}>
          Question {index + 1} of {items.length}
        </div>
        <div
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={items.length}
          style={{ height: 6, borderRadius: 3, background: "var(--line, #d7dee6)", marginTop: 8 }}
        >
          <div
            style={{
              width: `${((index + 1) / items.length) * 100}%`,
              height: "100%",
              borderRadius: 3,
              background: "var(--brand, #2f6f9f)",
            }}
          />
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: 22, lineHeight: 1.3, margin: "0 0 4px", textWrap: "balance" }}>
          {item.prompt}
        </h2>
        <p style={{ fontSize: 16, opacity: 0.7, margin: 0 }}>Thinking about {recall}.</p>
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <legend className="sr-only" style={{ position: "absolute", left: -9999 }}>
          {item.prompt}
        </legend>
        {item.options.map((opt, i) => {
          const selected = chosen === i;
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setAnswers((a) => ({ ...a, [item.id]: i }));
                // Advance automatically — one tap per question, not two.
                if (!isLast) setTimeout(() => setIndex((n) => n + 1), 180);
              }}
              style={{
                textAlign: "left",
                fontSize: 19,
                padding: "15px 17px",
                borderRadius: 11,
                border: `2px solid ${selected ? "var(--brand, #2f6f9f)" : "var(--line, #d7dee6)"}`,
                background: selected ? "var(--brand-soft, #e7f0f6)" : "var(--surface, #fff)",
                color: "var(--ink, #171b21)",
                cursor: "pointer",
              }}
            >
              {opt}
            </button>
          );
        })}
      </fieldset>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {index > 0 && (
          <button type="button" onClick={() => setIndex((n) => n - 1)} style={navBtn(false)}>
            Back
          </button>
        )}
        {isLast && (
          <button
            type="button"
            onClick={submit}
            disabled={!allAnswered || busy}
            style={{ ...navBtn(true), opacity: allAnswered ? 1 : 0.5, flex: 1 }}
          >
            {busy ? "Sending…" : allAnswered ? "Finish" : `${items.length - Object.keys(answers).length} still to answer`}
          </button>
        )}
      </div>

      {error && (
        <div role="alert" style={{ fontSize: 17, color: "var(--crit, #c4382f)" }}>
          {error}
        </div>
      )}
    </section>
  );
}

const card: React.CSSProperties = {
  border: "1px solid var(--line, #d7dee6)",
  borderRadius: 12,
  padding: "18px 20px",
  background: "var(--surface, #fff)",
};

function navBtn(primary: boolean): React.CSSProperties {
  return {
    padding: "14px 22px",
    fontSize: 19,
    fontWeight: 650,
    borderRadius: 10,
    border: primary ? "none" : "1px solid var(--line, #d7dee6)",
    background: primary ? "var(--brand, #2f6f9f)" : "transparent",
    color: primary ? "#fff" : "var(--ink, #171b21)",
    cursor: "pointer",
  };
}
