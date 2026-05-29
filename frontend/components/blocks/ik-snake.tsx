"use client";

import * as React from "react";
import { RotateCcw, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Inverse-kinematics snake game. The head lerps toward the cursor; each
// segment is yanked toward its parent and clamped to a fixed bone length
// (the distance-constraint pass FABRIK uses on an open chain). Floating
// "404" pellets spawn around the viewport — drive the cursor over one and
// the snake collects it, scoring a point and growing the tail. Best score
// is persisted to localStorage so the screen rewards return visits.
//
// All colours / rings / shadows route through shadcn tokens
// (--primary, --background, --border, --muted-foreground), so dropping a
// tweakcn theme into globals.css re-skins both the snake and the pellets
// with zero code changes.

type Point = { x: number; y: number };
type Pellet = { id: number; x: number; y: number; label: string };
type Floater = { id: number; x: number; y: number };

const INITIAL_SEGMENTS = 18;
const MAX_SEGMENTS = 90;
const SEGMENTS_PER_PELLET = 3;
const BONE_LENGTH = 16;
const SMOOTHING = 0.32;
const HEAD_RADIUS = 14;
const PELLET_RADIUS = 22;
const PELLET_COUNT = 4;
const PELLET_EDGE_PADDING = 80;
const PELLET_LABELS = ["404", "?", "404", "404", "?!"];
const BEST_KEY = "canvasai-404-best";

function pickLabel() {
  return PELLET_LABELS[Math.floor(Math.random() * PELLET_LABELS.length)];
}

function spawnPellet(width: number, height: number, id: number): Pellet {
  // Keep pellets a bit inside the viewport so the badge never clips off
  // the edge, and biased away from the dead-centre so they don't all stack
  // on the 404 headline.
  const minX = PELLET_EDGE_PADDING;
  const minY = PELLET_EDGE_PADDING;
  const maxX = Math.max(minX + 1, width - PELLET_EDGE_PADDING);
  const maxY = Math.max(minY + 1, height - PELLET_EDGE_PADDING);
  return {
    id,
    x: minX + Math.random() * (maxX - minX),
    y: minY + Math.random() * (maxY - minY),
    label: pickLabel(),
  };
}

export function IkSnakeGame() {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const segmentLayerRef = React.useRef<HTMLDivElement | null>(null);
  const segmentRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  // Engine state lives in refs so the rAF loop never causes React renders.
  const positions = React.useRef<Point[]>([]);
  const target = React.useRef<Point>({ x: 0, y: 0 });
  const segmentCountRef = React.useRef(INITIAL_SEGMENTS);
  const pelletsRef = React.useRef<Pellet[]>([]);
  const nextIdRef = React.useRef(1);

  // UI-visible state: React is in charge of rendering pellets + HUD.
  const [pellets, setPellets] = React.useState<Pellet[]>([]);
  const [score, setScore] = React.useState(0);
  const [best, setBest] = React.useState(0);
  const [floaters, setFloaters] = React.useState<Floater[]>([]);
  const [, forceSegments] = React.useReducer((x: number) => x + 1, 0);

  // Keep refs and React state in lockstep for pellets so collision checks
  // (in the rAF loop) and the rendered DOM agree.
  const setPelletsBoth = React.useCallback((next: Pellet[]) => {
    pelletsRef.current = next;
    setPellets(next);
  }, []);

  const seedPellets = React.useCallback(
    (width: number, height: number) => {
      const initial: Pellet[] = [];
      for (let i = 0; i < PELLET_COUNT; i += 1) {
        initial.push(spawnPellet(width, height, nextIdRef.current));
        nextIdRef.current += 1;
      }
      setPelletsBoth(initial);
    },
    [setPelletsBoth],
  );

  const resetGame = React.useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    segmentCountRef.current = INITIAL_SEGMENTS;
    positions.current = Array.from({ length: INITIAL_SEGMENTS }, (_, i) => ({
      x: cx - i * BONE_LENGTH,
      y: cy,
    }));
    target.current = { x: cx, y: cy };
    setScore(0);
    seedPellets(rect.width, rect.height);
    forceSegments();
  }, [seedPellets]);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(BEST_KEY);
    if (stored) {
      const parsed = Number.parseInt(stored, 10);
      if (Number.isFinite(parsed) && parsed > 0) setBest(parsed);
    }
  }, []);

  React.useEffect(() => {
    if (score > best) {
      setBest(score);
      window.localStorage.setItem(BEST_KEY, String(score));
    }
  }, [score, best]);

  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const seed = () => {
      const rect = wrapper.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      positions.current = Array.from({ length: segmentCountRef.current }, (_, i) => ({
        x: cx - i * BONE_LENGTH,
        y: cy,
      }));
      target.current = { x: cx, y: cy };
      seedPellets(rect.width, rect.height);
      forceSegments();
    };
    seed();

    const onResize = () => {
      const rect = wrapper.getBoundingClientRect();
      // Keep the existing pellets if they still fit, otherwise re-seed so
      // we don't strand any off the new viewport.
      const stillValid = pelletsRef.current.every(
        (p) =>
          p.x >= PELLET_EDGE_PADDING &&
          p.x <= rect.width - PELLET_EDGE_PADDING &&
          p.y >= PELLET_EDGE_PADDING &&
          p.y <= rect.height - PELLET_EDGE_PADDING,
      );
      if (!stillValid) seedPellets(rect.width, rect.height);
    };
    window.addEventListener("resize", onResize);

    const onPointerMove = (event: PointerEvent) => {
      const rect = wrapper.getBoundingClientRect();
      target.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };
    window.addEventListener("pointermove", onPointerMove);

    const onPointerDown = (event: PointerEvent) => {
      // Tap support for touch devices: jump the target so the snake darts
      // toward the tap point. Standard pointermove handles drag.
      const rect = wrapper.getBoundingClientRect();
      target.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };
    window.addEventListener("pointerdown", onPointerDown);

    let raf = 0;
    const step = () => {
      const pts = positions.current;
      const desired = segmentCountRef.current;
      // Grow the chain in place when a pellet bumps the count up.
      if (pts.length < desired && pts.length > 0) {
        const tail = pts[pts.length - 1];
        while (pts.length < desired) {
          pts.push({ x: tail.x, y: tail.y });
        }
      }

      if (pts.length) {
        const head = pts[0];
        head.x += (target.current.x - head.x) * SMOOTHING;
        head.y += (target.current.y - head.y) * SMOOTHING;

        // Distance-constraint pass: each segment is pulled to its parent
        // and snapped to BONE_LENGTH.
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

        for (let i = 0; i < pts.length; i += 1) {
          const el = segmentRefs.current[i];
          if (!el) continue;
          el.style.transform = `translate3d(${pts[i].x}px, ${pts[i].y}px, 0) translate(-50%, -50%)`;
        }

        // Pellet collision against the head only — simple circle test.
        const headPt = pts[0];
        let collected: Pellet | null = null;
        for (const pellet of pelletsRef.current) {
          const dx = headPt.x - pellet.x;
          const dy = headPt.y - pellet.y;
          if (Math.hypot(dx, dy) < HEAD_RADIUS + PELLET_RADIUS) {
            collected = pellet;
            break;
          }
        }
        if (collected) {
          const rect = wrapper.getBoundingClientRect();
          const replacement = spawnPellet(rect.width, rect.height, nextIdRef.current);
          nextIdRef.current += 1;
          setPelletsBoth(
            pelletsRef.current.map((p) => (p.id === collected!.id ? replacement : p)),
          );
          setScore((current) => current + 1);
          segmentCountRef.current = Math.min(
            MAX_SEGMENTS,
            segmentCountRef.current + SEGMENTS_PER_PELLET,
          );
          forceSegments();

          // Floating +1 marker at the collection point. We drop it after
          // 900ms so the DOM stays clean during long sessions.
          const floaterId = nextIdRef.current;
          nextIdRef.current += 1;
          setFloaters((current) => [
            ...current,
            { id: floaterId, x: collected!.x, y: collected!.y },
          ]);
          window.setTimeout(() => {
            setFloaters((current) => current.filter((f) => f.id !== floaterId));
          }, 900);
        }
      }

      raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.cancelAnimationFrame(raf);
    };
  }, [seedPellets, setPelletsBoth]);

  const segmentNodes = React.useMemo(() => {
    const count = segmentCountRef.current;
    return Array.from({ length: count }, (_, i) => {
      const size =
        i === 0 ? 26 : i < 3 ? 22 : i < 8 ? 18 : i < 16 ? 14 : i < 24 ? 11 : 8;
      const opacity = 1 - i / (count * 1.7);
      const isHead = i === 0;
      return { i, size, opacity, isHead };
    });
    // The reducer key is what tells React when to rebuild the segments —
    // we explicitly forceSegments() whenever segmentCountRef changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  return (
    <>
      {/* Snake + pellets layer. pointer-events-none so the layer never
          steals clicks from the HUD or the body links. */}
      <div
        ref={wrapperRef}
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div ref={segmentLayerRef} className="absolute inset-0">
          {segmentNodes.map(({ i, size, opacity, isHead }) => (
            <div
              key={i}
              ref={(el) => {
                segmentRefs.current[i] = el;
              }}
              style={{ width: size, height: size, opacity }}
              className={cn(
                "bg-primary absolute left-0 top-0 rounded-full will-change-transform",
                isHead
                  ? "ring-background shadow-primary/40 shadow-lg ring-2"
                  : "shadow-primary/10 shadow-sm",
              )}
            />
          ))}
        </div>

        {/* Pellets — small CanvasAI-themed badges. They sit under the snake
            layer visually but above the grid backdrop. */}
        {pellets.map((pellet) => (
          <div
            key={pellet.id}
            style={{
              transform: `translate3d(${pellet.x}px, ${pellet.y}px, 0) translate(-50%, -50%)`,
            }}
            className="absolute left-0 top-0 flex size-11 items-center justify-center"
          >
            <span className="bg-primary/10 absolute inset-0 animate-ping rounded-full" />
            <span className="bg-background text-primary border-primary/40 ring-primary/20 relative flex size-10 items-center justify-center rounded-full border text-xs font-semibold shadow-md ring-2">
              {pellet.label}
            </span>
          </div>
        ))}

        {/* Floating +1 markers — quick rise-and-fade after each catch.
            The outer div parks the marker at the pellet position; the
            inner span runs the animation on a separate transform stack so
            the two never fight each other. */}
        {floaters.map((floater) => (
          <div
            key={floater.id}
            style={{
              transform: `translate3d(${floater.x}px, ${floater.y}px, 0) translate(-50%, -50%)`,
            }}
            className="absolute left-0 top-0"
          >
            <span className="ik-snake-float text-primary block text-sm font-semibold">
              +1
            </span>
          </div>
        ))}
      </div>

      {/* HUD card — interactive, sits on top of everything. */}
      <div className="pointer-events-auto absolute right-4 top-4 z-20 flex flex-col items-end gap-2 md:right-6 md:top-6">
        <div className="bg-card/90 border-border flex items-center gap-3 rounded-xl border px-4 py-2 shadow-sm backdrop-blur">
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
              Rescued
            </span>
            <span className="text-foreground text-lg font-semibold leading-none">
              {score}
            </span>
          </div>
          <div className="bg-border h-8 w-px" />
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide">
              <Trophy className="size-3" />
              Best
            </span>
            <span className="text-foreground text-lg font-semibold leading-none">
              {best}
            </span>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={resetGame}
            title="Restart the chase"
            className="ml-1"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
        <Badge variant="outline" className="bg-background/70 backdrop-blur">
          Drive the cursor — catch a 404 to grow the snake
        </Badge>
      </div>

      {/* Float animation lives next to the component so it travels with it
          and stays theme-agnostic. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes ikSnakeFloat {
  0% { opacity: 0; transform: translateY(0); }
  15% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-26px); }
}
.ik-snake-float { animation: ikSnakeFloat 900ms ease-out forwards; }
`,
        }}
      />
    </>
  );
}

// Keep the legacy export name so anything that still imports `IkSnake` —
// e.g. the not-found page during the rollout — keeps compiling.
export { IkSnakeGame as IkSnake };
