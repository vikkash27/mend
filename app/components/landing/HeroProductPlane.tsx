"use client";

import { motion } from "framer-motion";
import { ProductTheater } from "./ProductTheater";
import { useLandingMotion } from "./motion";

/**
 * Hero media plane — looping product theater (call → engine → truth).
 */
export function HeroProductPlane() {
  const { fadeUp } = useLandingMotion();

  return (
    <motion.div
      variants={fadeUp}
      className="relative w-full"
      aria-hidden="true"
    >
      <ProductTheater className="min-h-[26rem] sm:min-h-[30rem]" />
    </motion.div>
  );
}
