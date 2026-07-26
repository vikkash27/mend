"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef, type MouseEvent, type ReactNode } from "react";
import { Hospital, Users } from "lucide-react";
import { landingCopy } from "./copy";
import { useLandingMotion } from "./motion";

/**
 * The gap — denser, interactive panels that grow into view and tilt on hover.
 */
export function Gap() {
  const { fadeUp, growIn, staggerContainer, viewportSpotlight, initial, reduce } =
    useLandingMotion();
  const c = landingCopy.gap;

  return (
    <section className="border-t border-line px-6 py-14 sm:px-10 sm:py-16 lg:px-14 lg:py-20">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial={initial}
        whileInView="show"
        viewport={viewportSpotlight}
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
        <motion.p variants={fadeUp} className="prose-support mt-3">
          {c.support}
        </motion.p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 md:gap-5">
          <GapPanel
            variants={growIn}
            reduce={reduce}
            icon={<Hospital className="size-5" strokeWidth={1.75} />}
            title={c.systemsTitle}
            body={c.systemsBody}
            vignette={<SystemsVignette reduce={reduce} />}
          />
          <GapPanel
            variants={growIn}
            reduce={reduce}
            icon={<Users className="size-5" strokeWidth={1.75} />}
            title={c.familiesTitle}
            body={c.familiesBody}
            vignette={<FamiliesVignette reduce={reduce} />}
          />
        </div>
      </motion.div>
    </section>
  );
}

function GapPanel({
  variants,
  reduce,
  icon,
  title,
  body,
  vignette,
}: {
  variants: import("framer-motion").Variants;
  reduce: boolean;
  icon: ReactNode;
  title: string;
  body: string;
  vignette: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [4, -4]), {
    stiffness: 200,
    damping: 20,
  });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-5, 5]), {
    stiffness: 200,
    damping: 20,
  });

  function onMove(e: MouseEvent) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function onLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <motion.button
      ref={ref}
      type="button"
      variants={variants}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      whileHover={reduce ? undefined : { scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-raised text-left shadow-[0_18px_40px_-28px_rgba(28,25,23,0.35)] outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
    >
      <div className="border-b border-line bg-wash/60 px-5 py-4">{vignette}</div>
      <div className="px-5 py-5">
        <div className="flex items-center gap-2 text-ink">
          <span className="flex size-9 items-center justify-center rounded-full bg-wash text-ink-secondary transition-colors group-hover:bg-ink group-hover:text-paper">
            {icon}
          </span>
          <h3 className="font-heading text-subhead text-ink">{title}</h3>
        </div>
        <p className="mt-3 text-body text-ink-secondary">{body}</p>
      </div>
    </motion.button>
  );
}

function SystemsVignette({ reduce }: { reduce: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-meta text-ink-tertiary">Care team visibility</p>
      <div className="flex items-end gap-1.5">
        {[0.9, 0.75, 0.55, 0.35, 0.18, 0.08].map((h, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-sm bg-ink/80"
            initial={reduce ? false : { scaleY: 0.2, opacity: 0.4 }}
            whileInView={{ scaleY: h, opacity: 0.35 + h * 0.5 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.06, duration: 0.5 }}
            style={{ height: 56, originY: 1 }}
          />
        ))}
      </div>
      <p className="text-meta text-ink-secondary">Signal fades after discharge →</p>
    </div>
  );
}

function FamiliesVignette({ reduce }: { reduce: boolean }) {
  const msgs = [
    { who: "Daughter", text: "Mom okay today??" },
    { who: "Son", text: "Did anyone call her?" },
    { who: "Clinic", text: "Please leave a message…" },
  ];
  return (
    <div className="space-y-2">
      <p className="text-meta text-ink-tertiary">The phone tree</p>
      {msgs.map((m, i) => (
        <motion.div
          key={m.who}
          initial={reduce ? false : { opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 + i * 0.12 }}
          className="rounded-lg border border-line bg-paper px-2.5 py-1.5"
        >
          <p className="text-[10px] font-medium text-ink-tertiary">{m.who}</p>
          <p className="text-meta text-ink">{m.text}</p>
        </motion.div>
      ))}
    </div>
  );
}
