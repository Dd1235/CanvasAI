"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Reactbits/Magic-UI–style animated border beam. Wraps content in a 1.5px
// border that's painted by a rotating conic-gradient under a `bg-card`
// overlay — the gradient peeks through only at the perimeter, so the card
// looks like it has a single bright spot tracing around the edge. The
// gradient consumes `--primary`, so swapping themes via tweakcn re-paints
// the beam automatically.
export function BorderBeam({
  children,
  className,
  durationMs = 8000,
  innerClassName,
}: {
  children: React.ReactNode;
  className?: string;
  durationMs?: number;
  innerClassName?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl p-[1.5px]", className)}>
      <div
        aria-hidden
        className="absolute inset-[-50%] animate-spin"
        style={{
          animationDuration: `${durationMs}ms`,
          background:
            "conic-gradient(from 0deg at 50% 50%, transparent 0%, var(--primary) 12%, transparent 28%, transparent 55%, var(--primary) 67%, transparent 84%)",
        }}
      />
      <div className={cn("bg-card relative rounded-[inherit]", innerClassName)}>
        {children}
      </div>
    </div>
  );
}
