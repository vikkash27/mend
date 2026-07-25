"use client";

import { useCallback, useEffect, useState } from "react";
import { Pill } from "lucide-react";
import { PrnApprovalCard, type PrnRequestView } from "./PrnApprovalCard";

/**
 * Analgesia requests waiting on a prescribing decision.
 *
 * Renders nothing when the queue is empty. A permanent "0 requests" panel is
 * chrome that a clinician learns to skip, which is the opposite of what a
 * queue is for — this surface should only ever appear when it needs an action.
 *
 * When the store is unreachable the panel *does* appear, saying so. An empty
 * queue and an unknown queue look identical otherwise, and only one of them
 * means nobody is waiting.
 */

interface Payload {
  requests?: (PrnRequestView & { requestedAt: string })[];
  unavailable?: boolean;
}

export function PrnQueue({ decidedBy = "Clinician" }: { decidedBy?: string }) {
  const [data, setData] = useState<Payload | null>(null);

  const load = useCallback(() => {
    fetch("/api/prn?pending=1", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ unavailable: true }));
  }, []);

  useEffect(load, [load]);

  if (!data) return null;

  if (data.unavailable) {
    return (
      <section className="rounded-xl border border-line bg-raised p-4">
        <Heading count={null} />
        <p className="pt-1 text-label text-ink-secondary">
          Requests could not be loaded, so this list may not be complete. Check the nurse
          line before assuming nobody is waiting.
        </p>
      </section>
    );
  }

  const requests = data.requests ?? [];
  if (requests.length === 0) return null;

  return (
    <section className="space-y-3 rounded-xl border border-line bg-raised p-4">
      <Heading count={requests.length} />
      <div className="space-y-3">
        {requests.map((r) => (
          <PrnApprovalCard
            key={r.requestId}
            request={r}
            decidedBy={decidedBy}
            // Re-fetch rather than splice locally: another clinician may have
            // decided a different request in the same window.
            onDecided={load}
          />
        ))}
      </div>
    </section>
  );
}

function Heading({ count }: { count: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <Pill aria-hidden="true" className="size-4 text-ink-tertiary" strokeWidth={2} />
      <h2 className="font-sans text-[11px] font-medium tracking-[0.12em] text-ink-tertiary uppercase">
        Analgesia requests{count !== null ? ` · ${count}` : ""}
      </h2>
    </div>
  );
}
