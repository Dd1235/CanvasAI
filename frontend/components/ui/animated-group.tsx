"use client";

import * as React from "react";
import { motion, type Variants } from "motion/react";

import { cn } from "@/lib/utils";

type Preset =
  | "fade"
  | "slide"
  | "scale"
  | "blur"
  | "blur-slide"
  | "zoom"
  | "bounce";

type Props = {
  children: React.ReactNode;
  className?: string;
  variants?: { container?: Variants; item?: Variants };
  preset?: Preset;
};

const containerDefault: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const itemDefault: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const PRESETS: Record<Preset, { container: Variants; item: Variants }> = {
  fade: { container: containerDefault, item: itemDefault },
  slide: {
    container: containerDefault,
    item: { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } },
  },
  scale: {
    container: containerDefault,
    item: {
      hidden: { opacity: 0, scale: 0.9 },
      visible: { opacity: 1, scale: 1 },
    },
  },
  blur: {
    container: containerDefault,
    item: {
      hidden: { opacity: 0, filter: "blur(4px)" },
      visible: { opacity: 1, filter: "blur(0px)" },
    },
  },
  "blur-slide": {
    container: containerDefault,
    item: {
      hidden: { opacity: 0, filter: "blur(4px)", y: 20 },
      visible: { opacity: 1, filter: "blur(0px)", y: 0 },
    },
  },
  zoom: {
    container: containerDefault,
    item: {
      hidden: { opacity: 0, scale: 0.5 },
      visible: {
        opacity: 1,
        scale: 1,
        transition: { type: "spring", stiffness: 300, damping: 20 },
      },
    },
  },
  bounce: {
    container: containerDefault,
    item: {
      hidden: { opacity: 0, y: -50 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring", stiffness: 400, damping: 10 },
      },
    },
  },
};

export function AnimatedGroup({ children, className, variants, preset }: Props) {
  const selected = preset ? PRESETS[preset] : { container: containerDefault, item: itemDefault };
  const c = variants?.container ?? selected.container;
  const i = variants?.item ?? selected.item;

  return (
    <motion.div initial="hidden" animate="visible" variants={c} className={cn(className)}>
      {React.Children.map(children, (child, idx) => (
        <motion.div key={idx} variants={i}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
