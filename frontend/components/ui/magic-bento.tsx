"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

// --- Types ---
export interface MagicContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  spotlightRadius?: number;
  glowColor?: string;
  disableAnimations?: boolean;
}

export interface MagicCardProps extends React.HTMLAttributes<HTMLDivElement> {
  enableStars?: boolean;
  enableBorderGlow?: boolean;
  enableTilt?: boolean;
  enableMagnetism?: boolean;
  clickEffect?: boolean;
  particleCount?: number;
  glowColor?: string;
  disableAnimations?: boolean;
}

const DEFAULT_GLOW_COLOR = "132, 0, 255"; // CanvasAI Purple

// --- Helpers ---
const createParticleElement = (x: number, y: number, color: string): HTMLDivElement => {
  const el = document.createElement("div");
  el.className = "magic-particle";
  el.style.cssText = `
    position: absolute;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(${color}, 1);
    box-shadow: 0 0 6px rgba(${color}, 0.6);
    pointer-events: none;
    z-index: 10;
    left: ${x}px;
    top: ${y}px;
  `;
  return el;
};

// --- Container Component (Handles Spotlight) ---
export function MagicContainer({
  children,
  className,
  spotlightRadius = 400,
  glowColor = DEFAULT_GLOW_COLOR,
  disableAnimations = false,
  ...props
}: MagicContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disableAnimations || !containerRef.current) return;

    const spotlight = document.createElement("div");
    spotlight.style.cssText = `
      position: fixed;
      width: ${spotlightRadius * 2}px;
      height: ${spotlightRadius * 2}px;
      border-radius: 50%;
      pointer-events: none;
      background: radial-gradient(circle,
        rgba(${glowColor}, 0.35) 0%,
        rgba(${glowColor}, 0.15) 30%,
        transparent 70%
      );
      z-index: 50;
      opacity: 0;
      transform: translate(-50%, -50%);
      mix-blend-mode: screen;
    `;
    document.body.appendChild(spotlight);
    spotlightRef.current = spotlight;

    const handleMouseMove = (e: MouseEvent) => {
      if (!spotlightRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseInside =
        e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;

      const cards = containerRef.current.querySelectorAll(".magic-card");

      if (!mouseInside) {
        gsap.to(spotlightRef.current, { opacity: 0, duration: 0.3, ease: "power2.out" });
        cards.forEach((card) => {
          (card as HTMLElement).style.setProperty("--glow-intensity", "0");
        });
        return;
      }

      const proximity = spotlightRadius * 0.5;
      const fadeDistance = spotlightRadius * 0.75;
      let minDistance = Infinity;

      cards.forEach((card) => {
        const cardElement = card as HTMLElement;
        const cardRect = cardElement.getBoundingClientRect();
        const centerX = cardRect.left + cardRect.width / 2;
        const centerY = cardRect.top + cardRect.height / 2;
        const distance = Math.hypot(e.clientX - centerX, e.clientY - centerY) - Math.max(cardRect.width, cardRect.height) / 2;
        const effectiveDistance = Math.max(0, distance);

        minDistance = Math.min(minDistance, effectiveDistance);

        let glowIntensity = 0;
        if (effectiveDistance <= proximity) glowIntensity = 1;
        else if (effectiveDistance <= fadeDistance) glowIntensity = (fadeDistance - effectiveDistance) / (fadeDistance - proximity);

        // Update card border glow
        const relativeX = ((e.clientX - cardRect.left) / cardRect.width) * 100;
        const relativeY = ((e.clientY - cardRect.top) / cardRect.height) * 100;
        cardElement.style.setProperty("--glow-x", `${relativeX}%`);
        cardElement.style.setProperty("--glow-y", `${relativeY}%`);
        cardElement.style.setProperty("--glow-intensity", glowIntensity.toString());
      });

      gsap.to(spotlightRef.current, { left: e.clientX, top: e.clientY, duration: 0.1, ease: "power2.out" });
      const targetOpacity = minDistance <= proximity ? 0.8 : minDistance <= fadeDistance ? ((fadeDistance - minDistance) / (fadeDistance - proximity)) * 0.8 : 0;
      gsap.to(spotlightRef.current, { opacity: targetOpacity, duration: targetOpacity > 0 ? 0.2 : 0.5, ease: "power2.out" });
    };

    const handleMouseLeave = () => {
      if (spotlightRef.current) gsap.to(spotlightRef.current, { opacity: 0, duration: 0.3, ease: "power2.out" });
      containerRef.current?.querySelectorAll(".magic-card").forEach((card) => {
        (card as HTMLElement).style.setProperty("--glow-intensity", "0");
      });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      spotlightRef.current?.remove();
    };
  }, [disableAnimations, spotlightRadius, glowColor]);

  return (
    <div ref={containerRef} className={cn("magic-container relative", className)} {...props}>
      <style>{`
        .magic-card {
          --glow-x: 50%;
          --glow-y: 50%;
          --glow-intensity: 0;
          --glow-radius: 350px;
        }
        .magic-card--border-glow::after {
          content: '';
          position: absolute;
          inset: 0;
          padding: 3px; /* Border thickness */
          background: radial-gradient(var(--glow-radius) circle at var(--glow-x) var(--glow-y),
              rgba(${glowColor}, calc(var(--glow-intensity) * 1)) 0%,
              rgba(${glowColor}, calc(var(--glow-intensity) * 0.6)) 40%,
              transparent 70%);
          border-radius: inherit;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
          pointer-events: none;
          z-index: 10;
        }
        .magic-particle::before {
          content: ''; position: absolute; inset: -2px;
          background: rgba(${glowColor}, 0.5); border-radius: 50%; z-index: -1;
        }
      `}</style>
      {children}
    </div>
  );
}

