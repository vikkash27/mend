import Link from "next/link";
import { MedicalAdviceDisclaimer } from "@/app/components/MedicalAdviceDisclaimer";

/**
 * Small launch pad — not on the stage path, but a mistyped URL or a curious
 * judge should land somewhere finished rather than a blank "Mend" stub.
 * Operator console stays off this list on purpose.
 */

const SURFACES = [
  { href: "/call", label: "Live call", note: "Voice check-in on stage" },
  { href: "/family", label: "Family", note: "Caregiver morning update" },
  { href: "/clinician", label: "Clinician", note: "Recovery worklist" },
  { href: "/clinician/engine", label: "Rule engine", note: "Deterministic safety rules" },
] as const;

export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-paper">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,var(--color-wash)_0%,transparent_55%),radial-gradient(ellipse_at_90%_80%,var(--color-wash-strong)_0%,transparent_45%)]"
      />

      <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col px-8 py-16 sm:px-12 sm:py-24">
        <h1 className="font-heading text-display tracking-tight text-ink">Mend</h1>
        <p className="mt-5 max-w-md font-serif text-lede text-ink-secondary">
          A voice-first post-op recovery co-pilot for orthopedics.
        </p>

        <nav aria-label="Product surfaces" className="mt-14 flex flex-col">
          {SURFACES.map((surface) => (
            <Link
              key={surface.href}
              href={surface.href}
              className="group flex min-h-14 items-baseline justify-between gap-6 border-t border-line py-4 last:border-b"
            >
              <span className="font-heading text-subhead text-ink transition-colors group-hover:text-ink-secondary">
                {surface.label}
              </span>
              <span className="text-label text-ink-tertiary">{surface.note}</span>
            </Link>
          ))}
        </nav>

        <MedicalAdviceDisclaimer className="mt-auto pt-16" />
      </div>
    </main>
  );
}
