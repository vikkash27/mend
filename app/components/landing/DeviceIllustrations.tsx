"use client";

import { motion } from "framer-motion";

/**
 * Flat 2D hardware drawings for the landing integrations section.
 * Clinical / schematic — not photoreal, not 3D.
 */

export function KardiaSensorDrawing({
  className,
  pulse = false,
}: {
  className?: string;
  pulse?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 160 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Body — KardiaMobile 6L slab */}
      <rect
        x="28"
        y="18"
        width="104"
        height="60"
        rx="10"
        fill="var(--color-ink)"
      />
      <rect
        x="34"
        y="24"
        width="92"
        height="48"
        rx="7"
        fill="var(--color-raised)"
      />
      {/* Dual electrode pads */}
      <rect x="44" y="34" width="28" height="28" rx="5" fill="var(--color-wash-strong)" />
      <rect x="88" y="34" width="28" height="28" rx="5" fill="var(--color-wash-strong)" />
      <circle cx="58" cy="48" r="7" fill="var(--color-ink)" opacity="0.18" />
      <circle cx="102" cy="48" r="7" fill="var(--color-ink)" opacity="0.18" />
      {/* Lead tip / USB edge */}
      <rect x="126" y="40" width="10" height="16" rx="2" fill="var(--color-ink)" />
      {/* Trace */}
      <motion.path
        d="M42 72 H54 L60 66 L68 78 L76 60 L84 74 L92 68 H118"
        stroke="var(--color-signal)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={false}
        animate={
          pulse
            ? { pathLength: [0.2, 1, 0.2], opacity: [0.45, 1, 0.45] }
            : { pathLength: 1, opacity: 0.85 }
        }
        transition={
          pulse
            ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
            : undefined
        }
      />
      <text
        x="80"
        y="14"
        textAnchor="middle"
        fill="var(--color-ink-tertiary)"
        style={{ fontSize: 9, fontFamily: "var(--font-sans)", letterSpacing: "0.08em" }}
      >
        KardiaMobile 6L
      </text>
    </svg>
  );
}

export function WatchDrawing({
  className,
  pulse = false,
  bpm,
}: {
  className?: string;
  pulse?: boolean;
  bpm?: number;
}) {
  return (
    <svg
      viewBox="0 0 120 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Strap top */}
      <rect x="42" y="4" width="36" height="28" rx="8" fill="var(--color-ink)" />
      <rect x="46" y="8" width="28" height="20" rx="5" fill="var(--color-ink-secondary)" opacity="0.35" />
      {/* Case */}
      <rect
        x="28"
        y="30"
        width="64"
        height="76"
        rx="16"
        fill="var(--color-ink)"
      />
      <rect
        x="34"
        y="36"
        width="52"
        height="64"
        rx="12"
        fill="var(--color-paper)"
      />
      {/* Crown */}
      <rect x="90" y="58" width="6" height="16" rx="2" fill="var(--color-ink)" />
      {/* Face content */}
      <text
        x="60"
        y="54"
        textAnchor="middle"
        fill="var(--color-ink-tertiary)"
        style={{ fontSize: 8, fontFamily: "var(--font-sans)", letterSpacing: "0.1em" }}
      >
        HR
      </text>
      <text
        x="60"
        y="78"
        textAnchor="middle"
        fill="var(--color-ink)"
        style={{
          fontSize: 22,
          fontFamily: "var(--font-sans)",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 500,
        }}
      >
        {bpm ?? 76}
      </text>
      <text
        x="60"
        y="92"
        textAnchor="middle"
        fill="var(--color-ink-tertiary)"
        style={{ fontSize: 8, fontFamily: "var(--font-sans)" }}
      >
        bpm
      </text>
      {/* Pulse ring */}
      <motion.circle
        cx="60"
        cy="68"
        r="26"
        stroke="var(--color-signal)"
        strokeWidth="1.5"
        fill="none"
        opacity={0.35}
        animate={
          pulse
            ? { scale: [1, 1.08, 1], opacity: [0.25, 0.55, 0.25] }
            : { scale: 1, opacity: 0.3 }
        }
        transition={
          pulse
            ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
            : undefined
        }
        style={{ transformOrigin: "60px 68px" }}
      />
      {/* Strap bottom */}
      <rect x="42" y="104" width="36" height="28" rx="8" fill="var(--color-ink)" />
      <rect
        x="46"
        y="108"
        width="28"
        height="20"
        rx="5"
        fill="var(--color-ink-secondary)"
        opacity="0.35"
      />
      <text
        x="60"
        y="138"
        textAnchor="middle"
        fill="var(--color-ink-tertiary)"
        style={{ fontSize: 9, fontFamily: "var(--font-sans)", letterSpacing: "0.08em" }}
      >
        Patient watch
      </text>
    </svg>
  );
}
