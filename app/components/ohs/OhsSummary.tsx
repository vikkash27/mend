"use client";

import { useEffect, useState } from "react";

/**
 * The clinician's view of a patient's Oxford Hip Score over time.
 *
 * A single score is nearly uninformative — the instrument earns its keep as a
 * trajectory, so the trend sits alongside the latest number rather than under it.
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

export function OhsSummary() {
  const [history, setHistory] = useState<Point[] | null>(null);
  const [placeholder, setPlaceholder] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ohs")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setHistory((d.history ?? []).filter((p: Point) => p.total !== null));
        setPlaceholder(Boolean(d.placeholderWording));
      })
      .catch(() => {
        if (!cancelled) setError("Could not load Oxford Hip Scores.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-label text-ink-secondary">{error}</p>;
  if (!history) return <p className="text-label text-ink-tertiary">Loading…</p>;

  const latest = history.at(-1);
  const delta = history.length > 1 ? latest!.total! - history[0].total! : undefined;

  return (
    <div className="space-y-3 rounded-xl border border-line bg-raised p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-medium text-ink">Oxford Hip Score</h3>
        <span className="text-label text-ink-tertiary">12 items · 0–48, higher is better</span>
      </div>

      {history.length === 0 ? (
        <p className="text-label text-ink-secondary">
          No completed questionnaires yet. Partially answered ones are not scored.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-5">
          <div>
            <p className="numeric text-[2rem] leading-none font-medium text-ink">
              {latest!.total}
              <span className="text-sm font-normal text-ink-tertiary"> / 48</span>
            </p>
            <p className="pt-1 text-label text-ink-secondary">
              {latest!.band?.replace(/-/g, " ")}
              {latest!.dayPostOp !== null ? ` · day ${latest!.dayPostOp}` : ""}
            </p>
          </div>

          {delta !== undefined ? (
            <p className="text-label text-ink-secondary">
              <span className="numeric font-medium text-ink">
                {delta > 0 ? "+" : ""}
                {delta}
              </span>{" "}
              since first completed
              {/* No claim about whether the change is clinically important — the
                  MIC is population-dependent and is the clinician's call. */}
            </p>
          ) : null}

          <Sparkline points={history} />
        </div>
      )}

      {placeholder ? (
        <p className="rounded-lg border border-severity-amber-border bg-severity-amber-bg px-3 py-2 text-label leading-relaxed text-severity-amber-fg">
          <strong className="font-medium">Trend only.</strong> Collected with placeholder item
          wording, not the licensed Oxford Hip Score. Comparable within this patient over time;
          not comparable to published norms, registry data or the minimal important change.
        </p>
      ) : null}
    </div>
  );
}

/** Small inline trend. Endpoint emphasised, because that is the number being read. */
function Sparkline({ points }: { points: Point[] }) {
  if (points.length < 2) return null;
  const w = 132;
  const h = 38;
  const xs = points.map((_, i) => (i / (points.length - 1)) * (w - 6) + 3);
  const ys = points.map((p) => h - 4 - (p.total! / 48) * (h - 8));
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");

  return (
    <svg
      width={w}
      height={h}
      role="img"
      aria-label={`Trend across ${points.length} completed questionnaires`}
      className="text-ink"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={xs.at(-1)} cy={ys.at(-1)} r="3" fill="currentColor" />
    </svg>
  );
}
