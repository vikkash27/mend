import { cn } from "@/lib/utils";

const SIZE = {
  sm: "size-5",
  md: "size-7",
  lg: "size-10",
  xl: "size-14",
} as const;

export type MendMarkSize = keyof typeof SIZE;

/**
 * Abstract mend stitch — two gently joined curves suggesting repair.
 * No medical cross, heart, or ECG cliché. Uses currentColor.
 */
export function MendMark({
  size = "md",
  className,
  title,
}: {
  size?: MendMarkSize;
  className?: string;
  /** Accessible name when the mark stands alone. Omit when decorative beside a wordmark. */
  title?: string;
}) {
  const labelled = Boolean(title);
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", SIZE[size], className)}
      aria-hidden={labelled ? undefined : true}
      role={labelled ? "img" : undefined}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {/* Left thread */}
      <path
        d="M6 22c2.5-1.5 5-4.5 7-8.5 1.2-2.4 2-5 2.2-7.5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      {/* Right thread */}
      <path
        d="M26 10c-2.5 1.5-5 4.5-7 8.5-1.2 2.4-2 5-2.2 7.5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      {/* Stitch join */}
      <path
        d="M13.5 13.5c1.2-.4 2.8-.4 4 0M14.2 16.2c.9-.25 2.2-.25 3.1 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
