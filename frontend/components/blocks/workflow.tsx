import { AnimatedGroup } from "@/components/ui/animated-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
  {
    n: "01",
    title: "Upload or describe",
    body: "Drop a paper, or tell CanvasAI what you want to learn. Agent 0 retrieves grounding context.",
  },
  {
    n: "02",
    title: "The pipeline runs",
    body: "Synthesizer reads the canvas. Architect picks a strategy. Schema Enforcer emits strict React Flow JSON.",
  },
  {
    n: "03",
    title: "Interact and revert",
    body: "Click, drag, ask edge cases. Slide back at any time — the backend prunes context to match.",
  },
];

export function Workflow() {
  return (
    <section id="workflow" className="border-y bg-zinc-50 py-16 md:py-24 dark:bg-transparent">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <h2 className="text-balance text-3xl font-semibold md:text-4xl">How a session flows</h2>
        </div>
        <AnimatedGroup
          preset="blur-slide"
          className="mt-12 grid gap-4 md:grid-cols-3"
          variants={{
            container: { visible: { transition: { staggerChildren: 0.12 } } },
          }}
        >
          {STEPS.map((s) => (
            <Card key={s.n} className="bg-background">
              <CardHeader>
                <div className="text-muted-foreground mb-3 font-mono text-sm">{s.n}</div>
                <CardTitle className="text-lg font-medium">{s.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </AnimatedGroup>
      </div>
    </section>
  );
}
