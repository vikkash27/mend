"use client";

import { useEffect, useState } from "react";
import { Loader2, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * What the patient is taking, and the one thing they can ask for.
 *
 * Written for an 82-year-old reading it on a phone: generic names as printed on
 * the box, plain-English timing rather than "QDS", and the reason each one is
 * there — people take medicines more reliably when they know what each is for.
 * Styled with the portal's own scale and surfaces rather than a second visual
 * language bolted into the phone frame.
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
}

export function MedicationList({
  dayPostOp,
  currentSeverity = "green",
  firedRules = [],
  painScore,
}: {
  dayPostOp: number;
  currentSeverity?: "green" | "amber" | "red";
  firedRules?: string[];
  /** Today's reported pain. Drives the severe-pain assess-first rule. */
  painScore?: number;
}) {
  const [meds, setMeds] = useState<Med[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [result, setResult] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prn")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setMeds(d.medications ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your medicines just now.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function ask(medicationId: string) {
    setPending(medicationId);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/prn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ medicationId, dayPostOp, currentSeverity, firedRules, painScore }),
      });
      if (!res.ok) {
        setError("Something went wrong. Please call the nurse line.");
        return;
      }
      const data = await res.json();
      setResult(data.assessment as Assessment);
    } catch {
      setError("Something went wrong. Please call the nurse line.");
    } finally {
      setPending(null);
    }
  }

  if (!meds && !error) {
    return <p className="text-lg text-ink-tertiary">Loading your medicines…</p>;
  }
  if (!meds) {
    return <p className="text-lg text-ink-secondary">{error}</p>;
  }

  const regular = meds.filter((m) => m.schedule === "regular");
  const prn = meds.filter((m) => m.schedule === "prn" && !m.withheld);
  const withheld = meds.filter((m) => m.withheld);

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Pill aria-hidden="true" className="size-4 text-ink-tertiary" strokeWidth={2} />
        <h2 className="font-sans text-[11px] font-medium tracking-[0.12em] text-ink-tertiary uppercase">
          Your medicines
        </h2>
      </div>

      <ul className="space-y-2">
        {regular.map((m) => (
          <li key={m.id} className="rounded-xl border border-line bg-raised px-3.5 py-3">
            <p className="text-lg font-medium text-ink">
              {m.name} <span className="font-normal text-ink-secondary">{m.dose}</span>
            </p>
            <p className="pt-0.5 text-lg leading-snug text-ink-secondary">{m.frequency}</p>
            <p className="pt-0.5 text-lg leading-snug text-ink-tertiary">{m.indication}</p>
          </li>
        ))}
      </ul>

      {prn.length > 0 ? (
        <div className="space-y-2 pt-1">
          <p className="text-lg leading-snug text-ink-secondary">
            If you need extra, ask and your care team will decide. Please wait to hear from
            them before taking anything.
          </p>
          {prn.map((m) => (
            <div key={m.id} className="rounded-xl border border-line bg-raised px-3.5 py-3">
              <p className="text-lg font-medium text-ink">
                {m.name} <span className="font-normal text-ink-secondary">{m.dose}</span>
              </p>
              <p className="pt-0.5 text-lg leading-snug text-ink-secondary">{m.frequency}</p>
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => void ask(m.id)}
                disabled={pending !== null}
                className="mt-2.5 min-h-12 w-full rounded-xl text-lg"
              >
                {pending === m.id ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : null}
                {pending === m.id ? "Asking your care team…" : "Ask for this"}
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {result ? (
        <div
          role="status"
          aria-live="polite"
          className={
            result.notify === "urgent"
              ? "rounded-xl border border-severity-red-border bg-severity-red-bg px-3.5 py-3"
              : "rounded-xl border border-line-strong bg-wash px-3.5 py-3"
          }
        >
          <p
            className={
              result.notify === "urgent"
                ? "text-lg leading-snug text-severity-red-fg"
                : "text-lg leading-snug text-ink"
            }
          >
            {result.patientMessage}
          </p>
        </div>
      ) : null}

      {error && meds ? (
        <p role="alert" className="text-lg leading-snug text-ink-secondary">
          {error}
        </p>
      ) : null}

      {withheld.map((m) => (
        <div key={m.id} className="rounded-xl border border-line bg-wash px-3.5 py-3">
          <p className="text-lg font-medium text-ink-secondary">{m.name}</p>
          <p className="pt-0.5 text-lg leading-snug text-ink-tertiary">
            Not right for you at the moment. Your care team has this noted.
          </p>
        </div>
      ))}
    </section>
  );
}
