import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BorderBeam } from "@/components/ui/border-beam";

// Final call-to-action panel. BorderBeam wraps the card so the CTA reads
// as the visual punchline of the page. Background uses CSS vars so it
// inherits the active shadcn / tweakcn theme.
export function LandingCTA() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-6">
        <BorderBeam durationMs={10000} className="overflow-hidden">
          <div className="relative isolate">
            <div className="absolute inset-0 -z-10 [background:radial-gradient(125%_125%_at_50%_0%,var(--muted)_0%,transparent_55%)]" />
            <div className="flex flex-col items-center gap-6 px-6 py-16 text-center md:py-20">
              <span className="text-muted-foreground inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em]">
                <Sparkles className="size-3" />
                Built for the LinkedIn Hackathon
              </span>
              <h2 className="text-foreground text-balance text-3xl font-semibold md:text-5xl">
                Stop watching lectures. Start interrogating diagrams.
              </h2>
              <p className="text-muted-foreground max-w-2xl text-sm md:text-base">
                CanvasAI is open and self-hostable. Sign in to drive your first canvas in
                under a minute — the stack handles real-time streaming, retrieval grounding,
                and the spaced-repetition loop for you.
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="rounded-full px-7">
                  <Link href="/signup">
                    Create your workspace
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full px-7">
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            </div>
          </div>
        </BorderBeam>
      </div>
    </section>
  );
}
