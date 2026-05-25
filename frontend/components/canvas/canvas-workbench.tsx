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
  Bot,
  MessageSquare,
  Wrench,
  Bookmark,
  GitBranch,
  Undo2
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
  toggleSessionCheckpoint,
  revertSessionToTurn,
  branchSessionFromTurn,
} from "@/lib/canvasai-api";
import { createClient } from "@/lib/supabase/client";
import { useKnowledgeGraphJob } from "@/hooks/useKnowledgeGraphJob";
import { ResourceModal } from "./ResourceModal";
import type {
  AgentTrace,
  CanvasEdge,
  CanvasNode,
  DemoDocument,
  DemoTurn,
  SessionTurn,
} from "@/lib/canvasai-types";
import { cn } from "@/lib/utils";
import { MemoryBlock } from "./nodes/MemoryBlock";
import { LogicGateNode } from "./nodes/LogicGateNode";
import LessonPlanNode from './nodes/LessonPlanNode';
import CodeStepperNode from './nodes/CodeStepperNode';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

type BackendStatusFrame = { type: "status"; agent: string; message: string; };
type BackendPayloadFrame = { type: "payload"; nodes: CanvasNode[]; edges: CanvasEdge[]; };
type BackendFrame = BackendStatusFrame | BackendPayloadFrame | { type: "error"; message: string };

// Added is_checkpoint flag
type DeckFrame = DemoTurn & {
  is_checkpoint: boolean;
  payload: { nodes: CanvasNode[]; edges: CanvasEdge[]; };
};

