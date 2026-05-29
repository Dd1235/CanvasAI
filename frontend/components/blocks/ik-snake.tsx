"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Inverse-kinematics chain. The head chases the pointer; every subsequent
// segment is yanked toward its parent and clamped to a fixed bone length,
// which makes the tail trail like a snake regardless of how the head moves.
// Each segment is rendered as a Tailwind-class div so the colour, ring, and
// shadow all inherit shadcn theme variables (--primary, --background, etc.)
// — change them in globals.css or via tweakcn and the snake follows along.

type Point = { x: number; y: number };

const SEGMENT_COUNT = 28;
const BONE_LENGTH = 18;
const SMOOTHING = 0.32; // head lerp toward cursor (0 = frozen, 1 = teleport)

export function IkSnake({
  className,
  initialOrigin,
}: {
  className?: string;
  initialOrigin?: Point;
}) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const segmentRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  // Positions are stored in a ref so the rAF loop never causes React renders.
  const positions = React.useRef<Point[]>([]);
  const target = React.useRef<Point>({ x: 0, y: 0 });
  const initialized = React.useRef(false);

  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const seed = () => {
      const rect = wrapper.getBoundingClientRect();
      const cx = initialOrigin?.x ?? rect.width / 2;
      const cy = initialOrigin?.y ?? rect.height / 2;
      positions.current = Array.from({ length: SEGMENT_COUNT }, (_, i) => ({
        x: cx - i * BONE_LENGTH,
        y: cy,
      }));
      target.current = { x: cx, y: cy };
      initialized.current = true;
    };

    seed();
    const onResize = () => seed();
    window.addEventListener("resize", onResize);

    const onPointerMove = (event: PointerEvent) => {
      const rect = wrapper.getBoundingClientRect();
      target.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };
    // Listen on window so the snake keeps chasing even when the cursor leaves
    // the visible bounds (the chain just stretches toward the edge).
    window.addEventListener("pointermove", onPointerMove);

    let rafId = 0;
    const step = () => {
      const pts = positions.current;
      if (pts.length) {
        const head = pts[0];
        head.x += (target.current.x - head.x) * SMOOTHING;
        head.y += (target.current.y - head.y) * SMOOTHING;

        // Distance constraint pass: each segment is pulled toward its parent
        // and snapped to BONE_LENGTH. This is the same trick FABRIK uses on
        // an open chain when the root is unconstrained.
        for (let i = 1; i < pts.length; i += 1) {
          const parent = pts[i - 1];
          const node = pts[i];
          const dx = node.x - parent.x;
          const dy = node.y - parent.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const ratio = BONE_LENGTH / dist;
          node.x = parent.x + dx * ratio;
          node.y = parent.y + dy * ratio;
        }

        // Write into the DOM via transform so we avoid React reconciliation
        // 60 times per second.
        for (let i = 0; i < pts.length; i += 1) {
          const el = segmentRefs.current[i];
          if (!el) continue;
          el.style.transform = `translate3d(${pts[i].x}px, ${pts[i].y}px, 0) translate(-50%, -50%)`;
        }
      }
      rafId = window.requestAnimationFrame(step);
    };
    rafId = window.requestAnimationFrame(step);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.cancelAnimationFrame(rafId);
    };
  }, [initialOrigin]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: SEGMENT_COUNT }).map((_, i) => {
        const isHead = i === 0;
        // Taper: head a bit bigger, tail thinner. Pure size class lookup so
        // Tailwind's JIT keeps the styles.
        const size =
          i < 3 ? 22 : i < 8 ? 18 : i < 16 ? 14 : i < 22 ? 10 : 7;
        return (
          <div
            key={i}
            ref={(el) => {
              segmentRefs.current[i] = el;
            }}
            style={{
              width: size,
              height: size,
              opacity: 1 - i / (SEGMENT_COUNT * 1.6),
            }}
            className={cn(
              "bg-primary absolute left-0 top-0 rounded-full will-change-transform",
              isHead
                ? "ring-background shadow-primary/30 shadow-lg ring-2"
                : "shadow-primary/10 shadow-sm",
            )}
          />
        );
      })}
    </div>
  );
}
