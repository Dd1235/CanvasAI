"use client";

import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useGesture } from '@use-gesture/react';

export type GalleryItem = {
  id: string;
  // UPGRADE: Content can now be a function that receives its specific expanded state!
  content: React.ReactNode | ((isExpanded: boolean) => React.ReactNode); 
  onClick?: (instanceId: string) => void;
};

type DomeGalleryProps = {
  items?: GalleryItem[];
  expandedInstanceId?: string | null; // Tracks the unique instance
  fit?: number;
  fitBasis?: 'auto' | 'min' | 'max' | 'width' | 'height';
  minRadius?: number;
  maxRadius?: number;
  maxVerticalRotationDeg?: number;
  dragSensitivity?: number;
  segments?: number;
  dragDampening?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  isPaused?: boolean;
  onBackgroundClick?: () => void;
};

type ItemDef = Omit<GalleryItem, 'onClick'> & {
  instanceId: string;
  onClick?: (instanceId: string) => void;
  x: number;
  y: number;
  sizeX: number;
  sizeY: number;
  rotX: number;
  rotY: number;
};

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const wrapAngleSigned = (deg: number) => {
  const a = (((deg + 180) % 360) + 360) % 360;
  return a - 180;
};

function buildItems(pool: GalleryItem[], seg: number): ItemDef[] {
  const xCols = Array.from({ length: seg }, (_, i) => -37 + i * 2);
  const evenYs = [-4, -2, 0, 2, 4];
  const oddYs = [-3, -1, 1, 3, 5];

  const coords = xCols.flatMap((x, c) => {
    const ys = c % 2 === 0 ? evenYs : oddYs;
    return ys.map(y => ({ x, y, sizeX: 2, sizeY: 2 }));
  });

  const totalSlots = coords.length;
  if (!pool || pool.length === 0) return [];

  const usedItems = Array.from({ length: totalSlots }, (_, i) => pool[i % pool.length]);
  const unit = 360 / seg / 2;

  return coords.map((c, i) => {
    const rotY = unit * (c.x + (c.sizeX - 1) / 2);
    const rotX = unit * (c.y - (c.sizeY - 1) / 2);
    const poolItem = usedItems[i];
    
    return {
      ...c,
      instanceId: `${poolItem.id}-instance-${i}`, // Guaranteed unique ID
      id: poolItem.id,
      content: poolItem.content,
      onClick: poolItem.onClick,
      rotX,
      rotY
    };
  });
}

