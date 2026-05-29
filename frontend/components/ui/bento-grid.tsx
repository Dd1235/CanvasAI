"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Bento-style feature grid. 6-column grid; cards opt into spans. Cards
// inherit shadcn tokens so themes apply automatically.

export function BentoGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid auto-rows-[15rem] gap-4 md:grid-cols-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

// Two-zone card layout: a top "decoration zone" that the background owns,
// and a bottom "text zone" that always reads on a solid bg-card surface.
// A gradient mask between the two stops decorations from competing with
// the copy regardless of how busy the backdrop gets.
export function BentoCard({
  children,
  className,
  spanClassName,
  background,
  eyebrow,
  title,
  description,
}: {
  children?: React.ReactNode;
  className?: string;
  /** Tailwind grid-span classes (e.g. "md:col-span-3 md:row-span-2"). */
  spanClassName?: string;
  /** Decorative layer rendered in the top zone, behind a fade. */
  background?: React.ReactNode;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        "group bg-card border-border relative flex h-full flex-col overflow-hidden rounded-xl border transition-colors",
        "hover:border-primary/40",
        spanClassName,
        className,
      )}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {background ? (
          <div className="pointer-events-none absolute inset-0">{background}</div>
        ) : null}
        {/* Fade the bottom edge of the decoration zone into bg-card so
            the text below always lands on a clean surface. */}
        <div
          aria-hidden
          className="from-card pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t to-transparent"
        />
      </div>
      <div className="bg-card relative z-10 px-5 pb-5 pt-3">
        {eyebrow ? (
          <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
            {eyebrow}
          </div>
        ) : null}
        <h3 className="text-foreground mt-1.5 text-base font-semibold md:text-lg">
          {title}
        </h3>
        <p className="text-muted-foreground mt-1 text-sm leading-snug">
          {description}
        </p>
        {children}
      </div>
    </article>
  );
}
