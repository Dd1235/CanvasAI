"use client";

import * as React from "react";
import {
  addEdge,
  Background,
  type Connection,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import {
  Brain,
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  History,
  Layers3,
  Loader2,
  Network,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import "@xyflow/react/dist/style.css";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  backendWebSocketUrl,
  buildRecallFromSession,
  exportSessionToKnowledgeGraph,
  getCanvasHistory,
} from "@/lib/canvasai-api";
import type {
  AgentTrace,
  CanvasEdge,
  CanvasNode,
  DemoDocument,
  DemoTurn,
} from "@/lib/canvasai-types";
import { cn } from "@/lib/utils";

type Props = {
  sessionId: string;
  topic: string;
  initialPrompt: string;
  initialNodes: CanvasNode[];
  initialEdges: CanvasEdge[];
  initialTrace: AgentTrace[];
  initialTurns: DemoTurn[];
  documents: DemoDocument[];
};

const PROFILES = ["Spatial", "Micro-step", "Low-stim"];

const AGENT_ICONS = [FileSearch, Brain, Workflow, ShieldCheck];

type BackendStatusFrame = {
  type: "status";
  agent: string;
  message: string;
};

type BackendPayloadFrame = {
  type: "payload";
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

type BackendFrame = BackendStatusFrame | BackendPayloadFrame | { type: "error"; message: string };

type DeckFrame = DemoTurn & {
  payload: {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
  };
};

export function CanvasWorkbench({
  sessionId,
  topic,
  initialPrompt,
  initialNodes,
  initialEdges,
  initialTrace,
  initialTurns,
  documents,
}: Props) {
  const initialDeckFrames = React.useMemo<DeckFrame[]>(() => {
    const seededTurns = initialTurns.length
      ? initialTurns
      : [
          {
            index: 0,
            prompt: initialPrompt,
            summary: "Seeded canvas state.",
            nodes: initialNodes.length,
            edges: initialEdges.length,
          },
        ];

    return seededTurns.map((turn, index) => ({
      ...turn,
      index,
      payload: {
        nodes: initialNodes,
        edges: initialEdges,
      },
    }));
  }, [initialEdges, initialNodes, initialPrompt, initialTurns]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [trace, setTrace] = React.useState(initialTrace);
  const [deckFrames, setDeckFrames] = React.useState(initialDeckFrames);
  const [activeFrameIndex, setActiveFrameIndex] = React.useState(
    Math.max(0, initialDeckFrames.length - 1),
  );
  const [prompt, setPrompt] = React.useState(initialPrompt);
  const [profile, setProfile] = React.useState(PROFILES[0]);
  const [running, setRunning] = React.useState(false);
  const [recalling, setRecalling] = React.useState(false);
  const [exportingGraph, setExportingGraph] = React.useState(false);
  const activeFrame = deckFrames[activeFrameIndex];

  React.useEffect(() => {
    getCanvasHistory(sessionId)
      .then(({ turns: historyTurns }) => {
        if (!historyTurns.length) return;
        const latest = historyTurns[historyTurns.length - 1];
        const frames = historyTurns.map((turn) => ({
          index: turn.turn_index,
          prompt: turn.prompt,
          summary: "Loaded from backend session history.",
          nodes: turn.payload.nodes.length,
          edges: turn.payload.edges.length,
          payload: turn.payload,
        }));
        setNodes(latest.payload.nodes);
        setEdges(latest.payload.edges);
        setDeckFrames(frames);
        setActiveFrameIndex(Math.max(0, frames.length - 1));
      })
      .catch(() => {
        // The backend may be offline while the static mock is still useful.
      });
  }, [sessionId, setEdges, setNodes]);

  const onConnect = React.useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) =>
        addEdge({ ...connection, type: "smoothstep", animated: true }, currentEdges),
      );
      toast.success("Edge added to the local canvas state");
    },
    [setEdges],
  );

  const appendFrame = React.useCallback(
    (frame: Omit<DeckFrame, "index">) => {
      const nextIndex = deckFrames.length;
      setDeckFrames((currentFrames) => [...currentFrames, { ...frame, index: currentFrames.length }]);
      setActiveFrameIndex(nextIndex);
    },
    [deckFrames.length],
  );

  const goToFrame = React.useCallback(
    (index: number) => {
      const frame = deckFrames[index];
      if (!frame) return;
      setActiveFrameIndex(index);
      setNodes(frame.payload.nodes);
      setEdges(frame.payload.edges);
    },
    [deckFrames, setEdges, setNodes],
  );

  const runLocalTurn = (reason = "Local fallback payload rendered") => {
    const trimmedPrompt = prompt.trim() || "Add the next teaching step.";
    const nextIndex = deckFrames.length;
    const nextNodeId = `turn-${nextIndex}`;
    const source = nodes[0]?.id ?? initialNodes[0]?.id;

    const newNode: CanvasNode = {
      id: nextNodeId,
      type: "default",
      position: { x: nextIndex % 2 === 0 ? -90 : 140, y: 420 + nextIndex * 70 },
      data: {
        label: trimmedPrompt.length > 36 ? `${trimmedPrompt.slice(0, 33)}...` : trimmedPrompt,
        detail: `Generated by the frontend mock for ${profile.toLowerCase()} pacing.`,
      },
    };
    const nextNodes = [...nodes, newNode];
    const nextEdges = source
      ? [
          ...edges,
          {
            id: `${source}-${nextNodeId}`,
            source,
            target: nextNodeId,
            type: "smoothstep",
            animated: true,
            label: "next",
          },
        ]
      : edges;

    setNodes(nextNodes);
    setEdges(nextEdges);
    setTrace((currentTrace) =>
      currentTrace.map((entry, index) => ({
        ...entry,
        status: "complete",
        message:
          index === currentTrace.length - 1
            ? `Emitted ${nodes.length + 1} nodes and ${edges.length + 1} edges`
            : entry.message,
      })),
    );
    appendFrame({
      prompt: trimmedPrompt,
      summary: reason,
      nodes: nextNodes.length,
      edges: nextEdges.length,
      payload: {
        nodes: nextNodes,
        edges: nextEdges,
      },
    });
    toast.success(reason);
  };

  const runTurn = async () => {
    const trimmedPrompt = prompt.trim() || "Add the next teaching step.";
    setRunning(true);
    setTrace([
      {
        agent: "frontend",
        label: "Frontend",
        message: "Opening backend WebSocket",
        status: "running",
      },
    ]);

    try {
      await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(backendWebSocketUrl(sessionId));
        const timeout = window.setTimeout(() => {
          socket.close();
          reject(new Error("Backend canvas stream timed out."));
        }, 45000);

        socket.addEventListener("open", () => {
          socket.send(JSON.stringify({ prompt: trimmedPrompt, nodes, edges }));
        });

        socket.addEventListener("message", (event) => {
          const frame = JSON.parse(event.data) as BackendFrame;
          if (frame.type === "status") {
            setTrace((currentTrace) => [
              ...currentTrace.filter((entry) => entry.agent !== "frontend"),
              {
                agent: frame.agent,
                label: agentLabel(frame.agent),
                message: frame.message,
                status: "complete",
              },
            ]);
            return;
          }

          if (frame.type === "payload") {
            window.clearTimeout(timeout);
            setNodes(frame.nodes);
            setEdges(frame.edges);
            appendFrame({
              prompt: trimmedPrompt,
              summary: "Rendered from backend LangGraph payload.",
              nodes: frame.nodes.length,
              edges: frame.edges.length,
              payload: {
                nodes: frame.nodes,
                edges: frame.edges,
              },
            });
            toast.success("Backend canvas payload rendered");
            socket.close();
            resolve();
            return;
          }

          window.clearTimeout(timeout);
          socket.close();
          reject(new Error(frame.message));
        });

        socket.addEventListener("error", () => {
          window.clearTimeout(timeout);
          reject(new Error("Backend WebSocket unavailable."));
        });
      });
    } catch (error) {
      console.error("[canvas-turn]", error);
      runLocalTurn("Backend unavailable, used local fallback.");
    } finally {
      setRunning(false);
    }
  };

  const restoreInitial = () => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setTrace(initialTrace);
    setDeckFrames(initialDeckFrames);
    setActiveFrameIndex(Math.max(0, initialDeckFrames.length - 1));
    toast.success("Timeline restored to the seeded state");
  };

  const addVisualizationTool = (kind: "invariant" | "probe" | "checkpoint") => {
    const nextIndex = nodes.length + 1;
    const toolCopy = {
      invariant: {
        label: "Invariant lens",
        detail: "State the rule that must remain true after every mutation.",
      },
      probe: {
        label: "Misconception probe",
        detail: "Ask what a learner might incorrectly infer from this diagram.",
      },
      checkpoint: {
        label: "Step checkpoint",
        detail: "Pause here and predict the next canvas mutation before revealing it.",
      },
    }[kind];
    const source = nodes[0]?.id;
    const newNode: CanvasNode = {
      id: `tool-${kind}-${nextIndex}`,
      type: "default",
      position: { x: kind === "probe" ? 360 : -360, y: 120 + nextIndex * 35 },
      data: toolCopy,
    };
    setNodes((currentNodes) => [...currentNodes, newNode]);
    if (source) {
      setEdges((currentEdges) => [
        ...currentEdges,
        {
          id: `${source}-${newNode.id}`,
          source,
          target: newNode.id,
          type: "smoothstep",
          animated: kind === "checkpoint",
          label: kind,
        },
      ]);
    }
    toast.success(`${toolCopy.label} added`);
  };

  const addToRecall = async () => {
    setRecalling(true);
    try {
      const result = await buildRecallFromSession({
        sessionId,
        title: topic,
        prompt,
        nodes,
        edges,
      });
      toast.success(`${result.cards.length} active recall cards ready`, {
        description: result.replaced_count
          ? `Replaced ${result.replaced_count} older card${result.replaced_count === 1 ? "" : "s"}.`
          : undefined,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create cards.");
    } finally {
      setRecalling(false);
    }
  };

  const exportToKnowledgeGraph = async () => {
    setExportingGraph(true);
    try {
      const result = await exportSessionToKnowledgeGraph({
        sessionId,
        prompt,
        nodes,
        edges,
      });
      toast.success(result.message || "Knowledge graph update queued");
    } catch {
      toast.info("Knowledge graph export endpoint is not wired yet.", {
        description: "The frontend will POST this session when the backend route is added.",
      });
    } finally {
      setExportingGraph(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="bg-card border-border min-h-[28rem] overflow-hidden rounded-lg border">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            defaultEdgeOptions={{ type: "smoothstep" }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={24} />
            <Controls position="bottom-left" />
            <MiniMap pannable zoomable position="bottom-right" />
          </ReactFlow>
        </ReactFlowProvider>
      </section>

      <aside className="flex min-h-0 flex-col gap-4">
        <div className="bg-card border-border rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Session
              </p>
              <h2 className="mt-1 text-base font-semibold">{topic}</h2>
            </div>
            <Badge variant="secondary">{sessionId}</Badge>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {PROFILES.map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={profile === item ? "default" : "outline"}
                className="px-2"
                onClick={() => setProfile(item)}
              >
                {item}
              </Button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 rounded-md border p-2">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Previous deck step"
              disabled={activeFrameIndex <= 0}
              onClick={() => goToFrame(activeFrameIndex - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="min-w-0 text-center">
              <p className="text-xs font-medium">
                Step {deckFrames.length ? activeFrameIndex + 1 : 0} / {deckFrames.length}
              </p>
              <p className="text-muted-foreground truncate text-[11px]">
                {activeFrame?.prompt ?? "No deck frames"}
              </p>
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Next deck step"
              disabled={activeFrameIndex >= deckFrames.length - 1}
              onClick={() => goToFrame(activeFrameIndex + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="bg-card border-border rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4" />
            <h3 className="text-sm font-semibold">Prompt</h3>
          </div>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 mt-3 min-h-24 w-full resize-none rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={runTurn} disabled={running}>
              {running ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Run turn
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={restoreInitial}>
              <RotateCcw className="size-4" />
              Restore
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={addToRecall} disabled={recalling}>
              {recalling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <BookOpenCheck className="size-4" />
              )}
              Add recall
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={exportToKnowledgeGraph}
              disabled={exportingGraph}
            >
              {exportingGraph ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Network className="size-4" />
              )}
              Export graph
            </Button>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1 rounded-lg">
          <div className="space-y-4 pr-3">
            <PanelBlock title="Visualization Tools" icon={Layers3}>
              <div className="grid gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => addVisualizationTool("invariant")}>
                  Invariant lens
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => addVisualizationTool("probe")}>
                  Misconception probe
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => addVisualizationTool("checkpoint")}>
                  Step checkpoint
                </Button>
              </div>
            </PanelBlock>

            <PanelBlock title="Agent Trace" icon={Zap}>
              <div className="space-y-3">
                {trace.map((entry, index) => {
                  const Icon = AGENT_ICONS[index] ?? CheckCircle2;
                  return (
                    <div key={`${entry.agent}-${index}`} className="flex gap-3">
                      <div className="bg-secondary text-secondary-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{entry.label ?? agentLabel(entry.agent)}</p>
                          <Badge
                            variant={entry.status === "complete" ? "secondary" : "outline"}
                            className="text-[10px]"
                          >
                            {entry.status}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs">{entry.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </PanelBlock>

            <PanelBlock title="Deck Replay" icon={History}>
              <div className="space-y-2">
                {deckFrames.map((frame) => (
                  <button
                    key={`${frame.index}-${frame.prompt}`}
                    type="button"
                    onClick={() => goToFrame(frame.index)}
                    className={cn(
                      "hover:bg-accent hover:text-accent-foreground w-full rounded-md border p-3 text-left transition-colors",
                      frame.index === activeFrameIndex && "bg-accent text-accent-foreground",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">Step {frame.index + 1}</span>
                      <span className="text-muted-foreground text-xs">
                        {frame.nodes} nodes / {frame.edges} edges
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                      {frame.summary}
                    </p>
                  </button>
                ))}
              </div>
            </PanelBlock>

            <PanelBlock title="Grounding Sources" icon={FileSearch}>
              <div className="space-y-2">
                {documents.slice(0, 3).map((doc) => (
                  <div key={doc.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium">{doc.title}</p>
                      <Badge variant={doc.status === "Indexed" ? "secondary" : "outline"}>
                        {doc.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {doc.chunks} chunks · {doc.type}
                    </p>
                  </div>
                ))}
              </div>
            </PanelBlock>
          </div>
        </ScrollArea>
      </aside>
    </div>
  );
}

function PanelBlock({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border-border rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <Separator className="my-3" />
      <div className={cn("text-sm")}>{children}</div>
    </section>
  );
}

function agentLabel(agent: string) {
  const labels: Record<string, string> = {
    agent_0_retrieval: "Retrieval",
    agent_1_synthesizer: "Synthesizer",
    agent_2_architect: "Architect",
    agent_3_schema: "Schema Enforcer",
  };
  return labels[agent] ?? agent;
}