// --- Card Component (Handles Tilt, Particles, Hover) ---
export function MagicCard({
  children,
  className,
  enableStars = true,
  enableBorderGlow = true,
  enableTilt = false,
  enableMagnetism = false,
  clickEffect = true,
  particleCount = 12,
  glowColor = DEFAULT_GLOW_COLOR,
  disableAnimations = false,
  ...props
}: MagicCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const particlesInitialized = useRef(false);
  const memoizedParticles = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    if (disableAnimations || !cardRef.current) return;
    const element = cardRef.current;
    let particleTimeouts: NodeJS.Timeout[] = [];
    let isHovered = false;

    const initializeParticles = () => {
      const { width, height } = element.getBoundingClientRect();
      memoizedParticles.current = Array.from({ length: particleCount }, () =>
        createParticleElement(Math.random() * width, Math.random() * height, glowColor)
      );
      particlesInitialized.current = true;
    };

    const handleMouseEnter = () => {
      isHovered = true;
      if (enableTilt) gsap.to(element, { rotateX: 2, rotateY: 2, duration: 0.3, ease: "power2.out", transformPerspective: 1000 });
      
      // Fire particles
      if (enableStars) {
        if (!particlesInitialized.current) initializeParticles();
        memoizedParticles.current.forEach((particle, idx) => {
          const timeout = setTimeout(() => {
            if (!isHovered || !element) return;
            const clone = particle.cloneNode(true) as HTMLDivElement;
            element.appendChild(clone);
            gsap.fromTo(clone, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.7)" });
            gsap.to(clone, { x: (Math.random() - 0.5) * 60, y: (Math.random() - 0.5) * 60, rotation: Math.random() * 360, duration: 2 + Math.random() * 2, repeat: -1, yoyo: true });
            gsap.to(clone, { opacity: 0.1, duration: 1.5, repeat: -1, yoyo: true });
          }, idx * 100);
          particleTimeouts.push(timeout);
        });
      }
    };

    const handleMouseLeave = () => {
      isHovered = false;
      particleTimeouts.forEach(clearTimeout);
      element.querySelectorAll(".magic-particle").forEach(p => {
        gsap.to(p, { scale: 0, opacity: 0, duration: 0.3, onComplete: () => p.remove() });
      });
      if (enableTilt) gsap.to(element, { rotateX: 0, rotateY: 0, duration: 0.3 });
      if (enableMagnetism) gsap.to(element, { x: 0, y: 0, duration: 0.3 });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!enableTilt && !enableMagnetism) return;
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      if (enableTilt) {
        gsap.to(element, { rotateX: ((y - centerY) / centerY) * -4, rotateY: ((x - centerX) / centerX) * 4, duration: 0.1, transformPerspective: 1000 });
      }
      if (enableMagnetism) {
        gsap.to(element, { x: (x - centerX) * 0.05, y: (y - centerY) * 0.05, duration: 0.3 });
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!clickEffect) return;
      const rect = element.getBoundingClientRect();
      const maxDist = Math.max(rect.width, rect.height);
      const ripple = document.createElement("div");
      ripple.style.cssText = `
        position: absolute; width: ${maxDist * 2}px; height: ${maxDist * 2}px; border-radius: 50%;
        background: radial-gradient(circle, rgba(${glowColor}, 0.3) 0%, transparent 70%);
        left: ${e.clientX - rect.left - maxDist}px; top: ${e.clientY - rect.top - maxDist}px;
        pointer-events: none; z-index: 20;
      `;
      element.appendChild(ripple);
      gsap.fromTo(ripple, { scale: 0, opacity: 1 }, { scale: 1, opacity: 0, duration: 0.8, ease: "power2.out", onComplete: () => ripple.remove() });
    };

    element.addEventListener("mouseenter", handleMouseEnter);
    element.addEventListener("mouseleave", handleMouseLeave);
    element.addEventListener("mousemove", handleMouseMove);
    element.addEventListener("click", handleClick);

    return () => {
      element.removeEventListener("mouseenter", handleMouseEnter);
      element.removeEventListener("mouseleave", handleMouseLeave);
      element.removeEventListener("mousemove", handleMouseMove);
      element.removeEventListener("click", handleClick);
    };
  }, [disableAnimations, enableStars, enableTilt, enableMagnetism, clickEffect, glowColor, particleCount]);

  return (
    <div
      ref={cardRef}
      className={cn(
        "magic-card relative overflow-hidden transition-all duration-300",
        enableBorderGlow && "magic-card--border-glow",
        className
      )}
      {...props}
    >
      {/* Ensures children stay above the glow/particles */}
      <div className="relative z-20 h-full w-full">{children}</div>
    </div>
  );
}