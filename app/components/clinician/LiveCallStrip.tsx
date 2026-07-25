"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useSyncExternalStore } from "react";
import { getLiveCall, subscribeLiveCall } from "@/lib/sim/live-call";

/**
 * Sticky banner while a live check-in is active and the clinician is away
 * from the patient Live pane. Return deep-links to Margaret’s chart with
 * `?live=1`.
 *
 * Hide only when on `/clinician/[id]` with `live=1` (live pane focused).
 * Do not hide solely because pathname is `/clinician` — hub no longer hosts Live.
 */

const RETURN_HREF = "/clinician/margaret-ellison?live=1";

function useLiveCallActive(): boolean {
  return useSyncExternalStore(
    subscribeLiveCall,
    () => getLiveCall().active,
    () => false,
  );
}

function LiveCallStripInner() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = useLiveCallActive();

  const onPatientLive =
    /^\/clinician\/[^/]+$/.test(pathname) && params.get("live") === "1";
  if (!active || onPatientLive) return null;

  return (
    <div role="status" className="border-t border-line bg-wash-strong">
      <div className="mx-auto flex w-full max-w-[112rem] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-2.5 md:px-8">
        <p className="text-label text-ink">
          <span className="font-medium">Live check-in</span>
          <span aria-hidden="true" className="text-ink-tertiary">
            {" "}
            ·{" "}
          </span>
          <span className="text-ink-secondary">Margaret</span>
        </p>
        <Link
          href={RETURN_HREF}
          className="inline-flex min-h-11 items-center rounded-md bg-ink px-4 text-label font-medium text-paper hover:bg-ink/90"
        >
          Return to live session
        </Link>
      </div>
    </div>
  );
}

export function LiveCallStrip() {
  return (
    <Suspense fallback={null}>
      <LiveCallStripInner />
    </Suspense>
  );
}
