"use client";

import * as React from "react";
import Link from "next/link";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
} from "@xyflow/react";
import {
  Brain,
  BookOpenCheck,
  FilePlus2,
  Loader2,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  Route,
  Shuffle,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import "@xyflow/react/dist/style.css";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  addTextToKnowledgeGraph,
  getKnowledgeGraph,
  KNOWLEDGE_GRAPH_ENDPOINT,
} from "@/lib/canvasai-api";
import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphPayload,
} from "@/lib/canvasai-types";
import { MOCK_KNOWLEDGE_GRAPH } from "@/lib/mock-knowledge-graph";
import { cn } from "@/lib/utils";

type GraphSource = "backend" | "mock";
type SprintPrinciple = "retrieval" | "prerequisite" | "interleaving";

type SprintItem = {
  id: string;
  principle: SprintPrinciple;
  title: string;
  topicId: string;
  prompt: string;
  why: string;
};

const CLUSTER_STYLES: Record<string, string> = {
  "data-structures": "border-emerald-400 bg-emerald-50 text-emerald-950",
  "memory-model": "border-sky-400 bg-sky-50 text-sky-950",
  algorithms: "border-amber-400 bg-amber-50 text-amber-950",
  systems: "border-rose-400 bg-rose-50 text-rose-950",
  frontend: "border-violet-400 bg-violet-50 text-violet-950",
  kafka: "border-cyan-400 bg-cyan-50 text-cyan-950",
};
const FALLBACK_CLUSTER_STYLE = "border-slate-400 bg-slate-50 text-slate-950";

const EDGE_COLORS: Record<KnowledgeGraphEdge["relation"], string> = {
  prerequisite: "#0f766e",
  extends: "#2563eb",
  analogous: "#d97706",
  contrasts: "#be123c",
  debugs: "#7c3aed",
};

const PRINCIPLE_META: Record<
  SprintPrinciple,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  retrieval: { label: "Retrieval practice", icon: Target },
  prerequisite: { label: "Prerequisite repair", icon: Route },
  interleaving: { label: "Interleaving", icon: Shuffle },
};

