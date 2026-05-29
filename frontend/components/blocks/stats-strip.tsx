import * as React from "react";

import { NumberTicker } from "@/components/ui/number-ticker";

// Four headline stats. Each card uses shadcn tokens, the numbers tick up
// on scroll. Keep the labels honest — they describe architectural
// choices, not vanity metrics.
const STATS: Array<{
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  hint: string;
}> = [
  {
    value: 4,
    label: "Specialised agents",
    hint: "Retrieval → Synthesizer → Architect → Schema Enforcer",
  },
  {
    value: 100,
    suffix: "%",
    label: "Source-grounded",
    hint: "Every canvas turn cites the chunks it was built from",
  },
  {
    value: 1,
    suffix: "×",
    label: "Real-time stream",
    hint: "Status + payload frames over a single WebSocket per session",
  },
  {
    value: 0,
    suffix: "ms",
    label: "Frontend cache",
    hint: "Top-3 sessions prefetched into a Tanstack-style query cache",
  },
];

export function StatsStrip() {
  return (
    <section className="py-14">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="bg-card border-border rounded-xl border p-5"
            >
              <div className="text-foreground text-3xl font-semibold tracking-tight">
                <NumberTicker
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                />
              </div>
              <div className="text-foreground mt-2 text-sm font-medium">
                {stat.label}
              </div>
              <p className="text-muted-foreground mt-1 text-xs leading-snug">
                {stat.hint}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
