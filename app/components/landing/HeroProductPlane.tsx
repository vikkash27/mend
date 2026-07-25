"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useLandingMotion } from "./motion";

const VIDEO_SRC = "/landing/hero.mp4";
const POSTER_SRC = "/landing/hero-poster.jpg";

export function HeroProductPlane() {
  const { reduce, fadeUp } = useLandingMotion();
  const [videoOk, setVideoOk] = useState(true);

  return (
    <motion.div
      variants={fadeUp}
      className="relative aspect-[4/3] w-full overflow-hidden bg-wash sm:aspect-[16/10] lg:aspect-auto lg:min-h-[28rem] lg:flex-1"
      aria-hidden="true"
    >
      {/* HTML product mock — always present as fallback / underlay */}
      <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-br from-wash via-paper to-wash-strong p-8 sm:p-10">
        <div className="space-y-3">
          <p className="eyebrow">Live check-in</p>
          <p className="font-heading text-heading tracking-tight text-ink">
            Margaret · morning call
          </p>
          <p className="max-w-sm font-serif text-lede text-ink-secondary">
            “A little short of breath when I stood up — nothing like yesterday.”
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 border-t border-line pt-6">
          {[
            { label: "HR", value: "122", unit: "bpm" },
            { label: "Rhythm", value: "Sinus tach", unit: "" },
            { label: "SpO₂", value: "94", unit: "%" },
          ].map((tile) => (
            <div key={tile.label}>
              <p className="text-meta text-ink-tertiary">{tile.label}</p>
              <p className="numeric mt-1 text-vital text-ink">
                {tile.value}
                {tile.unit ? (
                  <span className="ml-1 text-label text-ink-tertiary">
                    {tile.unit}
                  </span>
                ) : null}
              </p>
            </div>
          ))}
        </div>
      </div>

      {videoOk ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay={!reduce}
          muted
          loop
          playsInline
          poster={POSTER_SRC}
          onError={() => setVideoOk(false)}
        >
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
      ) : null}
    </motion.div>
  );
}
