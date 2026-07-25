"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ChartNote } from "@/lib/sim/chart-notes";
import { cn } from "@/lib/utils";
import { Panel, SectionHeading } from "./ClinicianShell";
import { clockTime, timeAgo } from "./format";

/**
 * Clinician chart notes — free-text notes on a patient chart.
 * Loads/saves via /api/notes (in-process + optional demo_state durability).
 */
export function ChartNotes({
  patientId,
  patientName,
  compact = false,
  className,
}: {
  patientId: string;
  patientName: string;
  compact?: boolean;
  className?: string;
}) {
  const [notes, setNotes] = useState<ChartNote[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/notes?patientId=${encodeURIComponent(patientId)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as { notes?: ChartNote[]; error?: string };
      if (!res.ok) {
        setError(json.error ?? `Could not load notes (${res.status}).`);
        return;
      }
      setNotes(json.notes ?? []);
    } catch {
      setError("Could not reach notes service.");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  async function save() {
    const body = draft.trim();
    if (!body || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientId, body }),
      });
      const json = (await res.json()) as { note?: ChartNote; error?: string };
      if (!res.ok || !json.note) {
        setError(json.error ?? `Save failed (${res.status}).`);
        return;
      }
      setNotes((prev) => [json.note!, ...prev]);
      setDraft("");
    } catch {
      setError("Could not save note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel className={cn("p-5", className)}>
      <SectionHeading
        title="Chart notes"
        meta={
          loading
            ? "loading…"
            : `${notes.length} note${notes.length === 1 ? "" : "s"} · ${patientName}`
        }
      />
      <p className="pt-2 text-meta text-ink-tertiary">
        Clinical documentation for the care team — not shown to the patient or
        family surfaces.
      </p>

      <div className="pt-4">
        <label htmlFor={`chart-note-${patientId}`} className="sr-only">
          Add a chart note
        </label>
        <textarea
          id={`chart-note-${patientId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={compact ? 3 : 4}
          placeholder="Add a note to this chart…"
          className="min-h-24 w-full resize-y rounded-xl border border-line bg-paper px-3.5 py-3 text-body text-ink outline-none placeholder:text-ink-tertiary focus-visible:border-ink focus-visible:ring-3 focus-visible:ring-ink/20"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-meta text-ink-tertiary">
            Educational prototype — not a legal medical record.
          </p>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={saving || !draft.trim()}
            className="min-h-11"
          >
            {saving ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            Save note
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-label text-severity-red-fg">
            {error}
          </p>
        ) : null}
      </div>

      <div className={cn("mt-5 space-y-3", compact && "max-h-56 overflow-y-auto")}>
        {loading ? (
          <p className="flex items-center gap-2 text-label text-ink-secondary">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading notes…
          </p>
        ) : notes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-wash/50 px-4 py-6 text-center text-label text-ink-tertiary">
            No notes yet. Document follow-ups, caregiver calls, or review time
            here.
          </p>
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => (
              <li
                key={note.id}
                className="rounded-xl border border-line bg-wash/40 px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-meta font-medium text-ink">{note.author}</p>
                  <time
                    dateTime={note.createdAt}
                    className="numeric text-meta text-ink-tertiary"
                  >
                    {clockTime(note.createdAt)} · {timeAgo(note.createdAt, now)}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-body text-ink">
                  {note.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
