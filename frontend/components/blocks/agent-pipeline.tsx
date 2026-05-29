"use client";

import * as React from "react";
import {
  Brain,
  FileSearch,
  Network,
  Sparkles,
  Workflow,
} from "lucide-react";

import { cn } from "@/lib/utils";

// Visualises the multi-agent canvas turn: a packet hops left→right across
// four agents (Retrieval → Synthesizer → Architect → Schema Enforcer),
// then the canvas tile lights up. Pure CSS animations + shadcn tokens, so
// dropping a tweakcn theme into globals.css re-skins everything.

const AGENTS = [
  {
    icon: FileSearch,
    label: "Retrieval",
    detail: "Pulls grounding chunks from indexed sources.",
  },
  {
    icon: Brain,
    label: "Synthesizer",
    detail: "Reads the prompt + current canvas state into a directive.",
  },
  {
    icon: Workflow,
    label: "Architect",
    detail: "Picks a pacing strategy and lays out the next mutation.",
  },
  {
    icon: Sparkles,
    label: "Schema Enforcer",
    detail: "Emits strict React Flow JSON the canvas can apply directly.",
  },
] as const;

export function AgentPipeline() {
  return (
    <section
      id="workflow"
      className="border-y bg-zinc-50 py-20 md:py-28 dark:bg-transparent"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-[0.18em]">
            Multi-agent canvas turn
          </span>
          <h2 className="text-balance mt-3 text-3xl font-semibold md:text-4xl">
            Four specialised agents, one streaming pipeline
          </h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-sm md:text-base">
            Each prompt becomes a directed sequence — retrieval grounds the request, the
            synthesizer compresses intent, the architect chooses a teaching shape, and the
            schema enforcer emits canvas-ready JSON. You see every hand-off live over the
            WebSocket.
          </p>
        </div>

        <div className="relative mt-12 grid gap-4 md:grid-cols-[repeat(4,minmax(0,1fr))_auto] md:items-stretch">
          {AGENTS.map((agent, index) => (
            <AgentCard key={agent.label} agent={agent} index={index} />
          ))}

          {/* Final canvas tile — pulses just after the last agent fires. */}
          <div
            className="relative col-span-full md:col-span-1 rounded-xl border bg-card p-4"
            style={{ animation: "agentTilePulse 4.8s ease-in-out infinite" }}
          >
            <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
              Canvas
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Network className="size-4" />
              <span className="text-sm font-semibold">React Flow JSON</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-muted relative h-6 rounded-sm overflow-hidden"
                >
                  <div
                    className="bg-primary/70 absolute inset-0"
                    style={{
                      animation: `agentTileFill 4.8s ease-in-out ${i * 0.08}s infinite`,
                      transformOrigin: "left",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <style
          dangerouslySetInnerHTML={{
            __html: `
@keyframes agentBeam {
  0%, 100% { opacity: 0; transform: translateX(0); }
  10%      { opacity: 1; }
  90%      { opacity: 1; }
  100%     { opacity: 0; transform: translateX(120%); }
}
@keyframes agentCardPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); }
  50%      { box-shadow: 0 0 0 4px var(--ring); }
}
@keyframes agentTilePulse {
  0%, 70%, 100% { transform: scale(1); }
  85%           { transform: scale(1.02); }
}
@keyframes agentTileFill {
  0%, 60%, 100% { transform: scaleX(0); }
  75%           { transform: scaleX(1); }
}
`,
          }}
        />
      </div>
    </section>
  );
}

function AgentCard({
  agent,
  index,
}: {
  agent: (typeof AGENTS)[number];
  index: number;
}) {
  const Icon = agent.icon;
  // Stagger the pulse so the four cards visibly fire in sequence over a
  // ~4.8s cycle (1.2s per agent).
  const delay = index * 1.2;
  return (
    <div className="relative flex flex-col">
      <div
        className={cn(
          "bg-card border-border relative flex h-full flex-col gap-3 rounded-xl border p-4",
        )}
        style={{
          animation: `agentCardPulse 4.8s ease-in-out ${delay}s infinite`,
        }}
      >
        <div className="flex items-center gap-2">
          <div className="bg-secondary text-secondary-foreground flex size-9 items-center justify-center rounded-md">
            <Icon className="size-4" />
          </div>
          <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
            Agent {index}
          </div>
        </div>
        <div className="text-sm font-semibold">{agent.label}</div>
        <p className="text-muted-foreground text-xs leading-snug">{agent.detail}</p>
      </div>

      {/* Beam connector. Hidden on the last card (no successor). */}
      {index < AGENTS.length - 1 ? (
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-[-1rem] hidden h-px w-4 -translate-y-1/2 md:block"
        >
          <div className="bg-border h-full w-full" />
          <div
            className="absolute top-1/2 left-0 h-2 w-3 -translate-y-1/2 rounded-full bg-primary blur-[2px]"
            style={{
              animation: `agentBeam 4.8s linear ${delay + 0.9}s infinite`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
