import Link from "next/link";
import { ArrowLeft, Home, MousePointer2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IkSnake } from "@/components/blocks/ik-snake";

export default function NotFound() {
  return (
    <main className="bg-background text-foreground relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      {/* Themed grid + radial mask. Pure CSS vars from globals.css so tweakcn
          themes paint the background without touching this file. */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:28px_28px] opacity-40 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_45%,#000_30%,transparent_85%)]" />

      <IkSnake />

      <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
        <Badge variant="secondary" className="rounded-full">
          <MousePointer2 className="size-3" />
          Move your cursor — the snake is following you
        </Badge>

        <h1 className="text-foreground text-balance text-7xl font-semibold tracking-tight md:text-8xl">
          4&nbsp;0&nbsp;4
        </h1>
        <p className="text-muted-foreground max-w-md text-pretty text-base md:text-lg">
          The page you&apos;re looking for slithered off. While our inverse-kinematics
          snake keeps chasing your pointer, you can head back somewhere useful.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="rounded-full">
            <Link href="/">
              <Home className="size-4" />
              Back to home
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Open dashboard
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
