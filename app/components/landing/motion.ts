"use client";

import { useReducedMotion, type Variants } from "framer-motion";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

/** Scale-up on scroll — use for spotlight panels. */
export const growIn: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 20 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

export const staggerFast: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const viewportOnce = { once: true, amount: 0.25 } as const;
export const viewportSpotlight = { once: true, amount: 0.35 } as const;

export function useLandingMotion() {
  const reduce = Boolean(useReducedMotion());
  const reducedFade: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.2 } },
  };
  const reducedGrow: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.2 } },
  };
  return {
    reduce,
    initial: reduce ? ("show" as const) : ("hidden" as const),
    fadeUp: reduce ? reducedFade : fadeUp,
    growIn: reduce ? reducedGrow : growIn,
    staggerContainer: reduce
      ? ({ hidden: {}, show: {} } satisfies Variants)
      : staggerContainer,
    staggerFast: reduce
      ? ({ hidden: {}, show: {} } satisfies Variants)
      : staggerFast,
    viewportOnce,
    viewportSpotlight,
  };
}
