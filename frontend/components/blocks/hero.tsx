import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  Sparkles,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { AnimatedGroup } from "@/components/ui/animated-group";
import { Ballpit } from "@/components/ui/ballpit";
import { BorderBeam } from "@/components/ui/border-beam";
import { GradientText } from "@/components/ui/gradient-text";
import { KnowledgeConstellation } from "@/components/blocks/knowledge-constellation";

export function Hero() {
  return (
    <section className="overflow-hidden">
      <div className="relative pt-32 md:pt-40">
        {/* Layered backdrop: animated graph constellation behind a radial
            fade that re-uses the shadcn --background token. Both layers
            inherit any tweakcn-injected theme automatically. */}
        <KnowledgeConstellation className="-z-20 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,#000_30%,transparent_85%)]" />

        {/* Layer 1: The Interactive 3D Ballpit */}
        <div className="absolute inset-0 -z-20 size-full opacity-60 dark:opacity-40 pointer-events-auto">
          <Ballpit
            count={100}
            gravity={0.01}
            friction={0.9975}
            wallBounce={0.95}
            followCursor={false}
            colors={[0x7dd3fc, 0x38bdf8, 0x60a5fa, 0x0ea5e9]}
          />
        </div>
        
        {/* Layer 2: The Vignette Masking Gradient */}
        <div className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--background)_80%)] pointer-events-none" />

        <div className="mx-auto max-w-5xl px-6 text-center">
          <AnimatedGroup
            variants={{
              container: {
                visible: { transition: { staggerChildren: 0.05, delayChildren: 0.4 } },
              },
              item: {
                hidden: { opacity: 0, filter: "blur(4px)", y: 30 },
                visible: {
                  opacity: 1,
                  filter: "blur(0px)",
                  y: 0,
                  transition: { type: "spring", bounce: 0.4, duration: 0.7 },
                },
              },
            }}
          >
            <div className="bg-muted text-muted-foreground mx-auto inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium">
              <Sparkles className="size-3" />
              Stateful visual tutoring · streaming multi-agent canvas
            </div>

            <h1 className="text-foreground mx-auto mt-8 max-w-3xl text-balance text-5xl font-medium md:text-6xl lg:mt-12">
              Replace passive video lectures with a{" "}
              <GradientText className="bg-clip-text">live, interactive canvas.</GradientText>
            </h1>
            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-pretty text-lg">
              CanvasAI streams a four-agent LangGraph pipeline into a React Flow whiteboard,
              folds each turn into your personal knowledge graph, and schedules
              spaced-repetition cards from the bits that mattered.
            </p>

            <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
              <Button
                asChild
                size="lg"
                className="rounded-full px-8 py-6 text-lg font-medium text-white bg-[#0A66C2] shadow-md border-0 transition-all duration-300 hover:-translate-y-px hover:bg-[#004182] hover:shadow-[0_0_20px_rgba(10,102,194,0.4)] focus-visible:ring-2 focus-visible:ring-[#0A66C2] focus-visible:outline-none"
              >
                <Link href="/signup">
                  Get started
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>

              <Link
                href="/login"
                className="text-muted-foreground hover:text-[#0A66C2] text-lg font-medium underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A66C2] rounded-md px-3 py-1"
              >
                Sign in →
              </Link>
            </div>

            <BorderBeam
              className="mt-16 shadow-xl shadow-zinc-950/10"
              innerClassName="p-3 text-left"
              durationMs={9000}
            >
              <div className="flex items-center justify-between border-b px-3 py-2">
                <div className="flex items-center gap-2">
                  <Workflow className="size-4" />
                  <span className="text-sm font-medium">Binary Search Trees</span>
                </div>
                <div className="text-muted-foreground hidden items-center gap-2 text-xs sm:flex">
                  <CheckCircle2 className="size-3.5" />
                  4 agents complete
                </div>
              </div>
              <div className="grid gap-3 p-3 lg:grid-cols-[1fr_18rem]">
                <div className="bg-background relative min-h-72 overflow-hidden rounded-lg border">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:28px_28px] opacity-40" />
                  <div className="bg-border absolute top-[31%] left-[43%] h-px w-[18%] rotate-[28deg]" />
                  <div className="bg-border absolute top-[31%] right-[43%] h-px w-[18%] -rotate-[28deg]" />
                  <div className="bg-primary absolute top-[13%] left-1/2 w-28 -translate-x-1/2 rounded-md px-3 py-2 text-center text-sm font-semibold text-primary-foreground shadow-sm">
                    42 root
                  </div>
                  <div className="bg-card absolute top-[47%] left-[14%] w-32 rounded-md border px-3 py-2 text-center text-sm shadow-sm">
                    21 left
                  </div>
                  <div className="bg-card absolute top-[47%] right-[14%] w-32 rounded-md border px-3 py-2 text-center text-sm shadow-sm">
                    64 right
                  </div>
                  <div className="border-primary/50 bg-primary/10 text-primary absolute bottom-[12%] left-1/2 w-40 -translate-x-1/2 rounded-md border px-3 py-2 text-center text-xs font-medium">
                    duplicate edge case
                  </div>
                </div>

                <div className="hidden rounded-lg border bg-background p-4 lg:block">
                  <div className="mb-4 flex items-center gap-2">
                    <FileSearch className="size-4" />
                    <span className="text-sm font-medium">Agent trace</span>
                  </div>
                  {[
                    "Retrieved source chunks",
                    "Synthesized directive",
                    "Chose micro-step layout",
                    "Emitted React Flow JSON",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 border-t py-3 first:border-t-0 first:pt-0">
                      <CheckCircle2 className="text-primary size-4" />
                      <span className="text-muted-foreground text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </BorderBeam>
          </AnimatedGroup>
        </div>
      </div>
    </section>
  );
}
