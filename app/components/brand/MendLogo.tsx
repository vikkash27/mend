import { cn } from "@/lib/utils";
import { MendMark, type MendMarkSize } from "./MendMark";

export type MendLogoVariant = "mark" | "lockup";

const WORDMARK = {
  sm: "text-label",
  md: "text-subhead",
  lg: "text-heading",
  xl: "text-display",
} as const;

/**
 * Mend brand lockup. Prefer `lockup` in chrome; `mark` alone for favicon-scale
 * or when the word is already adjacent.
 */
export function MendLogo({
  variant = "lockup",
  size = "md",
  className,
  markClassName,
  wordmarkClassName,
}: {
  variant?: MendLogoVariant;
  size?: MendMarkSize;
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  if (variant === "mark") {
    return <MendMark size={size} className={cn(markClassName, className)} title="Mend" />;
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5 text-ink", className)}>
      <MendMark size={size} className={markClassName} />
      <span
        className={cn(
          "font-heading tracking-tight leading-none",
          WORDMARK[size],
          wordmarkClassName,
        )}
      >
        Mend
      </span>
    </span>
  );
}
