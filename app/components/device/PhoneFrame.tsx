import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Restrained phone chrome for family/patient seats and landing previews.
 *
 * Live routes: pass `stage` — chrome and wash backdrop apply at `md+` only
 * (native phone widths stay full-bleed). Landing embeds: pass `preview` for a
 * fixed-height non-interactive device. Set `framed={false}` for `?frame=0`.
 */
export function PhoneFrame({
  children,
  framed = true,
  stage = false,
  preview = false,
  className,
  contentClassName,
}: {
  children: ReactNode;
  framed?: boolean;
  stage?: boolean;
  preview?: boolean;
  className?: string;
  contentClassName?: string;
}) {
  if (!framed) {
    return <>{children}</>;
  }

  if (preview) {
    return (
      <div
        className={cn(
          "relative mx-auto w-full max-w-[320px] rounded-[2.2rem] bg-ink p-[9px] shadow-[0_24px_60px_-28px_rgba(28,25,23,0.45)] sm:max-w-[360px]",
          className,
        )}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[16px] left-1/2 z-20 h-[24px] w-[84px] -translate-x-1/2 rounded-full bg-ink"
        />
        <div
          className={cn(
            "relative h-[min(600px,66vh)] overflow-hidden rounded-[1.75rem] bg-paper",
            contentClassName,
          )}
        >
          <div className="h-full overflow-hidden pointer-events-none select-none">
            {children}
          </div>
        </div>
      </div>
    );
  }

  if (stage) {
    // Single child tree: frame styles only at md+ so hydration and client
    // state (patient call button) are not duplicated.
    return (
      <div
        className={cn(
          "min-h-dvh",
          "md:flex md:items-start md:justify-center md:bg-[radial-gradient(ellipse_at_50%_0%,var(--color-wash-strong)_0%,var(--color-wash)_45%,var(--color-paper)_100%)] md:px-6 md:py-10",
          className,
        )}
      >
        <div
          className={cn(
            "relative mx-auto w-full",
            "md:max-w-[440px] md:rounded-[2.4rem] md:bg-ink md:p-[11px] md:shadow-[0_24px_60px_-28px_rgba(28,25,23,0.45)]",
          )}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-[18px] left-1/2 z-20 hidden h-[28px] w-[100px] -translate-x-1/2 rounded-full bg-ink md:block"
          />
          <div
            className={cn(
              "relative bg-paper",
              "md:min-h-[min(820px,88dvh)] md:overflow-hidden md:rounded-[1.9rem]",
              contentClassName,
            )}
          >
            <div className="md:h-full md:overflow-y-auto md:overscroll-contain">
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[440px] rounded-[2.4rem] bg-ink p-[11px] shadow-[0_24px_60px_-28px_rgba(28,25,23,0.45)]",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[18px] left-1/2 z-20 h-[28px] w-[100px] -translate-x-1/2 rounded-full bg-ink"
      />
      <div
        className={cn(
          "relative min-h-[min(820px,88dvh)] overflow-hidden rounded-[1.9rem] bg-paper",
          contentClassName,
        )}
      >
        <div className="h-full overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}

/** Parse `?frame=0` (and aliases) into a boolean for live phone routes. */
export function resolvePhoneFramed(
  frameParam: string | string[] | undefined,
): boolean {
  const raw = Array.isArray(frameParam) ? frameParam[0] : frameParam;
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return true;
}
