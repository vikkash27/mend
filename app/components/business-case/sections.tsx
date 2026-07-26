"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2,
  Phone,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { MedicalAdviceDisclaimer } from "@/app/components/MedicalAdviceDisclaimer";
import { MendLogo } from "@/app/components/brand/MendLogo";
import { talkToUsHref } from "@/app/components/landing/contact";
import { useLandingMotion } from "@/app/components/landing/motion";
import { BUSINESS_CASE_HREF, businessCaseCopy } from "./copy";

export function BusinessCaseNav({ active = false }: { active?: boolean }) {
  return (
    <header className="relative z-20 flex items-center justify-between gap-4 px-6 py-5 sm:px-10 lg:px-14">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-ink"
        aria-label={businessCaseCopy.brand}
      >
        <MendLogo variant="lockup" size="md" />
      </Link>
      <nav className="flex items-center gap-5 sm:gap-8">
        <Link
          href={BUSINESS_CASE_HREF}
          aria-current={active ? "page" : undefined}
          className={`min-h-11 inline-flex items-center text-label transition-colors ${
            active
              ? "text-ink underline decoration-ink/30 underline-offset-8"
              : "text-ink-secondary hover:text-ink"
          }`}
        >
          {businessCaseCopy.navLabel}
        </Link>
        <a
          href={talkToUsHref()}
          className="min-h-11 inline-flex items-center text-label text-ink-secondary transition-colors hover:text-ink"
        >
          {businessCaseCopy.contactCta}
        </a>
      </nav>
    </header>
  );
}

