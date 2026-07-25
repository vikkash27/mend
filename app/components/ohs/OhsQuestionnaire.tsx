"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The patient's Oxford Hip Score questionnaire.
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
}

export function OhsQuestionnaire({
  dayPostOp,
  onClose,
}: {
  dayPostOp?: number;
  onClose?: () => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [recall, setRecall] = useState("the past 4 weeks");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ohs")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setItems(d.items ?? []);
        if (d.recallPeriod) setRecall(d.recallPeriod);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the questions just now.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error && !items) return <p className="text-lg text-ink-secondary">{error}</p>;
  if (!items) return <p className="text-lg text-ink-tertiary">Loading…</p>;

  if (result) {
    return (
      <section className="space-y-3" aria-live="polite">
        <h2 className="font-heading text-[1.4rem] leading-tight text-ink">Thank you</h2>
        {result.complete ? (
          <>
            <div className="rounded-2xl border border-line bg-raised px-4 py-4">
              <p className="numeric text-[2.6rem] leading-none font-medium text-ink">
                {result.total}
                <span className="text-lg font-normal text-ink-tertiary"> / 48</span>
              </p>
              <p className="pt-2 text-lg leading-snug text-ink-secondary">{result.bandLabel}</p>
            </div>
            <p className="text-lg leading-snug text-ink-secondary">
              Your care team can see this. They will talk it through with you at your next
              appointment.
            </p>
          </>
        ) : (
          <p className="text-lg leading-snug text-ink-secondary">
            {result.answered} of {result.totalItems} answered. A score is only worked out once
            every question is done.
          </p>
        )}
        {onClose ? (
          <Button type="button" size="lg" variant="outline" onClick={onClose} className="min-h-12 w-full rounded-xl text-lg">
            Done
          </Button>
        ) : null}
      </section>
    );
  }

  const item = items[index];
  const chosen = answers[item.id];
  const isLast = index === items.length - 1;
  const remaining = items.filter((i) => !Number.isInteger(answers[i.id])).length;

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
      setResult(data.result as Result);
    } catch {
      setError("Could not send your answers. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <p className="font-sans text-[11px] font-medium tracking-[0.12em] text-ink-tertiary uppercase">
          Question {index + 1} of {items.length}
        </p>
        <div
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={items.length}
          className="mt-2 h-1.5 rounded-full bg-wash"
        >
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-200"
            style={{ width: `${((index + 1) / items.length) * 100}%` }}
          />
        </div>
      </div>

      <div>
        <h2 className="font-heading text-[1.35rem] leading-tight text-balance text-ink">
          {item.prompt}
        </h2>
        <p className="pt-1 text-lg text-ink-tertiary">Thinking about {recall}.</p>
      </div>

      <div className="space-y-2">
        {item.options.map((opt, i) => {
          const selected = chosen === i;
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setAnswers((a) => ({ ...a, [item.id]: i }));
                if (!isLast) window.setTimeout(() => setIndex((n) => n + 1), 180);
              }}
              className={`min-h-12 w-full rounded-xl border px-3.5 py-3 text-left text-lg leading-snug ${
                selected
                  ? "border-ink bg-wash font-medium text-ink"
                  : "border-line bg-raised text-ink"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        {index > 0 ? (
          <Button
            type="button"
            size="lg"
            variant="ghost"
            onClick={() => setIndex((n) => n - 1)}
            className="min-h-12 rounded-xl text-lg"
          >
            Back
          </Button>
        ) : null}
        {isLast ? (
          <Button
            type="button"
            size="lg"
            onClick={() => void submit()}
            disabled={remaining > 0 || busy}
            className="min-h-12 flex-1 rounded-xl text-lg"
          >
            {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {busy ? "Sending…" : remaining > 0 ? `${remaining} still to answer` : "Finish"}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-lg leading-snug text-ink-secondary">
          {error}
        </p>
      ) : null}
    </section>
  );
}
