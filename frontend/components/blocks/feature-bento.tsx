"use client";

import * as React from "react";
import {
  Bookmark,
  FileSearch,
  GitBranch,
  Sparkles,
} from "lucide-react";

import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { cn } from "@/lib/utils";

// Bento grid showcasing CanvasAI's headline capabilities. Each card has a
// short eyebrow + title + body plus a themed decorative background drawn
// from shadcn tokens so tweakcn re-skins them.

export function FeatureBento() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-[0.18em]">
            What CanvasAI does
          </span>
          <h2 className="text-balance mt-3 text-3xl font-semibold md:text-4xl">
            Stateful visual tutoring, built for inside-out engineering
          </h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-sm md:text-base">
            Every prompt becomes a canvas turn that's grounded, branchable, scored, and
            scheduled — so learning compounds across sessions instead of vanishing with the
            tab.
          </p>
        </div>

        <BentoGrid className="mt-12">
          <BentoCard
            spanClassName="md:col-span-3 md:row-span-2"
            eyebrow="Live canvas"
            title="React Flow workbench streamed from a LangGraph pipeline"
            description="Drop a prompt, watch four agents collaborate over a WebSocket, and see the canvas mutate frame-by-frame. Drag nodes, branch off, or revert when an idea fails."
            background={<CanvasBackdrop />}
          />

          <BentoCard
            spanClassName="md:col-span-3 md:row-span-1"
            eyebrow="Knowledge graph"
            title="Topics + mastery, scored on every review"
            description="Canvas turns merge into a per-user graph. Mastery & confidence update live; an adaptive sprint picks what to review next."
            background={<KnowledgeGraphBackdrop />}
          />

          <BentoCard
            spanClassName="md:col-span-2 md:row-span-1"
            eyebrow="Active recall"
            title="Spaced-repetition cards from your canvases"
            description="Each session can mint flashcards with SM-2 scheduling — Again / Hard / Good / Easy."
            background={<RecallBackdrop />}
          />

          <BentoCard
            spanClassName="md:col-span-2 md:row-span-1"
            eyebrow="Time machine"
            title="Checkpoint, revert, branch"
            description="Bookmark any step. Revert to delete a tangent, or branch a new session non-destructively."
            background={<TimelineBackdrop />}
          />

          <BentoCard
            spanClassName="md:col-span-2 md:row-span-1"
            eyebrow="Grounded retrieval"
            title="Document-to-diagram"
            description="Upload PDFs, markdown, or API references. Visual explanations cite the chunks they came from."
            background={<DocumentsBackdrop />}
          />
        </BentoGrid>
      </div>
    </section>
  );
}

// ─── Background decorations ─────────────────────────────────────────────────

function CanvasBackdrop() {
  return (
    <div className="absolute inset-0 opacity-90">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:28px_28px] opacity-40 [mask-image:radial-gradient(ellipse_75%_70%_at_50%_30%,#000_30%,transparent_85%)]" />
      <div className="absolute right-6 top-6 flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-[11px] font-medium backdrop-blur">
        <Sparkles className="text-primary size-3" />
        Streaming
      </div>

      {/* Floating mock nodes wired with a curved svg edge. The single
          edge is animated via stroke-dasharray for a "data is flowing"
          feel. */}
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 400 220"
        preserveAspectRatio="none"
      >
        <path
          d="M 80 60 C 140 60, 160 150, 220 150 S 320 80, 360 80"
          stroke="var(--primary)"
          strokeWidth="1.5"
          fill="none"
          strokeOpacity="0.6"
          strokeDasharray="4 6"
          style={{ animation: "canvasEdgeFlow 3.6s linear infinite" }}
        />
      </svg>

      <FloatingNode className="top-[28%] left-[10%]" label="root" emphasised />
      <FloatingNode className="top-[58%] left-[36%]" label="invariant" />
      <FloatingNode className="top-[30%] right-[12%]" label="probe" />

      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes canvasEdgeFlow {
  from { stroke-dashoffset: 0; }
  to   { stroke-dashoffset: -40; }
}
`,
        }}
      />
    </div>
  );
}

function FloatingNode({
  className,
  label,
  emphasised = false,
}: {
  className?: string;
  label: string;
  emphasised?: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute rounded-md border px-2.5 py-1 text-[11px] font-medium shadow-sm backdrop-blur",
        emphasised
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background/80 text-foreground",
        className,
      )}
    >
      {label}
    </div>
  );
}

function KnowledgeGraphBackdrop() {
  // Mini constellation: a handful of nodes connected by SVG lines, with
  // one node pulsing to suggest mastery updating.
  const nodes: Array<{ x: number; y: number; mastery: number; pulse?: boolean }> = [
    { x: 60, y: 60, mastery: 0.7 },
    { x: 130, y: 110, mastery: 0.5, pulse: true },
    { x: 200, y: 50, mastery: 0.9 },
    { x: 240, y: 130, mastery: 0.35 },
    { x: 320, y: 80, mastery: 0.62 },
  ];
  const links: Array<[number, number]> = [
    [0, 1],
    [1, 2],
    [1, 3],
    [2, 4],
    [3, 4],
  ];
  return (
    <div className="absolute inset-0 opacity-90">
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 400 180"
        preserveAspectRatio="none"
      >
        {links.map(([a, b], idx) => (
          <line
            key={idx}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke="var(--muted-foreground)"
            strokeOpacity="0.4"
            strokeWidth="1"
          />
        ))}
        {nodes.map((node, idx) => (
          <g key={idx}>
            <circle
              cx={node.x}
              cy={node.y}
              r={6 + node.mastery * 5}
              fill="var(--primary)"
              fillOpacity={0.35 + node.mastery * 0.5}
            />
            {node.pulse ? (
              <circle
                cx={node.x}
                cy={node.y}
                r="10"
                fill="none"
                stroke="var(--primary)"
                strokeOpacity="0.6"
                style={{ animation: "kgPulse 2.2s ease-out infinite" }}
              />
            ) : null}
          </g>
        ))}
      </svg>
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes kgPulse {
  0%   { r: 6;  opacity: 0.9; }
  100% { r: 22; opacity: 0;   }
}
`,
        }}
      />
    </div>
  );
}

