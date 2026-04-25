import type { ReactNode } from "react";
import { Accessibility, Brain, FileSearch, History } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Brain,
    title: "Interactive React Flow Sandbox",
    body: "Click nodes, drag pointers, break the structure — the LLM recalculates and animates the consequences live.",
  },
  {
    icon: History,
    title: "Stateful Time Machine",
    body: "Revert to any prior canvas state. The backend purges the tangent from context to prevent drift.",
  },
  {
    icon: FileSearch,
    title: "Document-to-Diagram (Visual RAG)",
    body: "Upload papers and API docs. Visual explanations are grounded in your sources via pgvector retrieval.",
  },
  {
    icon: Accessibility,
    title: "Cognitive Load Adaptation",
    body: "Pacing and rendering profiles for neurodivergent learners — high-stim micro-steps or spatial dyslexia mode.",
  },
];

export function Features() {
  return (
    <section id="features" className="bg-zinc-50 py-16 md:py-32 dark:bg-transparent">
      <div className="@container mx-auto max-w-5xl px-6">
        <div className="text-center">
          <h2 className="text-balance text-4xl font-semibold lg:text-5xl">
            Built for inside-out engineering mechanics
          </h2>
          <p className="text-muted-foreground mt-4">
            Where video fails — pointer manipulation, memory layout, deep DSA — CanvasAI thrives.
          </p>
        </div>
        <div className="@min-4xl:max-w-full @min-4xl:grid-cols-4 mx-auto mt-8 grid max-w-sm gap-6 *:text-center md:mt-16 md:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <Card
              key={title}
              className="group bg-background hover:shadow-primary/20 transition-all duration-300 hover:-translate-y-2 hover:shadow-lg"
            >
              <CardHeader className="pb-3">
                <CardDecorator>
                  <Icon className="size-6 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" />
                </CardDecorator>
                <h3 className="mt-6 font-medium">{title}</h3>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

const CardDecorator = ({ children }: { children: ReactNode }) => (
  <div
    aria-hidden
    className="relative mx-auto size-36 [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"
  >
    <div className="absolute inset-0 [--border:black] bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:24px_24px] opacity-10 dark:[--border:white]" />
    <div className="bg-background absolute inset-0 m-auto flex size-12 items-center justify-center border-t border-l">
      {children}
    </div>
  </div>
);
