"use client";

import { useEffect, useState } from "react";

/**
 * The clinician's view of a patient's Oxford Hip Score over time.
 *
 * A single score is nearly uninformative — the instrument earns its keep as a
 * trajectory, so the chart is the primary object and the latest number sits
 * beside it rather than above it.
 *
 * The placeholder-wording caveat is rendered as part of the score, not as a
 * footnote. A clinician who reads "34/48" and acts on published norms has been
 * misled by omission, and a caveat only counts if it is impossible to miss.
 */

interface Point {
  submittedAt: string;
  dayPostOp: number | null;
  total: number | null;
  band: string | null;
}

const BAND_TONE: Record<string, string> = {
  satisfactory: "ok",
  "mild-to-moderate": "brand",
  "moderate-to-severe": "warn",
  severe: "crit",
};

export function OhsSummary() {
  const [history, setHistory] = useState<Point[] | null>(null);
  const [placeholder, setPlaceholder] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ohs")
      .then((r) => r.json())
      .then((d) => {
        setHistory((d.history ?? []).filter((p: Point) => p.total !== null));
        setPlaceholder(Boolean(d.placeholderWording));
      })
      .catch(() => setError("Could not load Oxford Hip Scores."));
  }, []);

  if (error) return <p style={{ fontSize: 13.5 }}>{error}</p>;
  if (!history) return <p style={{ fontSize: 13.5 }}>Loading…</p>;

  if (history.length === 0) {
    return (
      <section style={cardStyle}>
        <Header />
        <p style={{ fontSize: 13.5, opacity: 0.75, margin: 0 }}>
          No completed questionnaires yet. Partially answered ones are not scored.
        </p>
      </section>
    );
  }

  const latest = history[history.length - 1];
  const first = history[0];
  const delta = history.length > 1 ? latest.total! - first.total! : undefined;
  const tone = BAND_TONE[latest.band ?? ""] ?? "brand";

  return (
    <section style={cardStyle}>
      <Header />

      <div style={{ display: "flex", alignItems: "flex-end", gap: 18, flexWrap: "wrap" }}>
        <div>
          <div
            className="mono"
            style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, color: `var(--${tone}, #2f6f9f)` }}
          >
            {latest.total}
            <span style={{ fontSize: 15, fontWeight: 400, opacity: 0.6 }}> / 48</span>
          </div>
          <div style={{ fontSize: 12.5, opacity: 0.75, marginTop: 4 }}>
            {latest.band?.replace(/-/g, " ")}
            {latest.dayPostOp !== null && ` · day ${latest.dayPostOp}`}
          </div>
        </div>

        {delta !== undefined && (
          <div style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 650 }}>
              {delta > 0 ? "+" : ""}
              {delta}
            </span>{" "}
            since first completed
            {/* No claim about whether the change is clinically important — the
                MCID is population-dependent and contested. */}
          </div>
        )}

        <Sparkline points={history} tone={tone} />
      </div>

      {placeholder && (
        <p
          style={{
            fontSize: 12,
            margin: 0,
            padding: "8px 10px",
            borderRadius: 8,
            background: "var(--warn-soft, #f7ecd7)",
            color: "var(--warn, #b67716)",
            lineHeight: 1.45,
          }}
        >
          <strong>Trend only.</strong> Collected with placeholder item wording, not the licensed
          Oxford Hip Score. Comparable within this patient over time; <strong>not</strong>
          {" "}comparable to published norms, registry data or an MCID.
        </p>
      )}
    </section>
  );
}

function Header() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
      <h3 style={{ fontSize: 14, margin: 0, fontWeight: 650 }}>Oxford Hip Score</h3>
      <span style={{ fontSize: 11.5, opacity: 0.65 }}>12 items · 0–48, higher is better</span>
    </div>
  );
}

/** Small inline trend. Endpoint emphasised, because that is the number being read. */
function Sparkline({ points, tone }: { points: Point[]; tone: string }) {
  if (points.length < 2) return null;
  const w = 132;
  const h = 38;
  const xs = points.map((_, i) => (i / (points.length - 1)) * (w - 6) + 3);
  const ys = points.map((p) => h - 4 - (p.total! / 48) * (h - 8));
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");

  return (
    <svg width={w} height={h} role="img" aria-label={`Trend across ${points.length} completed questionnaires`}>
      <path d={d} fill="none" stroke={`var(--${tone}, #2f6f9f)`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" fill={`var(--${tone}, #2f6f9f)`} />
    </svg>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--line, #d7dee6)",
  borderRadius: 12,
  padding: "14px 16px",
  background: "var(--surface, #fff)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
