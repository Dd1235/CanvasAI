"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  FileSearch,
  Layers3,
  Loader2,
  Network,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
  Bot,
  MessageSquare,
  Wrench,
  GitCommitHorizontal
} from "lucide-react";
import { toast } from "sonner";

import "@xyflow/react/dist/style.css";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import DotGrid from "@/components/ui/dot-grid";
import { Separator } from "@/components/ui/separator";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  backendWebSocketUrl,
  buildRecallFromSession,
  exportSessionToKnowledgeGraph,
  revertSessionToTurn,
  branchSessionFromTurn,
  updateSessionProfile,
} from "@/lib/canvasai-api";
import {
  prefetchSessionHistory,
  sessionHistoryKey,
  setCached,
  useQuery,
  type CanvasHistory,
} from "@/lib/session-cache";
import { createClient } from "@/lib/supabase/client";
import { useKnowledgeGraphJob } from "@/hooks/useKnowledgeGraphJob";
import { ResourceModal } from "./ResourceModal";
import type {
  AgentTrace,
  CanvasEdge,
  CanvasNode,
  DemoTurn,
  SessionTurn,
  CanvasPayload,
} from "@/lib/canvasai-types";
import { cn } from "@/lib/utils";
import { MemoryBlock } from "./nodes/MemoryBlock";
import { LogicGateNode } from "./nodes/LogicGateNode";
import LessonPlanNode from "./nodes/LessonPlanNode";
import CodeStepperNode from "./nodes/CodeStepperNode";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// NEW: Import the timeline
import { VerticalTimeline } from "./timeline/vertical-timeline";

type Props = {
  sessionId: string;
  topic: string;
  initialProfile?: string;
};

const PROFILES = ["Spatial", "Micro-step", "Low-stim"];
const AGENT_ICONS = [FileSearch, Brain, Workflow, ShieldCheck];

type BackendStatusFrame = { type: "status"; agent: string; message: string };
type BackendPayloadFrame = {
  type: "payload";
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  ai_response?: string;
  step_title?: string;
};
type BackendFrame =
  | BackendStatusFrame
  | BackendPayloadFrame
  | { type: "error"; message: string };

type DeckFrame = DemoTurn & {
  payload: CanvasPayload & { step_title?: string };
};

const nodeTypes = {
  memory_block: MemoryBlock,
  logic_gate: LogicGateNode,
  lesson_plan: LessonPlanNode,
  code_stepper: CodeStepperNode,
};

function framesFromHistory(historyTurns: SessionTurn[]): DeckFrame[] {
  return historyTurns.map((turn) => ({
    index: turn.turn_index,
    prompt: turn.prompt,
    summary: turn.payload?.ai_response || "Canvas updated.",
    nodes: turn.payload.nodes.length,
    edges: turn.payload.edges.length,
    payload: turn.payload as any,
  }));
}