function RecallBackdrop() {
  // Tilted stack of "cards" — pure divs with rotation transforms.
  return (
    <div className="absolute inset-0">
      <div className="absolute right-4 top-4 flex flex-col gap-2 opacity-80">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-background border-border w-32 rounded-md border p-2 shadow-sm"
            style={{
              transform: `rotate(${(i - 1) * 4}deg) translateX(${i * 6}px)`,
            }}
          >
            <div className="bg-muted h-1.5 w-12 rounded-full" />
            <div className="bg-muted/70 mt-1.5 h-1.5 w-20 rounded-full" />
            <div className="bg-muted/40 mt-1.5 h-1.5 w-16 rounded-full" />
          </div>
        ))}
      </div>
      <Bookmark className="text-primary/40 absolute bottom-4 left-4 size-8" />
    </div>
  );
}

function TimelineBackdrop() {
  // Branching timeline rendered as an SVG that gently fades in.
  return (
    <div className="absolute inset-0 opacity-90">
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 400 180"
        preserveAspectRatio="none"
      >
        <line
          x1="40"
          y1="120"
          x2="360"
          y2="120"
          stroke="var(--border)"
          strokeWidth="2"
        />
        <line
          x1="200"
          y1="120"
          x2="320"
          y2="50"
          stroke="var(--primary)"
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        {[
          [60, 120],
          [120, 120],
          [200, 120],
          [260, 120],
          [320, 120],
          [260, 80],
          [320, 50],
        ].map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === 2 ? 7 : 5}
            fill={i === 2 ? "var(--primary)" : "var(--background)"}
            stroke={i === 2 ? "var(--primary)" : "var(--muted-foreground)"}
            strokeWidth={i === 2 ? 0 : 1.5}
          />
        ))}
      </svg>
      <GitBranch className="text-primary/30 absolute bottom-3 right-3 size-7" />
    </div>
  );
}

function DocumentsBackdrop() {
  // Three offset "documents" with text-line bars.
  return (
    <div className="absolute inset-0">
      <div className="absolute right-4 top-4 flex gap-2 opacity-85">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-background border-border h-24 w-16 rounded-md border p-2 shadow-sm"
            style={{ transform: `translateY(${i * 4}px) rotate(${(i - 1) * 3}deg)` }}
          >
            <div className="bg-primary/30 h-1.5 w-8 rounded-full" />
            {[0, 1, 2, 3].map((j) => (
              <div
                key={j}
                className="bg-muted mt-1.5 h-1 w-full rounded-full"
                style={{ width: `${80 - j * 10}%` }}
              />
            ))}
          </div>
        ))}
      </div>
      <FileSearch className="text-primary/40 absolute bottom-3 left-4 size-7" />
    </div>
  );
}

