"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Animated knowledge-graph constellation. Nodes drift, edges fade in when
// neighbours are close, and the field reacts subtly to the cursor (mass-less
// parallax). Everything is drawn into a single <canvas> so it stays cheap at
// 60fps even with 80+ nodes.
//
// Theme integration: stroke / fill colours are read from the computed style
// of an off-screen sentinel that consumes `--primary` and `--foreground`.
// That means changing tokens in globals.css (or pasting a tweakcn export)
// re-skins the constellation with zero JS changes — same story for dark
// mode (we observe documentElement class mutations).

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  pulse: number;
  pulseSpeed: number;
};

const NODE_COUNT = 64;
const LINK_DISTANCE = 140;
const CURSOR_INFLUENCE = 90;

function readCssColor(varName: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const probe = document.createElement("span");
  probe.style.color = `var(${varName})`;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const computed = window.getComputedStyle(probe).color || fallback;
  probe.remove();
  return computed;
}

function parseColor(value: string): [number, number, number] {
  // Handles rgb(), rgba(), and the oklch(...) tokens shadcn ships via the
  // browser's computed-style normalisation (which converts oklch into rgb
  // for `color:`). If anything unexpected slips through we degrade to a
  // neutral grey rather than crashing the animation loop.
  const match = value.match(/-?\d+\.?\d*/g);
  if (!match || match.length < 3) return [120, 120, 120];
  return [Number(match[0]), Number(match[1]), Number(match[2])];
}

export function KnowledgeConstellation({ className }: { className?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let nodes: Node[] = [];
    const cursor = { x: -10000, y: -10000, active: false };
    let dpr = window.devicePixelRatio || 1;
    let width = 0;
    let height = 0;
    let primary: [number, number, number] = [99, 99, 99];
    let muted: [number, number, number] = [160, 160, 160];

    const refreshTheme = () => {
      primary = parseColor(readCssColor("--primary", "rgb(99,99,99)"));
      muted = parseColor(readCssColor("--muted-foreground", "rgb(160,160,160)"));
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Re-seed nodes proportionally when the viewport changes shape.
      nodes = Array.from({ length: NODE_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: 1.4 + Math.random() * 2,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.01 + Math.random() * 0.02,
      }));
    };

    const onMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      cursor.x = event.clientX - rect.left;
      cursor.y = event.clientY - rect.top;
      cursor.active = true;
    };
    const onMouseLeave = () => {
      cursor.active = false;
      cursor.x = -10000;
      cursor.y = -10000;
    };

    refreshTheme();
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    // Re-read theme tokens whenever the .dark class flips (or any other
    // documentElement class mutation that signals a tweakcn theme swap).
    const themeObserver = new MutationObserver(() => refreshTheme());
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, width, height);

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;
        node.pulse += node.pulseSpeed;

        if (cursor.active) {
          const dx = node.x - cursor.x;
          const dy = node.y - cursor.y;
          const dist = Math.hypot(dx, dy);
          if (dist < CURSOR_INFLUENCE && dist > 0.01) {
            // Mild repulsion so the field gently parts around the cursor.
            const force = (1 - dist / CURSOR_INFLUENCE) * 0.6;
            node.x += (dx / dist) * force;
            node.y += (dy / dist) * force;
          }
        }
      }

      // Edges first so they sit behind the nodes.
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK_DISTANCE) {
            const alpha = (1 - dist / LINK_DISTANCE) * 0.4;
            ctx.strokeStyle = `rgba(${muted[0]}, ${muted[1]}, ${muted[2]}, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const node of nodes) {
        const breath = 0.7 + Math.sin(node.pulse) * 0.3;
        ctx.fillStyle = `rgba(${primary[0]}, ${primary[1]}, ${primary[2]}, ${0.45 * breath})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r + breath, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
      aria-hidden
    >
      <canvas ref={canvasRef} className="size-full" />
    </div>
  );
}
