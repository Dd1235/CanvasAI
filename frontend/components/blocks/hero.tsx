import Link from "next/link";
import { ArrowRight, CheckCircle2, FileSearch, Sparkles, Workflow } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AnimatedGroup } from "@/components/ui/animated-group";

export function Hero() {
  return (
    <section className="overflow-hidden">
      <div className="relative pt-32 md:pt-40">
        <div className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--background)_75%)]" />
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
              Stateful visual tutoring
            </div>

            <h1 className="text-foreground mx-auto mt-8 max-w-3xl text-balance text-5xl font-medium md:text-6xl lg:mt-12">
              Replace passive video lectures with a live, interactive canvas.
            </h1>
            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-pretty text-lg">
              CanvasAI translates technical documents and conversational intent into a stateful
              React Flow whiteboard — animated, branchable, and grounded in your sources.
            </p>

            <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
              <Button
                asChild
                size="lg"
                className="rounded-full px-8 py-6 text-lg font-medium shadow-md transition-all duration-200 hover:-translate-y-px hover:shadow-lg"
              >
                <Link href="/signup">
                  Get started
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>

              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground text-lg font-medium underline-offset-4 transition-colors hover:underline"
              >
                Sign in →
              </Link>
            </div>

            <div className="mt-16 rounded-xl border bg-card p-3 text-left shadow-xl shadow-zinc-950/10">
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
            </div>
          </AnimatedGroup>
        </div>
      </div>
    </section>
  );
}
