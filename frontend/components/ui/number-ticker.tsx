"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Animated number that counts up to `value` when it scrolls into view.
// Uses requestAnimationFrame with an ease-out cubic for a snappier feel
// than a linear interpolation. Holds the final formatted string in state
// so screen readers always see the resolved value.
export function NumberTicker({
  value,
  prefix = "",
  suffix = "",
  durationMs = 1400,
  decimals = 0,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
  decimals?: number;
  className?: string;
}) {
  const [display, setDisplay] = React.useState(prefix + "0" + suffix);
  const elementRef = React.useRef<HTMLSpanElement | null>(null);
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    const node = elementRef.current;
    if (!node) return;

    const formatter = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    const run = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      const t0 = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        const next = value * eased;
        setDisplay(prefix + formatter.format(next) + suffix);
        if (t < 1) window.requestAnimationFrame(tick);
        else setDisplay(prefix + formatter.format(value) + suffix);
      };
      window.requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            run();
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [value, prefix, suffix, durationMs, decimals]);

  return (
    <span ref={elementRef} className={cn("tabular-nums", className)}>
      {display}
    </span>
  );
}
