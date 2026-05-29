"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Bento-style feature grid (auto-fit 6 columns; cards opt into spanning).
// Cards inherit shadcn tokens so themes apply automatically.

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
        "grid auto-rows-[14rem] gap-4 md:grid-cols-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

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
  /** Optional decorative layer rendered behind the text. */
  background?: React.ReactNode;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        "group bg-card border-border relative flex flex-col justify-end overflow-hidden rounded-xl border p-5 transition-colors",
        "hover:border-primary/40",
        spanClassName,
        className,
      )}
    >
      {background ? (
        <div className="pointer-events-none absolute inset-0">{background}</div>
      ) : null}
      <div className="relative z-10 flex flex-col gap-2">
        {eyebrow ? (
          <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
            {eyebrow}
          </div>
        ) : null}
        <h3 className="text-foreground text-base font-semibold md:text-lg">{title}</h3>
        <p className="text-muted-foreground text-sm leading-snug">{description}</p>
        {children}
      </div>
    </article>
  );
}
