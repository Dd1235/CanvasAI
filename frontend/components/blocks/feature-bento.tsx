"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";

import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { cn } from "@/lib/utils";

// Bento grid showcasing CanvasAI's headline capabilities. Each card has a
// short eyebrow + title + body. Backgrounds live in the decoration zone
// (top half of the card) and fade into bg-card before the text starts,
// so the copy stays readable no matter how busy the backdrop gets.
//
// Layout (6 columns):
//   row 1 │ ┌── Live canvas (4×2) ──┐ ┌─ KG (2×1) ─┐
//   row 2 │ │                       │ ┌── Recall ──┐
//   row 3 │ ┌─── Time machine (3×1) ─┐ ┌── Docs (3×1) ─┐
// This way every row sums to 6 columns — no dead space on the right.

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
            spanClassName="md:col-span-4 md:row-span-2"
            eyebrow="Live canvas"
            title="React Flow workbench streamed from a LangGraph pipeline"
            description="Drop a prompt, watch four agents collaborate over a WebSocket, and see the canvas mutate frame-by-frame. Drag nodes, branch off, or revert when an idea fails."
            background={<CanvasBackdrop />}
          />

          <BentoCard
            spanClassName="md:col-span-2 md:row-span-1"
            eyebrow="Knowledge graph"
            title="Mastery, scored on every review"
            description="Canvas turns merge into a per-user graph. An adaptive sprint picks what to review next."
            background={<KnowledgeGraphBackdrop />}
          />

          <BentoCard
            spanClassName="md:col-span-2 md:row-span-1"
            eyebrow="Active recall"
            title="Spaced-repetition cards"
            description="Each session can mint flashcards with SM-2 scheduling — Again, Hard, Good, Easy."
            background={<RecallBackdrop />}
          />

          <BentoCard
            spanClassName="md:col-span-3 md:row-span-1"
            eyebrow="Time machine"
            title="Checkpoint, revert, branch"
            description="Bookmark any step. Revert to delete a tangent, or branch a new session non-destructively."
            background={<TimelineBackdrop />}
          />

          <BentoCard
            spanClassName="md:col-span-3 md:row-span-1"
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
//
// All decorations live in the BentoCard's decoration zone — the gradient
// fade in BentoCard erases anything that strays into the bottom 5rem, so
// these don't need to know exactly where the text ends.

function CanvasBackdrop() {
  return (
    <div className="absolute inset-0 opacity-90">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:28px_28px] opacity-40 [mask-image:radial-gradient(ellipse_75%_70%_at_50%_30%,#000_30%,transparent_85%)]" />
      <div className="absolute right-5 top-5 flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-[11px] font-medium backdrop-blur">
        <Sparkles className="text-primary size-3" />
        Streaming
      </div>

      {/* Two flowing edges + four nodes, sized for the 4×2 hero card. */}
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 400 240"
        preserveAspectRatio="none"
      >
        <path
          d="M 70 70 C 130 70, 150 140, 200 140 S 290 90, 350 90"
          stroke="var(--primary)"
          strokeWidth="1.5"
          fill="none"
          strokeOpacity="0.55"
          strokeDasharray="4 6"
          style={{ animation: "canvasEdgeFlow 3.6s linear infinite" }}
        />
        <path
          d="M 70 70 C 110 90, 130 110, 200 140"
          stroke="var(--muted-foreground)"
          strokeWidth="1"
          fill="none"
          strokeOpacity="0.35"
        />
        <path
          d="M 200 140 C 260 170, 290 150, 350 160"
          stroke="var(--muted-foreground)"
          strokeWidth="1"
          fill="none"
          strokeOpacity="0.3"
          strokeDasharray="2 4"
        />
      </svg>

      <FloatingNode className="top-[22%] left-[12%]" label="root" emphasised />
      <FloatingNode className="top-[55%] left-[42%]" label="invariant" />
      <FloatingNode className="top-[30%] right-[14%]" label="probe" />
      <FloatingNode className="top-[65%] right-[8%]" label="branch" />

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
  const nodes: Array<{ x: number; y: number; mastery: number; pulse?: boolean }> = [
    { x: 40, y: 50, mastery: 0.7 },
    { x: 110, y: 90, mastery: 0.5, pulse: true },
    { x: 180, y: 40, mastery: 0.9 },
    { x: 220, y: 110, mastery: 0.35 },
  ];
  const links: Array<[number, number]> = [
    [0, 1],
    [1, 2],
    [1, 3],
    [2, 3],
  ];
  return (
    <div className="absolute inset-0 opacity-90">
      <svg
        className="absolute inset-x-0 top-0 h-full w-full"
        viewBox="0 0 260 150"
        preserveAspectRatio="xMidYMid meet"
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
  // Tilted stack of "cards" pinned to the top-right corner. No floating
  // icon — the eyebrow + title carry the label.
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
    </div>
  );
}

function TimelineBackdrop() {
  // Branching timeline centred in the upper half so the dots never sit
  // on top of the title text below.
  return (
    <div className="absolute inset-0 opacity-90">
      <svg
        className="absolute inset-x-0 top-0 h-full w-full"
        viewBox="0 0 400 150"
        preserveAspectRatio="xMidYMid meet"
      >
        <line x1="40" y1="80" x2="360" y2="80" stroke="var(--border)" strokeWidth="2" />
        <line
          x1="200"
          y1="80"
          x2="320"
          y2="30"
          stroke="var(--primary)"
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        {[
          [60, 80],
          [120, 80],
          [200, 80],
          [260, 80],
          [320, 80],
          [260, 50],
          [320, 30],
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
    </div>
  );
}

function DocumentsBackdrop() {
  // Three offset "documents" pinned top-right. No floating icon over the
  // text zone.
  return (
    <div className="absolute inset-0">
      <div className="absolute right-5 top-4 flex gap-2 opacity-85">
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
                className="bg-muted mt-1.5 h-1 rounded-full"
                style={{ width: `${80 - j * 10}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