export default function DomeGallery({
  items: rawItems = [],
  expandedInstanceId = null,
  fit = 0.5,
  fitBasis = 'auto',
  minRadius = 400,
  maxRadius = Infinity,
  maxVerticalRotationDeg = 15,
  dragSensitivity = 20,
  segments = 24, 
  dragDampening = 2,
  autoRotate = true,
  autoRotateSpeed = 0.08,
  isPaused = false,
  onBackgroundClick
}: DomeGalleryProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const sphereRef = useRef<HTMLDivElement>(null);

  const rotationRef = useRef({ x: 0, y: 0 });
  const startRotRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const inertiaRAF = useRef<number | null>(null);
  const isHoveredRef = useRef(false);
  const isPausedRef = useRef(isPaused);
  const lockedRadiusRef = useRef<number | null>(null);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const items = useMemo(() => buildItems(rawItems, segments), [rawItems, segments]);

  const updateFades = useCallback(() => {
    if (!sphereRef.current) return;
    const domItems = sphereRef.current.children;
    const globalY = rotationRef.current.y;
    const globalX = rotationRef.current.x;

    for (let i = 0; i < domItems.length; i++) {
      const item = domItems[i] as HTMLElement;
      const baseY = parseFloat(item.getAttribute('data-rot-y') || '0');
      const baseX = parseFloat(item.getAttribute('data-rot-x') || '0');

      const absY = wrapAngleSigned(baseY + globalY);
      const absX = wrapAngleSigned(baseX + globalX);

      const distY = Math.abs(absY);
      const distX = Math.abs(absX);

      const maxY = 65; 
      const maxX = 45;

      let opacity = 1;
      if (distY > 25) opacity *= 1 - ((distY - 25) / (maxY - 25));
      if (distX > 15) opacity *= 1 - ((distX - 15) / (maxX - 15));

      opacity = clamp(opacity, 0, 1);

      item.style.opacity = opacity.toFixed(3);
      item.style.pointerEvents = opacity < 0.1 ? 'none' : 'auto';
      
      const scale = 0.85 + (0.15 * opacity);
      item.style.setProperty('--dyn-scale', scale.toFixed(3));
    }
  }, []);

  const applyTransform = useCallback((xDeg: number, yDeg: number) => {
    const el = sphereRef.current;
    if (el) {
      el.style.transform = `translateZ(calc(var(--radius) * -1)) rotateX(${xDeg}deg) rotateY(${yDeg}deg)`;
      updateFades();
    }
  }, [updateFades]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver(entries => {
      const cr = entries[0].contentRect;
      const w = Math.max(1, cr.width), h = Math.max(1, cr.height);
      const minDim = Math.min(w, h), maxDim = Math.max(w, h), aspect = w / h;
      
      let basis = aspect >= 1.3 ? w : minDim;
      switch (fitBasis) {
        case 'min': basis = minDim; break;
        case 'max': basis = maxDim; break;
        case 'width': basis = w; break;
        case 'height': basis = h; break;
      }
      
      let radius = basis * fit;
      radius = clamp(Math.min(radius, h * 1.35), minRadius, maxRadius);
      lockedRadiusRef.current = Math.round(radius);

      root.style.setProperty('--radius', `${lockedRadiusRef.current}px`);
      applyTransform(rotationRef.current.x, rotationRef.current.y);
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, [fit, fitBasis, minRadius, maxRadius, applyTransform]);

  useEffect(() => {
    if (!autoRotate) return;
    let rafId: number;
    const step = () => {
      // 👇 REMOVED the hover check. It now only pauses if dragged, paused via props, or coasting to a stop.
      if (!draggingRef.current && !isPausedRef.current && !inertiaRAF.current) {
        const nextY = wrapAngleSigned(rotationRef.current.y + autoRotateSpeed);
        rotationRef.current = { ...rotationRef.current, y: nextY };
        applyTransform(rotationRef.current.x, nextY);
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [autoRotate, autoRotateSpeed, applyTransform]);

  const stopInertia = useCallback(() => {
    if (inertiaRAF.current) {
      cancelAnimationFrame(inertiaRAF.current);
      inertiaRAF.current = null;
    }
  }, []);

  const startInertia = useCallback((vx: number, vy: number) => {
      const MAX_V = 1.4;
      let vX = clamp(vx, -MAX_V, MAX_V) * 80;
      let vY = clamp(vy, -MAX_V, MAX_V) * 80;
      let frames = 0;
      const d = clamp(dragDampening, 0, 1);
      const frictionMul = 0.94 + 0.055 * d;
      const stopThreshold = 0.015 - 0.01 * d;
      const maxFrames = Math.round(90 + 270 * d);
      
      const step = () => {
        vX *= frictionMul;
        vY *= frictionMul;
        if (Math.abs(vX) < stopThreshold && Math.abs(vY) < stopThreshold || ++frames > maxFrames) {
          inertiaRAF.current = null;
          return;
        }
        const nextX = clamp(rotationRef.current.x - vY / 200, -maxVerticalRotationDeg, maxVerticalRotationDeg);
        const nextY = wrapAngleSigned(rotationRef.current.y + vX / 200);
        rotationRef.current = { x: nextX, y: nextY };
        applyTransform(nextX, nextY);
        inertiaRAF.current = requestAnimationFrame(step);
      };
      stopInertia();
      inertiaRAF.current = requestAnimationFrame(step);
    },
    [dragDampening, maxVerticalRotationDeg, stopInertia, applyTransform]
  );

  useGesture(
    {
      onDragStart: ({ event }) => {
        stopInertia();
        const evt = event as PointerEvent;
        if (evt.pointerType === 'touch') evt.preventDefault();
        draggingRef.current = true;
        movedRef.current = false;
        startRotRef.current = { ...rotationRef.current };
        startPosRef.current = { x: evt.clientX, y: evt.clientY };
      },
      onDrag: ({ event, last, velocity: velArr, direction: dirArr }) => {
        if (!draggingRef.current || !startPosRef.current) return;
        const evt = event as PointerEvent;
        
        const dxTotal = evt.clientX - startPosRef.current.x;
        const dyTotal = evt.clientY - startPosRef.current.y;

        if (!movedRef.current && (dxTotal * dxTotal + dyTotal * dyTotal > 16)) movedRef.current = true;

        const nextX = clamp(startRotRef.current.x - dyTotal / dragSensitivity, -maxVerticalRotationDeg, maxVerticalRotationDeg);
        const nextY = wrapAngleSigned(startRotRef.current.y + dxTotal / dragSensitivity);

        if (rotationRef.current.x !== nextX || rotationRef.current.y !== nextY) {
          rotationRef.current = { x: nextX, y: nextY };
          applyTransform(nextX, nextY);
        }

        if (last) {
          draggingRef.current = false;
          if (movedRef.current && (Math.abs(velArr[0]) > 0.005 || Math.abs(velArr[1]) > 0.005)) {
            startInertia(velArr[0] * dirArr[0], velArr[1] * dirArr[1]);
          }
          startPosRef.current = null;
          setTimeout(() => (movedRef.current = false), 100); 
        }
      }
    },
    { target: mainRef, eventOptions: { passive: false } }
  );

  const cssStyles = `
    .sphere-root {
      --radius: 520px;
      --circ: calc(var(--radius) * 3.14);
      --rot-y: calc((360deg / var(--segments-x)) / 2);
      --rot-x: calc((360deg / var(--segments-y)) / 2);
      --item-width: calc(var(--circ) / var(--segments-x));
      --item-height: calc(var(--circ) / var(--segments-y));
    }
    .sphere-root * { box-sizing: border-box; }
    .sphere, .sphere-item, .item__content { transform-style: preserve-3d; }
    
    .stage {
      width: 100%; height: 100%; display: grid; place-items: center; position: absolute; inset: 0; margin: auto;
      perspective: calc(var(--radius) * 2.5);
      perspective-origin: 50% 50%;
    }
    .sphere {
      transform: translateZ(calc(var(--radius) * -1));
      will-change: transform;
      position: absolute;
    }
    .sphere-item {
      width: calc(var(--item-width) * var(--item-size-x));
      height: calc(var(--item-height) * var(--item-size-y));
      position: absolute; top: -999px; bottom: -999px; left: -999px; right: -999px; margin: auto;
      transform-origin: 50% 50%; backface-visibility: hidden;
      transform: rotateY(calc(var(--rot-y) * (var(--offset-x) + ((var(--item-size-x) - 1) / 2)))) 
                 rotateX(calc(var(--rot-x) * (var(--offset-y) - ((var(--item-size-y) - 1) / 2)))) 
                 translateZ(var(--radius));
      will-change: opacity;
    }
    .item__content {
      position: absolute; inset: 12px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; backface-visibility: hidden; -webkit-backface-visibility: hidden;
      -webkit-font-smoothing: antialiased; 
      -moz-osx-font-smoothing: grayscale;
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssStyles }} />
      <div
        ref={rootRef}
        className="sphere-root relative w-full h-full"
        style={{
          ['--segments-x' as any]: segments,
          ['--segments-y' as any]: segments,
        } as React.CSSProperties}
      >
        <main
          ref={mainRef}
          className="absolute inset-0 grid place-items-center overflow-hidden select-none bg-transparent"
          style={{ touchAction: 'none', WebkitUserSelect: 'none' }}
          onMouseEnter={() => isHoveredRef.current = true}
          onMouseLeave={() => isHoveredRef.current = false}
          onClick={(e) => {
            if (e.target === mainRef.current) onBackgroundClick?.();
          }}
        >
          <div className="stage pointer-events-none">
            <div ref={sphereRef} className="sphere pointer-events-auto">
              {items.map((it) => {
                // Calculate expanded state specifically for this instance!
                const isExpanded = expandedInstanceId === it.instanceId;
                const renderedContent = typeof it.content === 'function' ? it.content(isExpanded) : it.content;

                return (
                  <div
                    key={it.instanceId}
                    className="sphere-item transition-opacity duration-150 ease-out"
                    data-rot-y={it.rotY}
                    data-rot-x={it.rotX}
                    style={{
                      ['--offset-x' as any]: it.x,
                      ['--offset-y' as any]: it.y,
                      ['--item-size-x' as any]: it.sizeX,
                      ['--item-size-y' as any]: it.sizeY,
                    } as React.CSSProperties}
                  >
                    <div
                      className="item__content"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (draggingRef.current || movedRef.current) return;
                        it.onClick?.(it.instanceId);
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      {renderedContent}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="absolute left-0 right-0 top-0 h-[100px] z-[5] pointer-events-none"
               style={{ background: `linear-gradient(to bottom, hsl(var(--card)), transparent)` }} />
          <div className="absolute left-0 right-0 bottom-0 h-[100px] z-[5] pointer-events-none"
               style={{ background: `linear-gradient(to top, hsl(var(--card)), transparent)` }} />
        </main>
      </div>
    </>
  );
}