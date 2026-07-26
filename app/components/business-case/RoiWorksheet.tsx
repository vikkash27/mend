"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  DEFAULT_ASC_ROI_INPUTS,
  type AscRoiInputs,
  calculateAscRoi,
  formatMoney,
  formatNum,
} from "@/lib/business-case/asc-roi";
import { businessCaseCopy } from "./copy";
import { useLandingMotion } from "@/app/components/landing/motion";

type Field = {
  key: keyof AscRoiInputs;
  label: string;
  step: number;
  min?: number;
  max?: number;
  unit?: "$" | "%" | "h";
};

const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "Volume & margin",
    fields: [
      { key: "casesPerYear", label: "Ambulatory joint cases per year", step: 10 },
      {
        key: "marginPerCase",
        label: "Facility contribution margin per case",
        step: 100,
        unit: "$",
      },
    ],
  },
  {
    title: "Capacity recovered",
    fields: [
      {
        key: "declinedPerYear",
        label: "Patients declined per year over post-op safety or social concerns",
        step: 5,
      },
      {
        key: "acceptSharePct",
        label: "Share you would accept with monitoring in place",
        step: 5,
        min: 0,
        max: 100,
        unit: "%",
      },
    ],
  },
  {
    title: "Nursing labour",
    fields: [
      {
        key: "nurseHoursPerWeek",
        label: "Nurse hours per week on post-op follow-up calls",
        step: 1,
        unit: "h",
      },
      {
        key: "nurseCostPerHour",
        label: "Loaded nurse cost per hour",
        step: 5,
        unit: "$",
      },
      {
        key: "absorbSharePct",
        label: "Share of that contact Mend can absorb",
        step: 5,
        min: 0,
        max: 100,
        unit: "%",
      },
    ],
  },
  {
    title: "Avoided rescues",
    fields: [
      {
        key: "visitRatePct",
        label: "30-day hospital visit rate after ambulatory joints",
        step: 0.5,
        min: 0,
        max: 100,
        unit: "%",
      },
      {
        key: "visitReductionPct",
        label: "Relative reduction you would credit to monitoring",
        step: 5,
        min: 0,
        max: 100,
        unit: "%",
      },
      {
        key: "costPerVisit",
        label: "Cost to the center per unplanned hospital visit",
        step: 100,
        unit: "$",
      },
    ],
  },
  {
    title: "Price",
    fields: [
      {
        key: "pricePerCase",
        label: "Mend price per monitored case",
        step: 5,
        unit: "$",
      },
    ],
  },
];

function setField(
  prev: AscRoiInputs,
  key: keyof AscRoiInputs,
  raw: string,
): AscRoiInputs {
  const n = parseFloat(raw);
  return { ...prev, [key]: Number.isFinite(n) ? n : 0 };
}

