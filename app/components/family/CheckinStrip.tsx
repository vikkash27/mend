import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Seven days of presence, not metrics. A filled circle means "Mend spoke to
 * her that day" — nothing about what the readings were. It stays entirely
 * grayscale on purpose: this strip is reassurance that someone is watching,
 * and reassurance must not compete with the severity colour above it.
 */

export interface CheckinDay {
  key: string;
  /** Single letter shown under the circle. */
  letter: string;
  /** Full weekday name, for screen readers. */
  name: string;
  checkedIn: boolean;
  isToday: boolean;
}

function caption(days: readonly CheckinDay[]): string {
  const count = days.filter((d) => d.checkedIn).length;
  if (count === days.length) {
    return "She's checked in every day this week.";
  }
  if (count === 0) {
    return "No check-ins yet this week.";
  }
  return `She's checked in ${count} of the last ${days.length} days.`;
}

export function CheckinStrip({
  days,
  compact = false,
}: {
  days: readonly CheckinDay[];
  /** Hide the prose caption; keep the week row only (phone viewport fit). */
  compact?: boolean;
}) {
  return (
    <section
      aria-label="Check-ins over the last seven days"
      className={
        compact
          ? "rounded-2xl border border-line bg-raised/80 px-2.5 py-3"
          : undefined
      }
    >
      <div className="flex items-start justify-between">
        {days.map((day) => (
          <div key={day.key} className="flex flex-col items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn(
                "flex items-center justify-center rounded-full",
                compact ? "size-7" : "size-9",
                day.checkedIn
                  ? "bg-wash-strong text-ink-secondary"
                  : "border border-line text-transparent",
                day.isToday &&
                  "ring-1 ring-line-strong ring-offset-1 ring-offset-paper",
              )}
            >
              {day.checkedIn ? (
                <Check
                  className={compact ? "size-3.5" : "size-4"}
                  strokeWidth={2.5}
                />
              ) : null}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                compact ? "text-[11px]" : "text-family-label",
                day.isToday ? "font-medium text-ink-secondary" : "text-ink-tertiary",
              )}
            >
              {day.letter}
            </span>
            <span className="sr-only">
              {day.name}: {day.checkedIn ? "checked in" : "no check-in"}
            </span>
          </div>
        ))}
      </div>
      {compact ? (
        <p className="sr-only">{caption(days)}</p>
      ) : (
        <p className="pt-4 text-lg text-ink-secondary">{caption(days)}</p>
      )}
    </section>
  );
}
