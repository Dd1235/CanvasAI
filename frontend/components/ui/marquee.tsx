"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Infinite-scroll marquee. Renders the same children twice in a flex row
// and translates the row by -50% so the seam never shows. `reverse` flips
// the direction, `pauseOnHover` is the usual nicety. Tailwind + a tiny
// inline keyframe block keeps it dependency-free.
export function Marquee({
  children,
  className,
  reverse = false,
  pauseOnHover = true,
  durationMs = 32000,
  gapPx = 32,
}: {
  children: React.ReactNode;
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  durationMs?: number;
  gapPx?: number;
}) {
  return (
    <div
      className={cn(
        "group flex w-full overflow-hidden",
        pauseOnHover && "[--play-state:running] hover:[--play-state:paused]",
        className,
      )}
      style={{ ["--marquee-gap" as never]: `${gapPx}px` }}
    >
      <div
        className="marquee-track flex shrink-0 items-center"
        style={{
          gap: `${gapPx}px`,
          paddingInlineEnd: `${gapPx}px`,
          animation: `${reverse ? "marqueeReverse" : "marquee"} ${durationMs}ms linear infinite`,
          animationPlayState: "var(--play-state, running)" as never,
        }}
      >
        {children}
      </div>
      <div
        aria-hidden
        className="marquee-track flex shrink-0 items-center"
        style={{
          gap: `${gapPx}px`,
          paddingInlineEnd: `${gapPx}px`,
          animation: `${reverse ? "marqueeReverse" : "marquee"} ${durationMs}ms linear infinite`,
          animationPlayState: "var(--play-state, running)" as never,
        }}
      >
        {children}
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes marquee {
  from { transform: translateX(0); }
  to { transform: translateX(calc(-100% - var(--marquee-gap, 0px))); }
}
@keyframes marqueeReverse {
  from { transform: translateX(calc(-100% - var(--marquee-gap, 0px))); }
  to { transform: translateX(0); }
}
`,
        }}
      />
    </div>
  );
}
