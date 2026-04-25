import { CanvasWorkbench } from "@/components/canvas/canvas-workbench";
import { Badge } from "@/components/ui/badge";
import { DEMO_DOCUMENTS, getCanvasSession } from "@/lib/mock-data";

type Params = Promise<{ id: string }>;

export default async function CanvasPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = getCanvasSession(id);

  return (
    <div className="flex h-[calc(100svh-3.5rem)] flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-foreground text-xl font-semibold tracking-tight">
            {session.topic}{" "}
            <code className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-sm">
              {id}
            </code>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Frontend demo using the same nodes, edges, trace, and turn shape as the backend
            WebSocket payload.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{session.profile}</Badge>
          <Badge variant="outline">{session.confidence} confidence</Badge>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <CanvasWorkbench
          sessionId={session.id}
          topic={session.topic}
          initialPrompt={session.prompt}
          initialNodes={session.nodes}
          initialEdges={session.edges}
          initialTrace={session.trace}
          initialTurns={session.turns}
          documents={DEMO_DOCUMENTS}
        />
      </div>
    </div>
  );
}
