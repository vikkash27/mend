import Link from "next/link";
import type { ReactNode } from "react";
import { MendLogo } from "@/app/components/brand/MendLogo";
import { MedicalAdviceDisclaimer } from "@/app/components/MedicalAdviceDisclaimer";
import { cn } from "@/lib/utils";
import { LiveCallStrip } from "./LiveCallStrip";

/**
 * The frame every clinician surface sits in.
 *
 * Dense clinical chrome: sticky app bar, section nav, optional breadcrumbs,
 * then the page. Live check-in is a chart mode — not a peer nav destination.
 */

const NAV = [
  { href: "/clinician", label: "Hub", match: (active: string) => active === "/clinician" },
  {
    href: "/clinician/patients",
    label: "Patients",
    match: (active: string) =>
      active === "/clinician/patients" ||
      (active.startsWith("/clinician/") &&
        active !== "/clinician/engine" &&
        !active.endsWith("/engine")),
  },
  {
    href: "/clinician/engine",
    label: "Rule engine",
    match: (active: string) => active === "/clinician/engine",
  },
];

export type ClinicianCrumb = {
  label: string;
  /** When set, the crumb is a link (navigational path). Omit for the current page. */
  href?: string;
};

export function ClinicianShell({
  active,
  crumbs,
  children,
}: {
  active: string;
  /** Navigational path under Clinician (e.g. Patients → Margaret). */
  crumbs?: ClinicianCrumb[];
  children: ReactNode;
}) {
  return (
    <div data-surface="clinician" className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b-2 border-line-strong bg-paper">
        <div className="mx-auto flex w-full max-w-[112rem] flex-wrap items-center gap-x-6 gap-y-1 px-6 md:px-8">
          <div className="flex min-h-11 min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center text-ink"
              aria-label="Mend home"
            >
              <MendLogo variant="lockup" size="sm" wordmarkClassName="text-xl" />
            </Link>
            <span className="eyebrow">Clinician</span>
            <span className="hidden text-meta text-ink-tertiary md:inline">
              Ridgeview Orthopedics · nurse line
            </span>
            {crumbs && crumbs.length > 0 ? (
              <nav aria-label="Breadcrumb" className="min-w-0">
                <ol className="flex flex-wrap items-center gap-x-1.5 text-meta text-ink-tertiary">
                  {crumbs.map((crumb, index) => {
                    const last = index === crumbs.length - 1;
                    return (
                      <li key={`${crumb.label}-${index}`} className="flex items-center gap-x-1.5">
                        <span aria-hidden="true">/</span>
                        {crumb.href && !last ? (
                          <Link
                            href={crumb.href}
                            className="text-ink-secondary underline-offset-4 hover:text-ink hover:underline"
                          >
                            {crumb.label}
                          </Link>
                        ) : (
                          <span
                            className={cn(last && "font-medium text-ink")}
                            aria-current={last ? "page" : undefined}
                          >
                            {crumb.label}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            ) : null}
          </div>

          <nav className="flex items-center gap-1" aria-label="Clinician sections">
            {NAV.map((item) => {
              const isActive = item.match(active);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-md px-3 text-label",
                    isActive
                      ? "bg-ink font-medium text-paper"
                      : "text-ink-secondary hover:bg-wash hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <LiveCallStrip />
      </header>

      <main className="mx-auto w-full max-w-[112rem] px-6 pb-12 md:px-8">{children}</main>

      <footer className="mx-auto w-full max-w-[112rem] px-6 pb-10 md:px-8">
        <MedicalAdviceDisclaimer extra="Synthetic patients only — no protected health information." />
      </footer>
    </div>
  );
}

/** Section heading: serif, because it is language, with a sans meta line. */
export function SectionHeading({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h2 className="font-heading text-subhead text-ink">{title}</h2>
      {meta ? <p className="numeric text-meta text-ink-tertiary">{meta}</p> : null}
      {children}
    </div>
  );
}

/**
 * Classes for a table that re-flows into stacked, labelled cards below md,
 * from one set of markup. A dense clinical table is the right shape on a
 * laptop and the wrong shape on a phone, and a horizontally-scrolled
 * spreadsheet is worse than either — the cell keeps its column name via
 * `data-label`, so nothing is lost in the narrow form.
 */
export const TABLE_HEAD =
  "px-4 py-2.5 text-left text-meta font-medium uppercase tracking-[0.14em] text-ink-tertiary whitespace-nowrap";

export const TABLE_CELL =
  "flex items-baseline justify-between gap-4 px-4 py-1.5 md:table-cell md:py-3 " +
  "before:text-meta before:uppercase before:tracking-[0.14em] before:text-ink-tertiary " +
  "before:content-[attr(data-label)] md:before:content-none";

/** A bordered card. Used everywhere so the density reads as a grid, not a pile. */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-md border-2 border-line-strong bg-raised",
        className,
      )}
    >
      {children}
    </section>
  );
}