export function KnowledgeGraphBoard() {
  const [graph, setGraph] = React.useState<KnowledgeGraphPayload>(MOCK_KNOWLEDGE_GRAPH);
  const [source, setSource] = React.useState<GraphSource>("mock");
  const [loading, setLoading] = React.useState(false);
  const [panelOpen, setPanelOpen] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState(graph.nodes[0]?.id);
  const [sprintOpen, setSprintOpen] = React.useState(false);
  const [factsOpen, setFactsOpen] = React.useState(false);
  const [factsTitle, setFactsTitle] = React.useState("");
  const [factsText, setFactsText] = React.useState("");
  const [submittingFacts, setSubmittingFacts] = React.useState(false);

  const selected = graph.nodes.find((node) => node.id === selectedId) ?? graph.nodes[0];
  const relatedEdges = graph.edges.filter(
    (edge) => edge.source === selected?.id || edge.target === selected?.id,
  );
  const sprintItems = React.useMemo(() => buildStudySprint(graph), [graph]);

  const loadGraph = React.useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setLoading(true);
    try {
      const nextGraph = await getKnowledgeGraph();
      setGraph(nextGraph);
      setSource("backend");
      setSelectedId((current) => {
        if (nextGraph.nodes.some((node) => node.id === current)) return current;
        return nextGraph.nodes[0]?.id;
      });
    } catch {
      setGraph(MOCK_KNOWLEDGE_GRAPH);
      setSource("mock");
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    queueMicrotask(() => {
      void loadGraph();
    });
  }, [loadGraph]);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      void loadGraph({ silent: true });
    }, 15000);
    return () => window.clearInterval(id);
  }, [loadGraph]);

  const submitFacts = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = factsText.trim();
    if (!text) return;

    setSubmittingFacts(true);
    try {
      const result = await addTextToKnowledgeGraph({
        title: factsTitle.trim() || undefined,
        text,
      });
      toast.success(result.message || "Knowledge graph facts queued");
      setFactsOpen(false);
      setFactsTitle("");
      setFactsText("");
      window.setTimeout(() => void loadGraph({ silent: true }), 3000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not queue knowledge graph facts.");
    } finally {
      setSubmittingFacts(false);
    }
  };

  const flowNodes = React.useMemo<Node[]>(
    () =>
      graph.nodes.map((topic) => ({
        id: topic.id,
        type: "default",
        position: topic.position,
        data: {
          label: <TopicNode topic={topic} selected={topic.id === selected?.id} />,
        },
        style: {
          width: 220,
          padding: 0,
          border: 0,
          borderRadius: 8,
          background: "transparent",
          boxShadow: "none",
        },
      })),
    [graph.nodes, selected?.id],
  );

  const flowEdges = React.useMemo<Edge[]>(
    () =>
      graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        animated: edge.strength >= 0.8,
        label: edge.relation,
        style: {
          stroke: EDGE_COLORS[edge.relation],
          strokeWidth: 1.5 + edge.strength * 2,
        },
        labelStyle: {
          fill: EDGE_COLORS[edge.relation],
          fontSize: 11,
          fontWeight: 600,
        },
      })),
    [graph.edges],
  );

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <Badge variant={source === "backend" ? "default" : "secondary"}>
            {source === "backend" ? "Backend graph" : "Mock graph"}
          </Badge>
          <Badge variant="outline">
            {graph.nodes.length} nodes / {graph.edges.length} edges
          </Badge>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            Knowledge Graph
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            Topic nodes, relationship edges, and revision prompts from the user learning graph.
            The frontend targets <code>{KNOWLEDGE_GRAPH_ENDPOINT}</code>, polls lightly for
            completed async exports, and falls back to mock data only when the backend request fails.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setFactsOpen(true)}>
            <FilePlus2 className="size-4" />
            Add facts
          </Button>
          <Button variant="default" onClick={() => setSprintOpen(true)}>
            <Brain className="size-4" />
            Study sprint
          </Button>
          <Button variant="outline" onClick={() => void loadGraph()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
            Refresh
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
        <aside
          className={cn(
            "bg-card border-border min-h-0 rounded-lg border transition-[width] duration-200",
            panelOpen ? "w-full lg:w-80" : "w-full lg:w-12",
          )}
        >
          {panelOpen ? (
            <RevisionPanel
              graph={graph}
              selected={selected}
              relatedEdges={relatedEdges}
              onClose={() => setPanelOpen(false)}
            />
          ) : (
            <div className="flex h-full items-start justify-center p-2">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Open revision panel"
                onClick={() => setPanelOpen(true)}
              >
                <PanelLeftOpen className="size-4" />
              </Button>
            </div>
          )}
        </aside>

        <section className="bg-card border-border min-h-[32rem] overflow-hidden rounded-lg border">
          <ReactFlowProvider>
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              onNodeClick={(_, node) => {
                setSelectedId(node.id);
                setPanelOpen(true);
              }}
              fitView
              fitViewOptions={{ padding: 0.25 }}
              minZoom={0.35}
              maxZoom={1.6}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={28} />
              <Controls position="bottom-left" />
              <MiniMap pannable zoomable position="bottom-right" />
            </ReactFlow>
          </ReactFlowProvider>
        </section>
      </div>

      <Dialog open={sprintOpen} onOpenChange={setSprintOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adaptive Study Sprint</DialogTitle>
            <DialogDescription>
              Three graph-driven review moves: recall first, repair a prerequisite, then switch
              clusters to strengthen transfer.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            {sprintItems.map((item) => {
              const meta = PRINCIPLE_META[item.principle];
              const Icon = meta.icon;
              return (
                <article key={item.id} className="rounded-md border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <Icon className="size-4" />
                        <h3 className="text-sm font-semibold">{item.title}</h3>
                      </div>
                      <Badge variant="secondary">{meta.label}</Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedId(item.topicId);
                        setPanelOpen(true);
                        setSprintOpen(false);
                      }}
                    >
                      Open topic
                    </Button>
                  </div>
                  <p className="mt-3 text-sm">{item.prompt}</p>
                  <p className="text-muted-foreground mt-2 text-xs">{item.why}</p>
                </article>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSprintOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={factsOpen} onOpenChange={setFactsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Knowledge</DialogTitle>
            <DialogDescription>
              Paste arbitrary learning notes. The backend queues an Inngest job, asks the LLM
              to extract graph facts, then merges them into the persisted graph.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-3" onSubmit={submitFacts}>
            <Input
              value={factsTitle}
              onChange={(event) => setFactsTitle(event.target.value)}
              placeholder="Optional title, e.g. Kafka broker basics"
            />
            <textarea
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-44 rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              value={factsText}
              onChange={(event) => setFactsText(event.target.value)}
              placeholder="Kafka brokers store topic partitions. Producers write records to topics. Consumers read records by subscribing to topics..."
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFactsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!factsText.trim() || submittingFacts}>
                {submittingFacts ? <Loader2 className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />}
                Queue graph update
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function buildStudySprint(graph: KnowledgeGraphPayload): SprintItem[] {
  const byMastery = [...graph.nodes].sort((a, b) => a.mastery - b.mastery);
  const weakest = byMastery[0] ?? graph.nodes[0];
  const prerequisiteEdge = graph.edges
    .filter((edge) => edge.relation === "prerequisite")
    .map((edge) => ({
      edge,
      source: graph.nodes.find((node) => node.id === edge.source),
      target: graph.nodes.find((node) => node.id === edge.target),
    }))
    .filter((item) => item.source && item.target)
    .sort((a, b) => {
      const aGap = (a.target?.mastery ?? 0) - (a.source?.mastery ?? 0);
      const bGap = (b.target?.mastery ?? 0) - (b.source?.mastery ?? 0);
      return bGap - aGap;
    })[0];
  const interleaved =
    byMastery.find((node) => node.cluster !== weakest?.cluster && node.id !== prerequisiteEdge?.source?.id) ??
    byMastery[1] ??
    weakest;

  return [
    weakest
      ? {
          id: `retrieval-${weakest.id}`,
          principle: "retrieval",
          title: weakest.title,
          topicId: weakest.id,
          prompt: weakest.revision_prompt,
          why: "Lowest mastery topic. Ask before showing notes to force recall.",
        }
      : null,
    prerequisiteEdge?.source && prerequisiteEdge.target
      ? {
          id: `prerequisite-${prerequisiteEdge.edge.id}`,
          principle: "prerequisite",
          title: `${prerequisiteEdge.source.title} -> ${prerequisiteEdge.target.title}`,
          topicId: prerequisiteEdge.source.id,
          prompt: `Explain why ${prerequisiteEdge.source.title} has to be stable before ${prerequisiteEdge.target.title}.`,
          why: prerequisiteEdge.edge.evidence,
        }
      : null,
    interleaved
      ? {
          id: `interleave-${interleaved.id}`,
          principle: "interleaving",
          title: interleaved.title,
          topicId: interleaved.id,
          prompt: `Switch topics: answer this without rereading first. ${interleaved.revision_prompt}`,
          why: "Changing clusters prevents the session from becoming one-topic blocked practice.",
        }
      : null,
  ].filter((item): item is SprintItem => item !== null);
}

function reviewHref(topic: KnowledgeGraphNode) {
  const prompt = [
    `Review ${topic.title}.`,
    `Start with active recall: ask me to answer before explaining.`,
    `Use this revision target: ${topic.revision_prompt}`,
    `Then correct misconceptions and give one quick check question.`,
  ].join(" ");
  const params = new URLSearchParams({
    prompt,
    tool: "socratic",
  });
  return `/dashboard/chat?${params.toString()}`;
}

function TopicNode({ topic, selected }: { topic: KnowledgeGraphNode; selected: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border-2 p-3 shadow-sm",
        CLUSTER_STYLES[topic.cluster] ?? FALLBACK_CLUSTER_STYLE,
        selected && "ring-ring ring-2 ring-offset-2",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-semibold">{topic.title}</p>
        <span className="shrink-0 rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-medium">
          {Math.round(topic.mastery * 100)}%
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs opacity-80">{topic.summary}</p>
      <div className="mt-3 h-1.5 rounded-full bg-white/60">
        <div
          className="h-full rounded-full bg-current"
          style={{ width: `${Math.max(8, Math.round(topic.mastery * 100))}%` }}
        />
      </div>
    </div>
  );
}

function RevisionPanel({
  graph,
  selected,
  relatedEdges,
  onClose,
}: {
  graph: KnowledgeGraphPayload;
  selected?: KnowledgeGraphNode;
  relatedEdges: KnowledgeGraphEdge[];
  onClose: () => void;
}) {
  if (!selected) return null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Network className="size-4" />
            <h2 className="truncate text-sm font-semibold">{selected.title}</h2>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {selected.cluster.replace("-", " ")} · confidence {Math.round(selected.confidence * 100)}%
          </p>
        </div>
        <Button size="icon-sm" variant="ghost" aria-label="Close revision panel" onClick={onClose}>
          <PanelLeftClose className="size-4" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Core idea</p>
            <p className="mt-2 text-sm">{selected.summary}</p>
          </div>

          <div className="rounded-md border p-3">
            <div className="flex items-center gap-2">
              <BookOpenCheck className="size-4" />
              <p className="text-sm font-medium">Revise</p>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">{selected.revision_prompt}</p>
            <Button className="mt-3" size="sm" variant="outline" asChild>
              <Link href={reviewHref(selected)}>Start review</Link>
            </Button>
          </div>

          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Tags</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {selected.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Relationships</p>
            <div className="mt-2 space-y-2">
              {relatedEdges.map((edge) => {
                const neighborId = edge.source === selected.id ? edge.target : edge.source;
                const neighbor = graph.nodes.find((node) => node.id === neighborId);
                return (
                  <div key={edge.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{neighbor?.title ?? neighborId}</span>
                      <Badge variant="secondary">{edge.relation}</Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">{edge.evidence}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Evidence</p>
            <ul className="mt-2 space-y-1">
              {selected.evidence.map((item) => (
                <li key={item} className="text-muted-foreground text-xs">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