export function CanvasWorkbench({ sessionId, topic, initialProfile }: Props) {
  const router = useRouter();

  const historyQuery = useQuery<CanvasHistory>(
    sessionHistoryKey(sessionId),
    () => import("@/lib/canvasai-api").then((m) => m.getCanvasHistory(sessionId)),
    { staleTime: 60_000 },
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>([]);
  const [trace, setTrace] = React.useState<AgentTrace[]>([]);
  const [deckFrames, setDeckFrames] = React.useState<DeckFrame[]>([]);
  const [activeFrameIndex, setActiveFrameIndex] = React.useState(0);
  const [prompt, setPrompt] = React.useState("");
  const [profile, setProfile] = React.useState(initialProfile || PROFILES[0]);
  const [running, setRunning] = React.useState(false);

  // States for loaders
  const [recalling, setRecalling] = React.useState(false);
  const [exportingGraph, setExportingGraph] = React.useState(false);
  const [pendingBuildId, setPendingBuildId] = React.useState<string | null>(null);
  const [branchingIndex, setBranchingIndex] = React.useState<number | null>(null);

  // Auth & UI State
  const [token, setToken] = React.useState<string | null>(null);
  // NEW: Added timeline tab
  const [activeTab, setActiveTab] = React.useState<"chat" | "tools" | "timeline">("chat");

  const chatScrollRef = React.useRef<HTMLDivElement>(null);
  const hydratedSessionRef = React.useRef<string | null>(null);

  const handleProfileChange = async (newProfile: string) => {
    setProfile(newProfile);
    try {
      await updateSessionProfile(sessionId, newProfile);
      toast.success(`${newProfile} profile active and saved.`);
    } catch (error) {
      toast.error("Failed to save profile preference.");
    }
  };

  // Listen for background job completion modularly
  useKnowledgeGraphJob({
    buildId: pendingBuildId,
    onSuccess: () => {
      toast.success("Knowledge Graph Updated Successfully! ✨");
      setExportingGraph(false);
      setPendingBuildId(null);
    },
    onError: () => {
      toast.error("Failed to update Knowledge Graph.");
      setExportingGraph(false);
      setPendingBuildId(null);
    },
  });

  React.useEffect(() => {
    const fetchToken = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (data.session) setToken(data.session.access_token);
    };
    fetchToken();
  }, []);

  // Reset hydration whenever the session id changes so we re-seed deck frames
  // from cache for the new session.
  React.useEffect(() => {
    hydratedSessionRef.current = null;
  }, [sessionId]);

  // Hydrate canvas + deck frames from the cached history. The setStates are
  // queued in a microtask so they land *after* the effect commits — this
  // matches the original `getCanvasHistory().then(...)` shape and avoids the
  // "setState synchronously in effect" lint.
  React.useEffect(() => {
    if (!historyQuery.data) return;
    if (hydratedSessionRef.current === sessionId) return;
    const data = historyQuery.data;
    queueMicrotask(() => {
      const turns = data.turns;
      if (!turns.length) {
        hydratedSessionRef.current = sessionId;
        return;
      }
      const latest = turns[turns.length - 1];
      const frames = framesFromHistory(turns);
      setNodes(latest.payload.nodes);
      setEdges(latest.payload.edges);
      setDeckFrames(frames);
      setActiveFrameIndex(Math.max(0, frames.length - 1));
      hydratedSessionRef.current = sessionId;
    });
  }, [historyQuery.data, sessionId, setNodes, setEdges]);

  React.useEffect(() => {
    if (activeTab === "chat" && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [deckFrames, trace, activeTab]);

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
      let nextLength = 0;
      setDeckFrames((currentFrames) => {
        nextLength = currentFrames.length + 1;
        const updated: DeckFrame[] = [
          ...currentFrames,
          { ...frame, index: currentFrames.length },
        ];
        // Mirror into the cache so re-opening the canvas re-hydrates.
        setCached<CanvasHistory>(sessionHistoryKey(sessionId), {
          turns: updated.map((f) => ({
            prompt: f.prompt,
            payload: { ...f.payload, ai_response: f.summary },
            turn_index: f.index,
            created_at: new Date().toISOString(),
          })),
        });
        return updated;
      });
      setActiveFrameIndex(nextLength - 1);
    },
    [sessionId],
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

  const handleRevert = async (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure? This will permanently delete all turns after this point."))
      return;

    try {
      await revertSessionToTurn(sessionId, index);
      setDeckFrames((frames) => frames.slice(0, index + 1));
      goToFrame(index);
      toast.success("Timeline reverted successfully.");
    } catch {
      toast.error("Failed to revert timeline.");
    }
  };

  // Branch Logic (Non-destructive)
  const handleBranch = async (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setBranchingIndex(index);
    try {
      const newSession = await branchSessionFromTurn(sessionId, index);
      // Warm the new session's cache before navigating so it lands instantly.
      void prefetchSessionHistory(newSession.id);
      toast.success("Branch created successfully!");
      // Redirect to the new session
      router.push(`/dashboard/canvas/${newSession.id}`);
    } catch {
      toast.error("Failed to branch timeline.");
      setBranchingIndex(null);
    }
  };

  const runTurn = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;
    if (!token) return toast.error("Authentication missing.");

    setRunning(true);
    setTrace([
      {
        agent: "frontend",
        label: "System",
        message: "Connecting to Canvas Engine...",
        status: "running",
      },
    ]);

    try {
      await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(backendWebSocketUrl(sessionId, token));
        const timeout = window.setTimeout(() => {
          socket.close();
          reject(new Error("Backend timed out."));
        }, 800000);

        socket.addEventListener("open", () => {
          socket.send(JSON.stringify({ prompt: trimmedPrompt, profile, nodes, edges }));
          setPrompt("");
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
              summary: frame.ai_response || "Canvas updated.",
              nodes: frame.nodes.length,
              edges: frame.edges.length,
              payload: { 
                nodes: frame.nodes, 
                edges: frame.edges, 
                step_title: frame.step_title,
                ai_response: frame.ai_response || "Canvas updated." // <--- ADD THIS
              },
            });
            toast.success("Canvas updated");
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
    } catch {
      toast.error("Failed to run turn.");
    } finally {
      setRunning(false);
    }
  };

  const addVisualizationTool = (kind: "invariant" | "probe") => {
    const nextIndex = nodes.length + 1;
    const toolCopy = {
      invariant: {
        label: "Invariant lens",
        detail: "State the rule that must remain true after every mutation.",
      },
      probe: {
        label: "Misconception probe",
        detail: "Ask what a learner might incorrectly infer from this diagram.",
      }
    }[kind];
    const source = nodes[0]?.id;
    const newNode: CanvasNode = {
      id: `tool-${kind}-${nextIndex}`,
      type: "default",
      position: { x: kind === "probe" ? 360 : -360, y: 120 + nextIndex * 35 },
      data: toolCopy,
    };
    setNodes((currentNodes) => [...currentNodes, newNode]);
    if (source)
      setEdges((currentEdges) => [
        ...currentEdges,
        {
          id: `${source}-${newNode.id}`,
          source,
          target: newNode.id,
          type: "smoothstep",
          label: kind,
        },
      ]);
    toast.success(`${toolCopy.label} added`);
  };

  const addToRecall = async () => {
    setRecalling(true);
    try {
      const result = await buildRecallFromSession({
        sessionId,
        title: topic,
        prompt: deckFrames[activeFrameIndex]?.prompt || "Canvas State",
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
        prompt: deckFrames[activeFrameIndex]?.prompt || "Canvas State",
        nodes,
        edges,
      });

      toast.info("Knowledge graph update queued in background...");

      // Give the ID to the hook, which will spin up the listener
      if (result.build_id) {
        setPendingBuildId(result.build_id);
      } else {
        setExportingGraph(false); // Fallback if no ID returned
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
      setExportingGraph(false);
    }
  };

  // Canvas (React Flow) goes in the left panel, the chat/workbench column
  // goes in the right. Both keep their existing internals — the resizable
  // wrapper only swaps the outer grid for a draggable split on xl screens
  // (below xl we fall back to the original stacked layout so mobile stays
  // untouched).
  {/* Canvas Area */}
  const canvasArea = (
    <section className="bg-card border-border relative h-full min-h-[28rem] overflow-hidden rounded-lg border flex flex-col">
      
      {/* 1. NEW INTERACTIVE DOT GRID BACKGROUND */}
      <div className="absolute inset-0 z-0">
        <DotGrid
          dotSize={0.5}
          gap={24}
          baseColor="#27272a" // Subtle zinc-800 to match dark mode
          activeColor="#c084fc" // Purple interactive glow
          proximity={120}
          shockRadius={250}
          shockStrength={5}
          resistance={700}
          returnDuration={1.7}
        />
      </div>

      {/* 2. MAIN CONTENT LAYER (Z-10 sits on top of the dots) */}
      <div className="relative z-10 w-full h-full flex-1">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            defaultEdgeOptions={{ type: "smoothstep" }}
            proOptions={{ hideAttribution: true }}
          >
            {/* Removed the old <Background /> component from here */}
            <Controls position="bottom-left" />
            <MiniMap pannable zoomable position="bottom-right" className="opacity-80" />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </section>
  );

  {/* Right Sidebar Area */}
  const sidebarArea = (
    <aside className="flex h-full min-h-0 flex-col gap-4">
      {/* Conditionally hide Cognitive Profile when Timeline is active to give it full height */}
      {activeTab !== "timeline" && (
        <div className="bg-card border-border shrink-0 rounded-lg border p-4">
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">Cognitive Profile</p>
          <div className="bg-muted/50 flex rounded-lg p-1">
            {PROFILES.map((p) => (
              <button
                key={p}
                onClick={() => handleProfileChange(p)}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-xs font-medium transition-all",
                  profile === p
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        <p className="text-muted-foreground mt-2 text-center text-[10px]">
          {profile === "Spatial" && "Maximized visual structure and data flow."}
          {profile === "Micro-step" && "Hyper-focused, linear step-by-step execution."}
          {profile === "Low-stim" && "Minimalist layout with reduced visual noise."}
        </p>
        </div>
      )}

      {/* 3-Button Tab Toggle */}
      <div className="bg-muted/50 flex shrink-0 rounded-lg p-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setActiveTab("chat")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-sm font-medium transition-colors",
                activeTab === "chat" ? "bg-background shadow-sm" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <MessageSquare className="size-4" /> Chat
            </button>
          </TooltipTrigger>
          <TooltipContent>Conversation with the canvas tutor</TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setActiveTab("tools")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-sm font-medium transition-colors",
                activeTab === "tools" ? "bg-background shadow-sm" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Wrench className="size-4" /> Tools
            </button>
          </TooltipTrigger>
          <TooltipContent>Exports, agent trace, and visualizations</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setActiveTab("timeline")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-sm font-medium transition-colors",
                activeTab === "timeline" ? "bg-background shadow-sm" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <GitCommitHorizontal className="size-4" /> Timeline
            </button>
          </TooltipTrigger>
          <TooltipContent>Interactive Learning Journey</TooltipContent>
        </Tooltip>
      </div>

      {/* TAB 1: CHAT INTERFACE */}
      {activeTab === "chat" && (
        <div className="bg-card border-border flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
          <div className="flex-1 space-y-4 overflow-y-auto p-4" ref={chatScrollRef}>
            {deckFrames.length === 0 ? (
              <div className="text-muted-foreground py-12 text-center text-sm">
                {historyQuery.isLoading
                  ? "Loading canvas history…"
                  : "No turns yet — ask a question below to start."}
              </div>
            ) : null}
            {deckFrames.map((frame, idx) => (
              <div key={idx} className="space-y-4">
                <div className="flex flex-col items-end">
                  <div className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-tr-none px-4 py-2 text-sm">
                    {frame.prompt}
                  </div>
                </div>
                <div className="flex max-w-[85%] items-start gap-2">
                  <div className="bg-secondary flex size-8 shrink-0 items-center justify-center rounded-full">
                    <Bot className="size-4" />
                  </div>
                  <div className="bg-muted text-foreground border-border rounded-2xl rounded-tl-none border px-4 py-2 text-sm">
                    <p className="text-muted-foreground mb-1 text-xs font-medium">Canvas Updated</p>
                    <div className="prose prose-invert prose-sm prose-p:leading-snug prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{frame.summary}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {running && trace.length > 0 && (
              <div className="flex max-w-[85%] animate-pulse items-start gap-2">
                <div className="bg-secondary flex size-8 shrink-0 items-center justify-center rounded-full">
                  <Loader2 className="size-4 animate-spin" />
                </div>
                <div className="bg-muted text-foreground border-border rounded-2xl rounded-tl-none border px-4 py-2 text-sm">
                  <p className="text-muted-foreground mb-1 text-xs font-medium">Thinking...</p>
                  <p className="text-xs">{trace[trace.length - 1].message}</p>
                </div>
              </div>
            )}
          </div>
          <div className="border-border bg-background shrink-0 border-t p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!running && prompt.trim()) runTurn();
                  }
                }}
                placeholder="Ask a question..."
                title="Ask the tutor a question — Enter sends, Shift+Enter inserts a newline"
                className="border-input bg-background focus-visible:ring-ring flex-1 rounded-full border px-4 py-2 text-sm outline-none focus-visible:ring-2"
                disabled={running}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    className="shrink-0 rounded-full"
                    onClick={runTurn}
                    disabled={running || !prompt.trim()}
                  >
                    {running ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
              </Button>
                </TooltipTrigger>
                <TooltipContent>Send prompt to the canvas engine</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WORKBENCH TOOLS */}
      {activeTab === "tools" && (
        <ScrollArea className="min-h-0 flex-1 rounded-lg">
          <div className="space-y-4 pr-3">
            
            {/* YOUR CHANGE: The Consolidated Session Actions Panel */}
            <PanelBlock title="Session Actions" icon={Sparkles}>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => goToFrame(deckFrames.length - 1)}
                        disabled={!deckFrames.length}
                      >
                    <RotateCcw className="mr-1.5 size-4" /> Latest
                  </Button>
                    </TooltipTrigger>
                    <TooltipContent>Jump to the most recent canvas turn</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                  <ResourceModal sessionId={sessionId} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Add a PDF, link, or note as grounding</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addToRecall}
                        disabled={recalling}
                      >
                        {recalling ? (
                          <Loader2 className="mr-1.5 size-4 animate-spin" />
                        ) : (
                          <BookOpenCheck className="mr-1.5 size-4" />
                        )}{" "}
                        Recall
                  </Button>
                    </TooltipTrigger>
                    <TooltipContent>Generate spaced-repetition cards from this canvas</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={exportToKnowledgeGraph}
                        disabled={exportingGraph}
                      >
                        {exportingGraph ? (
                          <Loader2 className="mr-1.5 size-4 animate-spin" />
                        ) : (
                          <Network className="mr-1.5 size-4" />
                        )}{" "}
                        Graph
                  </Button>
                    </TooltipTrigger>
                    <TooltipContent>Merge this canvas into your knowledge graph</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </PanelBlock>

            <PanelBlock title="Visualization Tools" icon={Layers3}>
              <div className="grid gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addVisualizationTool("invariant")}
                    >
                      Invariant lens
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add a node that names the invariant to preserve</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addVisualizationTool("probe")}
                    >
                      Misconception probe
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Surface a common misreading of the diagram</TooltipContent>
                </Tooltip>
              </div>
            </PanelBlock>

            <PanelBlock title="Agent Trace" icon={Zap}>
              <div className="space-y-3">
                {trace.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Agent activity appears here once a turn is in flight.</p>
                ) : (
                  trace.map((entry, index) => {
                    const Icon = AGENT_ICONS[index] ?? CheckCircle2;
                    return (
                      <div key={`${entry.agent}-${index}`} className="flex gap-3">
                        <div className="bg-secondary text-secondary-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md">
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{entry.label ?? agentLabel(entry.agent)}</p>
                            <Badge variant={entry.status === "complete" ? "secondary" : "outline"} className="text-[10px]">{entry.status}</Badge>
                          </div>
                          <p className="text-muted-foreground mt-1 text-xs">{entry.message}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </PanelBlock>
          </div>
        </ScrollArea>
      )}

      {/* TAB 3: VERTICAL TIMELINE */}
      {activeTab === "timeline" && (
        <VerticalTimeline 
          frames={deckFrames} 
          activeIndex={activeFrameIndex} 
          onGoToFrame={goToFrame} 
          onRevert={handleRevert} 
          onBranch={handleBranch} 
        />
      )}
    </aside>
  );

  return (
    <TooltipProvider delayDuration={150}>
      {/* xl+ : draggable horizontal split. Saves the user's preferred ratio
          in localStorage via the autoSaveId. */}
      <div className="hidden h-full min-h-0 xl:block">
        <ResizablePanelGroup direction="horizontal" autoSaveId="canvas-workbench-split" className="gap-2">
          <ResizablePanel defaultSize={62} minSize={35}>
            {canvasArea}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={38} minSize={24} maxSize={60}>
            {sidebarArea}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      {/* < xl : keep the original stacked layout, no resizing needed. */}
      <div className="grid h-full min-h-0 gap-4 xl:hidden">
        {canvasArea}
        {sidebarArea}
      </div>
    </TooltipProvider>
  );
}

function PanelBlock({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; }) {
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