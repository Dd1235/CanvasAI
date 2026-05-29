"use client";

import * as React from "react";

import { Marquee } from "@/components/ui/marquee";
import { cn } from "@/lib/utils";

// Infinite-scroll strip of tech-stack chips that powers CanvasAI. Single
// row, edges faded out by a horizontal mask so chips emerge and leave
// without a hard cut. Every chip is a shadcn-styled pill — tweakcn paints
// them by changing --card / --border.

const STACK = [
  "Next.js 16",
  "React 19",
  "LangGraph",
  "FastAPI",
  "Supabase Realtime",
  "Inngest",
  "Pydantic",
  "React Flow",
  "Radix UI",
  "Tailwind v4",
  "shadcn/ui",
  "pgvector",
];

export function StackMarquee() {
  return (
    <section className="py-14">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-muted-foreground text-center text-xs font-medium uppercase tracking-[0.18em]">
          Built on a modern, open stack
        </p>
        <div className="mt-6 [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
          <Marquee durationMs={45000} gapPx={24}>
            {STACK.map((label) => (
              <StackChip key={label} label={label} />
            ))}
          </Marquee>
        </div>
      </div>
    </section>
  );
}

function StackChip({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "bg-card border-border text-foreground inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium shadow-sm",
        className,
      )}
    >
      <span className="bg-primary size-1.5 rounded-full" />
      {label}
    </span>
  );
}
