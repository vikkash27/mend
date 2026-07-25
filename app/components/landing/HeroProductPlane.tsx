"use client";

import { motion } from "framer-motion";
import { ProductTheater } from "./ProductTheater";
import { useLandingMotion } from "./motion";

/**
 * Hero media plane. Animated product theater is the default until real usage
 * recordings land in public/landing/ (drop hero.mp4 + hero-poster.jpg, then
 * flip HERO_VIDEO_ENABLED).
 */
const HERO_VIDEO_ENABLED = false;

export function HeroProductPlane() {
  const { fadeUp } = useLandingMotion();

  return (
    <motion.div
      variants={fadeUp}
      className="relative w-full"
      aria-hidden="true"
    >
      <ProductTheater className="min-h-[26rem] sm:min-h-[30rem]" />
      {HERO_VIDEO_ENABLED ? <HeroVideoUnderlay /> : null}
    </motion.div>
  );
}

function HeroVideoUnderlay() {
  const { reduce } = useLandingMotion();
  return (
    <video
      className="absolute inset-0 h-full w-full rounded-2xl object-cover"
      autoPlay={!reduce}
      muted
      loop
      playsInline
      poster="/landing/hero-poster.jpg"
    >
      <source src="/landing/hero.mp4" type="video/mp4" />
      <source src="/landing/hero.webm" type="video/webm" />
    </video>
  );
}