export function BusinessCaseHero() {
  const { fadeUp, staggerContainer } = useLandingMotion();
  const c = businessCaseCopy.hero;

  return (
    <section className="relative px-6 pb-16 pt-6 sm:px-10 sm:pb-24 lg:px-14">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-6xl"
      >
        <motion.div variants={fadeUp} className="text-ink">
          <MendLogo
            variant="lockup"
            size="xl"
            className="gap-4"
            markClassName="size-12 sm:size-14"
            wordmarkClassName="text-display"
          />
        </motion.div>
        <motion.h1
          variants={fadeUp}
          className="mt-8 max-w-3xl font-heading text-heading tracking-tight text-ink sm:text-title"
        >
          {c.headline}
        </motion.h1>
        <motion.p
          variants={fadeUp}
          className="mt-5 max-w-2xl text-body-lg text-ink-secondary"
        >
          {c.support}
        </motion.p>
        <motion.div
          variants={fadeUp}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <Link
            href={c.primaryHref}
            className="inline-flex min-h-12 items-center bg-ink px-6 text-label text-paper transition-opacity hover:opacity-90"
          >
            {c.primaryCta}
          </Link>
          <Link
            href={c.secondaryHref}
            className="inline-flex min-h-12 items-center px-2 text-label text-ink-secondary underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            {c.secondaryCta}
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}

export function Thesis() {
  const { fadeUp, staggerContainer, viewportOnce, initial } = useLandingMotion();
  const c = businessCaseCopy.thesis;

  return (
    <section className="border-t border-line bg-wash/40 px-6 py-14 sm:px-10 sm:py-16 lg:px-14 lg:py-20">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial={initial}
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.p variants={fadeUp} className="eyebrow">
          {c.eyebrow}
        </motion.p>
        <motion.h2
          variants={fadeUp}
          className="mt-3 max-w-3xl font-heading text-heading tracking-tight text-ink sm:text-title"
        >
          {c.title}
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-3 max-w-2xl text-body-lg text-ink-secondary"
        >
          {c.support}
        </motion.p>
        <ul className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
          {c.points.map((point, i) => (
            <motion.li key={point.title} variants={fadeUp}>
              <p className="numeric text-meta text-ink-tertiary">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 font-heading text-subhead text-ink">
                {point.title}
              </h3>
              <p className="mt-3 text-body text-ink-secondary">{point.body}</p>
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </section>
  );
}

export function Buyers() {
  const { fadeUp, staggerContainer, viewportOnce, initial } = useLandingMotion();
  const c = businessCaseCopy.buyers;
  const icons = [TrendingUp, ShieldCheck, Building2, Users] as const;

  return (
    <section className="border-t border-line px-6 py-14 sm:px-10 sm:py-16 lg:px-14 lg:py-20">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial={initial}
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.p variants={fadeUp} className="eyebrow">
          {c.eyebrow}
        </motion.p>
        <motion.h2
          variants={fadeUp}
          className="mt-3 max-w-3xl font-heading text-heading tracking-tight text-ink sm:text-title"
        >
          {c.title}
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-3 max-w-2xl text-body-lg text-ink-secondary"
        >
          {c.support}
        </motion.p>

        <ol className="mt-10 grid gap-4 sm:grid-cols-2">
          {c.drivers.map((driver, i) => {
            const Icon = icons[i] ?? TrendingUp;
            return (
              <motion.li
                key={driver.title}
                variants={fadeUp}
                whileHover={{ y: -3 }}
                transition={{ type: "spring", stiffness: 360, damping: 24 }}
                className="border-t border-line pt-5"
              >
                <div className="flex items-center gap-2 text-ink">
                  <Icon className="size-4 text-ink-secondary" strokeWidth={1.75} />
                  <h3 className="font-heading text-subhead text-ink">
                    {driver.title}
                  </h3>
                </div>
                <p className="mt-3 text-body text-ink-secondary">{driver.body}</p>
              </motion.li>
            );
          })}
        </ol>
      </motion.div>
    </section>
  );
}

export function Economics() {
  const { fadeUp, staggerContainer, viewportOnce, initial } = useLandingMotion();
  const c = businessCaseCopy.economics;

  return (
    <section className="border-t border-line bg-wash/50 px-6 py-14 sm:px-10 sm:py-16 lg:px-14 lg:py-20">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial={initial}
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.p variants={fadeUp} className="eyebrow">
          {c.eyebrow}
        </motion.p>
        <motion.h2
          variants={fadeUp}
          className="mt-3 max-w-3xl font-heading text-heading tracking-tight text-ink sm:text-title"
        >
          {c.title}
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-3 max-w-2xl text-body-lg text-ink-secondary"
        >
          {c.support}
        </motion.p>
        <motion.p
          variants={fadeUp}
          className="mt-4 max-w-2xl text-label text-ink-tertiary"
        >
          {c.caveat}
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="mt-10 grid gap-8 border-t border-line pt-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] lg:gap-14"
        >
          <div>
            <p className="text-meta tracking-wide text-ink-tertiary uppercase">
              {c.metricLabel}
            </p>
            <p className="mt-3 font-heading text-title tracking-tight text-ink">
              {c.metricValue}
            </p>
            <p className="mt-3 max-w-sm text-body text-ink-secondary">
              {c.metricNote}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left">
              <thead>
                <tr className="border-b border-line text-meta text-ink-tertiary">
                  <th className="pb-3 pr-4 font-medium">{c.columns.lift}</th>
                  <th className="pb-3 pr-4 font-medium">{c.columns.cases}</th>
                  <th className="pb-3 font-medium">{c.columns.margin}</th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map((row) => (
                  <tr
                    key={row.lift}
                    className={`border-b border-line/80 ${
                      "highlight" in row && row.highlight
                        ? "bg-raised/80"
                        : ""
                    }`}
                  >
                    <td
                      className={`py-3.5 pr-4 numeric text-label ${
                        "highlight" in row && row.highlight
                          ? "font-medium text-ink"
                          : "text-ink-secondary"
                      }`}
                    >
                      {row.lift}
                      {"highlight" in row && row.highlight ? (
                        <span className="ml-2 text-meta font-normal text-ink-tertiary">
                          breakeven
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3.5 pr-4 text-label text-ink">{row.cases}</td>
                    <td className="py-3.5 numeric text-label text-ink">
                      {row.margin}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-meta text-ink-tertiary">{c.footnote}</p>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

export function Consumers() {
  const { fadeUp, staggerContainer, viewportOnce, initial, reduce } =
    useLandingMotion();
  const c = businessCaseCopy.consumers;

  return (
    <section className="border-t border-line px-6 py-14 sm:px-10 sm:py-16 lg:px-14 lg:py-20">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial={initial}
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.p variants={fadeUp} className="eyebrow">
          {c.eyebrow}
        </motion.p>
        <motion.h2
          variants={fadeUp}
          className="mt-3 max-w-3xl font-heading text-heading tracking-tight text-ink sm:text-title"
        >
          {c.title}
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-3 max-w-2xl text-body-lg text-ink-secondary"
        >
          {c.support}
        </motion.p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start lg:gap-14">
          <ul className="space-y-8">
            {c.points.map((point, i) => (
              <motion.li key={point.title} variants={fadeUp}>
                <p className="numeric text-meta text-ink-tertiary">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 font-heading text-subhead text-ink">
                  {point.title}
                </h3>
                <p className="mt-3 text-body text-ink-secondary">{point.body}</p>
              </motion.li>
            ))}
          </ul>

          <motion.div
            variants={fadeUp}
            className="relative overflow-hidden rounded-2xl border border-line bg-[linear-gradient(165deg,var(--color-wash)_0%,var(--color-raised)_55%,var(--color-wash-strong)_100%)] p-6 shadow-[0_28px_60px_-36px_rgba(28,25,23,0.35)] sm:p-8"
          >
            <div className="flex items-center gap-2 text-ink">
              <Phone className="size-4 text-ink-secondary" strokeWidth={1.75} />
              <p className="text-meta tracking-wide text-ink-tertiary uppercase">
                Morning check-in
              </p>
            </div>
            <p className="mt-4 font-heading text-heading tracking-tight text-ink">
              “How did you sleep — any shortness of breath when you stood?”
            </p>
            <div className="mt-6 space-y-3">
              {[
                { who: "Patient", text: "A little breathless — up once with the walker." },
                { who: "Family", text: "Same engine update: clinic will follow up today." },
                { who: "Clinician", text: "Amber on chart — vitals + transcript attached." },
              ].map((row, i) => (
                <motion.div
                  key={row.who}
                  initial={reduce ? false : { opacity: 0, x: 12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.12 + i * 0.1 }}
                  className="border-t border-line pt-3"
                >
                  <p className="text-meta font-medium text-ink-tertiary">
                    {row.who}
                  </p>
                  <p className="mt-1 text-label text-ink">{row.text}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

export function Wedge() {
  const { fadeUp, staggerContainer, viewportOnce, initial } = useLandingMotion();
  const c = businessCaseCopy.wedge;

  return (
    <section className="border-t border-line bg-wash/40 px-6 py-14 sm:px-10 sm:py-16 lg:px-14 lg:py-20">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial={initial}
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.p variants={fadeUp} className="eyebrow">
          {c.eyebrow}
        </motion.p>
        <motion.h2
          variants={fadeUp}
          className="mt-3 max-w-3xl font-heading text-heading tracking-tight text-ink sm:text-title"
        >
          {c.title}
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-3 max-w-2xl text-body-lg text-ink-secondary"
        >
          {c.support}
        </motion.p>

        <ul className="mt-10 space-y-0 border-t border-line">
          {c.rows.map((row) => (
            <motion.li
              key={row.rival}
              variants={fadeUp}
              whileHover={{ backgroundColor: "var(--color-raised)" }}
              className="grid gap-3 border-b border-line py-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.2fr)] md:gap-6"
            >
              <div>
                <p className="text-meta text-ink-tertiary">Alternative</p>
                <p className="mt-1 font-heading text-subhead text-ink">
                  {row.rival}
                </p>
              </div>
              <div>
                <p className="text-meta text-ink-tertiary">Friction</p>
                <p className="mt-1 text-body text-ink-secondary">{row.friction}</p>
              </div>
              <div>
                <p className="text-meta text-ink-tertiary">Mend</p>
                <p className="mt-1 text-body text-ink">{row.mend}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </section>
  );
}

export function BusinessCaseClose() {
  const { fadeUp, staggerContainer, viewportOnce, initial } = useLandingMotion();
  const c = businessCaseCopy.close;

  return (
    <section className="border-t border-line px-6 py-20 sm:px-10 sm:py-28 lg:px-14">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial={initial}
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.h2
          variants={fadeUp}
          className="max-w-2xl font-heading text-heading tracking-tight text-ink"
        >
          {c.title}
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-4 max-w-xl text-body-lg text-ink-secondary"
        >
          {c.support}
        </motion.p>
        <motion.div
          variants={fadeUp}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <Link
            href={c.primaryHref}
            className="inline-flex min-h-12 items-center bg-ink px-6 text-label text-paper transition-opacity hover:opacity-90"
          >
            {c.primaryCta}
          </Link>
          <Link
            href={c.secondaryHref}
            className="inline-flex min-h-12 items-center px-2 text-label text-ink-secondary underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            {c.secondaryCta}
          </Link>
        </motion.div>
        <motion.div variants={fadeUp}>
          <MedicalAdviceDisclaimer
            className="mt-16"
            extra={c.figuresNote}
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
