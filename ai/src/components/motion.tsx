"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/* ============================================
   Shared animation variants
   ============================================ */

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.32, 0.72, 0, 1] },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] },
  },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.32, 0.72, 0, 1] },
  },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.32, 0.72, 0, 1] },
  },
};

/* ============================================
   Scroll-reveal wrapper
   ============================================ */

interface RevealProps {
  children: ReactNode;
  className?: string;
  variants?: Variants;
  delay?: number;
  once?: boolean;
}

export function Reveal({
  children,
  className = "",
  variants = fadeUp,
  delay = 0,
  once = true,
}: RevealProps) {
  // If delay is set, wrap the variant to inject transition.delay properly
  const delayedVariants = delay
    ? {
        hidden: variants.hidden,
        visible: {
          ...(typeof variants.visible === "object" ? variants.visible : {}),
          transition: {
            ...((typeof variants.visible === "object" && 'transition' in variants.visible
              ? variants.visible.transition
              : {}) as Record<string, unknown>),
            delay,
          },
        },
      }
    : variants;

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-60px" }}
      variants={delayedVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ============================================
   Stagger wrapper
   ============================================ */

interface StaggerProps {
  children: ReactNode;
  className?: string;
  fast?: boolean;
}

export function Stagger({ children, className = "", fast = false }: StaggerProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={fast ? staggerContainerFast : staggerContainer}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ============================================
   Motion item (for use inside Stagger)
   ============================================ */

interface MotionItemProps {
  children: ReactNode;
  className?: string;
  variants?: Variants;
}

export function MotionItem({
  children,
  className = "",
  variants = fadeUp,
}: MotionItemProps) {
  return (
    <motion.div variants={variants} className={className}>
      {children}
    </motion.div>
  );
}

/* Re-export motion for direct use */
export { motion };