const nodeTypes = {
  memory_block: MemoryBlock,
  logic_gate: LogicGateNode,
  lesson_plan: LessonPlanNode,
  code_stepper: CodeStepperNode,
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
  const router = useRouter();
  
  const initialDeckFrames = React.useMemo<DeckFrame[]>(() => {
    const seededTurns = initialTurns.length
      ? initialTurns
      : [{ index: 0, prompt: initialPrompt, summary: "Seeded canvas state.", nodes: initialNodes.length, edges: initialEdges.length }];
    return seededTurns.map((turn, index) => ({ ...turn, index, is_checkpoint: false, payload: { nodes: initialNodes, edges: initialEdges } }));
  }, [initialEdges, initialNodes, initialPrompt, initialTurns]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [trace, setTrace] = React.useState(initialTrace);
  const [deckFrames, setDeckFrames] = React.useState(initialDeckFrames);
  const [activeFrameIndex, setActiveFrameIndex] = React.useState(Math.max(0, initialDeckFrames.length - 1));
  const [prompt, setPrompt] = React.useState("");
  const [profile, setProfile] = React.useState(PROFILES[0]);
  const [running, setRunning] = React.useState(false);
  
  // States for loaders
  const [recalling, setRecalling] = React.useState(false);
  const [exportingGraph, setExportingGraph] = React.useState(false);
  const [pendingBuildId, setPendingBuildId] = React.useState<string | null>(null);
  const [branchingIndex, setBranchingIndex] = React.useState<number | null>(null);
  
  // Auth & UI State
  const [token, setToken] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<"chat" | "tools">("chat");
  
  const activeFrame = deckFrames[activeFrameIndex];
  const chatScrollRef = React.useRef<HTMLDivElement>(null);

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
    }
  });

  React.useEffect(() => {
    const fetchToken = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (data.session) setToken(data.session.access_token);
    };
    fetchToken();
  }, []);

  // Read the is_checkpoint flag from the backend payload
  React.useEffect(() => {
    getCanvasHistory(sessionId)
      .then(({ turns: historyTurns }) => {
        if (!historyTurns.length) return;
        const latest = historyTurns[historyTurns.length - 1];
        const frames = historyTurns.map((turn: SessionTurn) => ({
          index: turn.turn_index,
          prompt: turn.prompt,
          // Extract the ai_response from the payload, fallback if missing
          summary: turn.payload?.ai_response || "Canvas updated.",
          nodes: turn.payload.nodes.length,
          edges: turn.payload.edges.length,
          is_checkpoint: turn.is_checkpoint ?? false,
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

  React.useEffect(() => {
    if (activeTab === "chat" && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [deckFrames, trace, activeTab]);

  const onConnect = React.useCallback((connection: Connection) => {
    setEdges((currentEdges) => addEdge({ ...connection, type: "smoothstep", animated: true }, currentEdges));
    toast.success("Edge added to the local canvas state");
  }, [setEdges]);

  const appendFrame = React.useCallback((frame: Omit<DeckFrame, "index" | "is_checkpoint">) => {
    const nextIndex = deckFrames.length;
    setDeckFrames((currentFrames) => [...currentFrames, { ...frame, index: currentFrames.length, is_checkpoint: false }]);
    setActiveFrameIndex(nextIndex);
  }, [deckFrames.length]);

  const goToFrame = React.useCallback((index: number) => {
    const frame = deckFrames[index];
    if (!frame) return;
    setActiveFrameIndex(index);
    setNodes(frame.payload.nodes);
    setEdges(frame.payload.edges);
  }, [deckFrames, setEdges, setNodes]);

  // Toggle Checkpoint API Logic
  const toggleCheckpoint = async (index: number) => {
    const frame = deckFrames[index];
    if (!frame) return;
    
    const newStatus = !frame.is_checkpoint;
    
    // Optimistic UI update
    setDeckFrames(frames => frames.map(f => f.index === index ? { ...f, is_checkpoint: newStatus } : f));
    toast.success(newStatus ? "Checkpoint saved" : "Checkpoint removed");
    
    try {
      await toggleSessionCheckpoint(sessionId, index, newStatus);
    } catch (err) {
      toast.error("Failed to save checkpoint to database.");
      // Revert optimistic update
      setDeckFrames(frames => frames.map(f => f.index === index ? { ...f, is_checkpoint: !newStatus } : f));
    }
  };

  // Revert Logic (Destructive)
  const handleRevert = async (index: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger the "Peek" click
    if (!confirm("Are you sure? This will permanently delete all turns after this checkpoint.")) return;
    
    try {
      await revertSessionToTurn(sessionId, index);
      // Remove frames > index from local state
      setDeckFrames(frames => frames.slice(0, index + 1));
      goToFrame(index);
      toast.success("Timeline reverted successfully.");
    } catch (err) {
      toast.error("Failed to revert timeline.");
    }
  };

  // NEW: Branch Logic (Non-destructive)
  const handleBranch = async (index: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger the "Peek" click
    setBranchingIndex(index);
    try {
      const newSession = await branchSessionFromTurn(sessionId, index);
      toast.success("Branch created successfully!");
      // Redirect to the new session
      router.push(`/dashboard/canvas/${newSession.id}`);
    } catch (err) {
      toast.error("Failed to branch timeline.");
      setBranchingIndex(null);
    }
  };

  const runTurn = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;
    if (!token) return toast.error("Authentication missing.");

    setRunning(true);
    setTrace([{ agent: "frontend", label: "System", message: "Connecting to Canvas Engine...", status: "running" }]);

    try {
      await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(backendWebSocketUrl(sessionId, token));
        const timeout = window.setTimeout(() => { socket.close(); reject(new Error("Backend timed out.")); }, 800000);

        socket.addEventListener("open", () => {
          socket.send(JSON.stringify({ prompt: trimmedPrompt, nodes, edges }));
          setPrompt("");
        });

        socket.addEventListener("message", (event) => {
          const frame = JSON.parse(event.data) as BackendFrame;
          if (frame.type === "status") {
            setTrace((currentTrace) => [...currentTrace.filter((entry) => entry.agent !== "frontend"), { agent: frame.agent, label: agentLabel(frame.agent), message: frame.message, status: "complete" }]);
            return;
          }
          if (frame.type === "payload") {
            window.clearTimeout(timeout);
            setNodes(frame.nodes);
            setEdges(frame.edges);
            appendFrame({ 
              prompt: trimmedPrompt, 
              // Use the AI's conversational response!
              summary: (frame as any).ai_response || "Canvas updated.", 
              nodes: frame.nodes.length, 
              edges: frame.edges.length, 
              payload: { nodes: frame.nodes, edges: frame.edges } 
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
        socket.addEventListener("error", () => { window.clearTimeout(timeout); reject(new Error("Backend WebSocket unavailable.")); });
      });
    } catch (error) {
      toast.error("Failed to run turn.");
    } finally {
      setRunning(false);
    }
  };

  // Extract only checkpoints and reverse them (Newest at Top)
  const checkpointFrames = deckFrames.filter(f => f.is_checkpoint).reverse();

  const restoreInitial = () => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setTrace(initialTrace);
    setDeckFrames(initialDeckFrames);
    setActiveFrameIndex(Math.max(0, initialDeckFrames.length - 1));
    toast.success("Timeline restored");
  };

  const addVisualizationTool = (kind: "invariant" | "probe" | "checkpoint") => {
    const nextIndex = nodes.length + 1;
    const toolCopy = {
      invariant: { label: "Invariant lens", detail: "State the rule that must remain true after every mutation." },
      probe: { label: "Misconception probe", detail: "Ask what a learner might incorrectly infer from this diagram." },
      checkpoint: { label: "Step checkpoint", detail: "Pause here and predict the next canvas mutation before revealing it." },
    }[kind];
    const source = nodes[0]?.id;
    const newNode: CanvasNode = {
      id: `tool-${kind}-${nextIndex}`, type: "default", position: { x: kind === "probe" ? 360 : -360, y: 120 + nextIndex * 35 }, data: toolCopy,
    };
    setNodes((currentNodes) => [...currentNodes, newNode]);
    if (source) setEdges((currentEdges) => [...currentEdges, { id: `${source}-${newNode.id}`, source, target: newNode.id, type: "smoothstep", animated: kind === "checkpoint", label: kind }]);
    toast.success(`${toolCopy.label} added`);
  };

  const addToRecall = async () => {
    setRecalling(true);
    try {
      const result = await buildRecallFromSession({ sessionId, title: topic, prompt: deckFrames[activeFrameIndex]?.prompt || "Canvas State", nodes, edges });
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
        edges 
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

  return (
    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      {/* Canvas Area */}
      <section className="bg-card border-border min-h-[28rem] overflow-hidden rounded-lg border">
        <ReactFlowProvider>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView fitViewOptions={{ padding: 0.25 }} defaultEdgeOptions={{ type: "smoothstep" }} proOptions={{ hideAttribution: true }}>
            <Background gap={24} />
            <Controls position="bottom-left" />
            <MiniMap pannable zoomable position="bottom-right" />
          </ReactFlow>
        </ReactFlowProvider>
      </section>

      {/* Right Sidebar Area */}
      <aside className="flex min-h-0 flex-col gap-4">
        
        {/* Session Header */}
        <div className="bg-card border-border rounded-lg border p-4 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Session</p>
              <h2 className="mt-1 text-base font-semibold">{topic}</h2>
            </div>
            {/* Bookmark Button for the Current View */}
            <Button 
              size="sm" 
              variant={activeFrame?.is_checkpoint ? "default" : "outline"}
              onClick={() => toggleCheckpoint(activeFrameIndex)}
              className="shrink-0"
              title={activeFrame?.is_checkpoint ? "Remove Checkpoint" : "Mark as Checkpoint"}
            >
              <Bookmark className={cn("size-4 mr-1.5", activeFrame?.is_checkpoint ? "fill-current" : "")} /> 
              Step {activeFrameIndex + 1}
            </Button>
          </div>
          
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => goToFrame(deckFrames.length - 1)}><RotateCcw className="size-4 mr-1.5" /> Latest</Button>
            <Button type="button" size="sm" variant="outline" onClick={restoreInitial}><RotateCcw className="size-4 mr-1.5" /> Restore</Button>
            <ResourceModal sessionId={sessionId} />
            <Button type="button" size="sm" variant="outline" onClick={addToRecall} disabled={recalling}>
              {recalling ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <BookOpenCheck className="size-4 mr-1.5" />} Recall
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={exportToKnowledgeGraph} disabled={exportingGraph}>
              {exportingGraph ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Network className="size-4 mr-1.5" />} Graph
            </Button>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-muted/50 p-1 rounded-lg shrink-0">
          <button onClick={() => setActiveTab("chat")} className={cn("flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-colors", activeTab === "chat" ? "bg-background shadow-sm" : "text-muted-foreground hover:bg-muted")}><MessageSquare className="size-4" /> Chat</button>
          <button onClick={() => setActiveTab("tools")} className={cn("flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-colors", activeTab === "tools" ? "bg-background shadow-sm" : "text-muted-foreground hover:bg-muted")}><Wrench className="size-4" /> Workbench</button>
        </div>

        {/* TAB 1: CHAT INTERFACE (Remains the same) */}
        {activeTab === "chat" && (
           <div className="bg-card border-border rounded-lg border flex flex-col min-h-0 flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={chatScrollRef}>
              {deckFrames.map((frame, idx) => (
                <div key={idx} className="space-y-4">
                  <div className="flex flex-col items-end">
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-none px-4 py-2 max-w-[85%] text-sm">{frame.prompt}</div>
                  </div>
                  <div className="flex items-start gap-2 max-w-[85%]">
                    <div className="bg-secondary flex size-8 shrink-0 items-center justify-center rounded-full"><Bot className="size-4" /></div>
                    <div className="bg-muted text-foreground rounded-2xl rounded-tl-none px-4 py-2 text-sm border border-border">
                      <p className="font-medium text-xs text-muted-foreground mb-1">Canvas Updated</p>
                      <div className="prose prose-invert prose-sm max-w-none prose-p:leading-snug prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {frame.summary}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {running && trace.length > 0 && (
                <div className="flex items-start gap-2 max-w-[85%] animate-pulse">
                  <div className="bg-secondary flex size-8 shrink-0 items-center justify-center rounded-full"><Loader2 className="size-4 animate-spin" /></div>
                  <div className="bg-muted text-foreground rounded-2xl rounded-tl-none px-4 py-2 text-sm border border-border">
                    <p className="font-medium text-xs text-muted-foreground mb-1">Thinking...</p>
                    <p className="text-xs">{trace[trace.length - 1].message}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-border bg-background shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!running && prompt.trim()) runTurn(); } }}
                  placeholder="Ask a question..."
                  className="flex-1 border-input bg-background rounded-full border px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={running}
                />
                <Button type="button" size="icon" className="rounded-full shrink-0" onClick={runTurn} disabled={running || !prompt.trim()}>
                  {running ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </div>
            </div>
            <div className="p-3">Chat Interface Active</div>
          </div>
        )}

        {/* TAB 2: WORKBENCH TOOLS */}
        {activeTab === "tools" && (
          <ScrollArea className="min-h-0 flex-1 rounded-lg">
            <div className="space-y-4 pr-3">

              <PanelBlock title="Visualization Tools" icon={Layers3}>
                <div className="grid gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => addVisualizationTool("invariant")}>Invariant lens</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addVisualizationTool("probe")}>Misconception probe</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addVisualizationTool("checkpoint")}>Step checkpoint</Button>
                </div>
              </PanelBlock>

              <PanelBlock title="Checkpoints (Deck Replay)" icon={History}>
                <div className="space-y-2">
                  {checkpointFrames.length === 0 ? (
                    <p className="text-muted-foreground text-xs text-center py-4">No checkpoints saved. Bookmark a step above.</p>
                  ) : (
                    checkpointFrames.map((frame) => (
                      <div 
                        key={`${frame.index}-${frame.prompt}`}
                        onClick={() => goToFrame(frame.index)}
                        className={cn(
                          "group relative hover:bg-accent w-full rounded-md border p-3 text-left transition-colors cursor-pointer", 
                          frame.index === activeFrameIndex && "bg-accent text-accent-foreground border-primary"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium flex items-center gap-1.5">
                            <Bookmark className="size-3 fill-current text-primary" />
                            Step {frame.index + 1}
                          </span>
                          
                          {/* The 3-Dot Action Row (Reveals on Hover) */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon-sm" variant="ghost" onClick={(e) => handleRevert(frame.index, e)} title="Revert to here (Destructive)" className="h-6 w-6 text-destructive hover:bg-destructive/10">
                              <Undo2 className="size-3" />
                            </Button>
                            <Button size="icon-sm" variant="ghost" onClick={(e) => handleBranch(frame.index, e)} title="Branch from here" disabled={branchingIndex === frame.index} className="h-6 w-6 text-primary hover:bg-primary/10">
                              {branchingIndex === frame.index ? <Loader2 className="size-3 animate-spin" /> : <GitBranch className="size-3" />}
                            </Button>
                          </div>
                        </div>
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{frame.prompt}</p>
                      </div>
                    ))
                  )}
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
                            <Badge variant={entry.status === "complete" ? "secondary" : "outline"} className="text-[10px]">{entry.status}</Badge>
                          </div>
                          <p className="text-muted-foreground mt-1 text-xs">{entry.message}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </PanelBlock>

              <PanelBlock title="Grounding Sources" icon={FileSearch}>
                <div className="space-y-2">
                  {documents.slice(0, 3).map((doc) => (
                    <div key={doc.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium">{doc.title}</p>
                        <Badge variant={doc.status === "Indexed" ? "secondary" : "outline"}>{doc.status}</Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">{doc.chunks} chunks · {doc.type}</p>
                    </div>
                  ))}
                </div>
              </PanelBlock>
            </div>
          </ScrollArea>
        )}
      </aside>
    </div>
  );
}

function PanelBlock({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; }) {
  return (
    <section className="bg-card border-border rounded-lg border p-4">
      <div className="flex items-center gap-2"><Icon className="size-4" /><h3 className="text-sm font-semibold">{title}</h3></div>
      <Separator className="my-3" />
      <div className={cn("text-sm")}>{children}</div>
    </section>
  );
}

function agentLabel(agent: string) {
  const labels: Record<string, string> = { agent_0_retrieval: "Retrieval", agent_1_synthesizer: "Synthesizer", agent_2_architect: "Architect", agent_3_schema: "Schema Enforcer" };
  return labels[agent] ?? agent;
}