export function RoiWorksheet() {
  const { fadeUp, growIn, staggerContainer, viewportOnce, initial, reduce } =
    useLandingMotion();
  const [inputs, setInputs] = useState<AscRoiInputs>(DEFAULT_ASC_ROI_INPUTS);
  const result = useMemo(() => calculateAscRoi(inputs), [inputs]);
  const tot = Math.max(result.gains, 1);
  const negative = result.net < 0;
  const c = businessCaseCopy.model;

  return (
    <section
      id="model"
      className="border-t border-line bg-wash/50 px-6 py-14 sm:px-10 sm:py-16 lg:px-14 lg:py-20"
    >
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

        <motion.div
          variants={growIn}
          className="mt-10 overflow-hidden rounded-2xl border border-line bg-raised shadow-[0_18px_40px_-28px_rgba(28,25,23,0.35)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-wash/70 px-5 py-3.5">
            <p className="text-label font-medium text-ink">Annual value, single center</p>
            <p className="text-meta text-ink-tertiary">{c.hint}</p>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="space-y-6 border-b border-line p-5 sm:p-6 lg:border-b-0 lg:border-r">
              {GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="eyebrow text-ink-tertiary">{group.title}</p>
                  <div className="mt-3 space-y-3">
                    {group.fields.map((field) => (
                      <label
                        key={field.key}
                        className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_7.5rem] sm:items-center sm:gap-4"
                      >
                        <span className="text-meta text-ink-secondary">{field.label}</span>
                        <span className="relative">
                          {field.unit === "$" ? (
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-meta text-ink-tertiary">
                              $
                            </span>
                          ) : null}
                          <input
                            type="number"
                            min={field.min ?? 0}
                            max={field.max}
                            step={field.step}
                            value={inputs[field.key]}
                            onChange={(e) =>
                              setInputs((prev) => setField(prev, field.key, e.target.value))
                            }
                            className={`numeric h-11 w-full rounded-lg border border-line bg-paper text-body text-ink outline-none transition-colors focus:border-ink ${
                              field.unit === "$" ? "pl-7 pr-3" : "px-3"
                            } ${field.unit === "%" || field.unit === "h" ? "pr-8" : ""}`}
                          />
                          {field.unit === "%" || field.unit === "h" ? (
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-meta text-ink-tertiary">
                              {field.unit}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-4 bg-wash/40 p-5 sm:p-6">
              <p className="eyebrow text-ink-tertiary">Annual gains</p>
              <OutRow
                label="Capacity recovered"
                detail={`${formatNum(result.recoveredCases, 1)} cases recovered`}
                value={formatMoney(result.capacityGain)}
                tone="capacity"
              />
              <OutRow
                label="Nursing hours returned"
                detail={`${formatNum(result.nurseHours)} nurse hours per year`}
                value={formatMoney(result.labourGain)}
                tone="labour"
              />
              <OutRow
                label="Rescues avoided"
                detail={`${formatNum(result.visitsAvoided, 1)} visits avoided`}
                value={formatMoney(result.rescueGain)}
                tone="rescue"
              />

              <p className="eyebrow mt-2 text-ink-tertiary">Cost</p>
              <OutRow
                label="Mend, all monitored cases"
                detail={`${formatNum(result.monitored)} cases monitored`}
                value={`−${formatMoney(result.cost)}`}
                tone="cost"
              />

              <motion.div
                key={negative ? "shortfall" : "benefit"}
                initial={reduce ? false : { opacity: 0.6, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className={`mt-2 rounded-xl border px-4 py-4 ${
                  negative
                    ? "border-severity-red-border bg-severity-red-bg"
                    : "border-severity-green-border bg-severity-green-bg"
                }`}
              >
                <p
                  className={`text-meta ${
                    negative ? "text-severity-red-fg" : "text-severity-green-fg"
                  }`}
                >
                  {negative ? "Net annual shortfall" : "Net annual benefit"}
                </p>
                <p
                  className={`mt-1 font-heading text-vital tabular-nums tracking-tight ${
                    negative ? "text-severity-red-fg" : "text-severity-green-fg"
                  }`}
                >
                  {negative ? "−" : ""}
                  {formatMoney(Math.abs(result.net))}
                </p>
                <p className="mt-2 text-meta text-ink-secondary">
                  Return on spend{" "}
                  <span className="font-medium text-ink">
                    {Number.isFinite(result.roi) ? `${result.roi.toFixed(1)}×` : "—"}
                  </span>
                  {" · "}
                  breaks even at{" "}
                  <span className="font-medium text-ink">
                    {formatMoney(result.breakeven)}
                  </span>{" "}
                  per case
                </p>

                <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-paper/80">
                  <motion.span
                    className="bg-ink"
                    animate={{ width: `${(result.capacityGain / tot) * 100}%` }}
                    transition={{ type: "spring", stiffness: 220, damping: 28 }}
                  />
                  <motion.span
                    className="bg-severity-green-fg"
                    animate={{ width: `${(result.labourGain / tot) * 100}%` }}
                    transition={{ type: "spring", stiffness: 220, damping: 28 }}
                  />
                  <motion.span
                    className="bg-severity-amber-fg"
                    animate={{ width: `${(result.rescueGain / tot) * 100}%` }}
                    transition={{ type: "spring", stiffness: 220, damping: 28 }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-meta text-ink-tertiary">
                  <span className="inline-flex items-center gap-1.5">
                    <i className="inline-block size-2 rounded-sm bg-ink" />
                    Capacity
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="inline-block size-2 rounded-sm bg-severity-green-fg" />
                    Labour
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="inline-block size-2 rounded-sm bg-severity-amber-fg" />
                    Rescues
                  </span>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

function OutRow({
  label,
  detail,
  value,
  tone,
}: {
  label: string;
  detail: string;
  value: string;
  tone: "capacity" | "labour" | "rescue" | "cost";
}) {
  const valueClass =
    tone === "cost"
      ? "text-severity-red-fg"
      : tone === "capacity"
        ? "text-ink"
        : tone === "labour"
          ? "text-severity-green-fg"
          : "text-severity-amber-fg";

  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/80 pb-3 last:border-0">
      <div>
        <p className="text-label text-ink">{label}</p>
        <p className="mt-0.5 text-meta text-ink-tertiary">{detail}</p>
      </div>
      <p className={`numeric shrink-0 text-subhead tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
