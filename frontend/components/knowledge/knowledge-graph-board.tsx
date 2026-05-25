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
  ArrowLeft,
  Brain,
  BookOpenCheck,
  Check,
  FilePlus2,
  GraduationCap,
  Loader2,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCcw,
  Route,
  Shuffle,
  Sparkles,
  Target,
  Trash2,
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
  getKnowledgeGraph,
  getKnowledgeGraphTopicStats,
  KNOWLEDGE_GRAPH_ENDPOINT,
  mergeKnowledgeGraphProposal,
  proposeKnowledgeGraphFromText,
  recordKnowledgeGraphPractice,
} from "@/lib/canvasai-api";
import { createClient } from "@/lib/supabase/client";
import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphPayload,
  KnowledgeGraphPracticePrinciple,
  KnowledgeGraphProposal,
  KnowledgeGraphProposalEdge,
  KnowledgeGraphProposalNode,
  KnowledgeGraphTopicStats,
} from "@/lib/canvasai-types";
import { MOCK_KNOWLEDGE_GRAPH } from "@/lib/mock-knowledge-graph";
import { cn } from "@/lib/utils";

type GraphSource = "backend" | "mock";
type SprintPrinciple = KnowledgeGraphPracticePrinciple;

type SprintItem = {
  id: string;
  principle: SprintPrinciple;
  title: string;
  topicId: string;
  prompt: string;
  why: string;
};

// Pulse animation for newly-arrived (Realtime) and just-practiced nodes.
// Kept inline so this stays in pure-KG territory and doesn't touch shared CSS.
const PULSE_KEYFRAMES = `
@keyframes kgNodeArrive {
  0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); transform: scale(0.92); }
  40%  { box-shadow: 0 0 0 14px rgba(34,197,94,0.25); transform: scale(1.04); }
  100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); transform: scale(1); }
}
.kg-pulse {
  animation: kgNodeArrive 1.6s ease-out;
  border-radius: 12px;
}
`;

// Tunables for sprint selection. Pulled out so the heuristic is easy to scan.
const SPRINT_RECENCY_PENALTY_DAYS = 1; // anything practiced within this window is deprioritized
const SPRINT_TEACHBACK_THRESHOLD = 0.7; // min mastery to be eligible for teach-back
const SPRINT_TEACH_COOLDOWN_DAYS = 7; // skip recent teach-backs unless this many days have passed

type ClusterPalette = {
  border: string;
  background: string;
  text: string;
  accent: string;
};

// Hash any cluster name to a stable HSL palette so unfamiliar clusters
// (anything coming from the LLM extraction) still get a distinct color.
// Group nodes by cluster and lay each cluster out on its own ring around a
// shared origin. Backend positions still arrive (Vogel spiral around 0,0) but
// they all collide visually; this gives clusters separation and makes edges
// readable even with 30+ nodes.
function layoutNodes(
  nodes: KnowledgeGraphNode[],
): Map<string, { x: number; y: number }> {
  const byCluster = new Map<string, KnowledgeGraphNode[]>();
  for (const node of nodes) {
    const list = byCluster.get(node.cluster) ?? [];
    list.push(node);
    byCluster.set(node.cluster, list);
  }
  // Sort clusters by size so the biggest sits at a stable angle (no jitter
  // when nodes are added later).
  const clusters = [...byCluster.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  const positions = new Map<string, { x: number; y: number }>();
  const clusterCount = Math.max(clusters.length, 1);
  const orbitRadius = 360 + clusters.length * 60;

  clusters.forEach(([, clusterNodes], clusterIndex) => {
    const clusterAngle =
      (clusterIndex / clusterCount) * Math.PI * 2 - Math.PI / 2;
    const cx = Math.cos(clusterAngle) * orbitRadius;
    const cy = Math.sin(clusterAngle) * orbitRadius;

    if (clusterNodes.length === 1) {
      positions.set(clusterNodes[0].id, { x: cx, y: cy });
      return;
    }
    const innerRadius = 90 + clusterNodes.length * 22;
    clusterNodes.forEach((node, nodeIndex) => {
      const innerAngle = (nodeIndex / clusterNodes.length) * Math.PI * 2;
      positions.set(node.id, {
        x: cx + Math.cos(innerAngle) * innerRadius,
        y: cy + Math.sin(innerAngle) * innerRadius,
      });
    });
  });

  return positions;
}

function paletteForCluster(cluster: string): ClusterPalette {
  const key = (cluster || "general").toLowerCase();
  let hash = 7;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    border: `hsl(${hue} 70% 45%)`,
    background: `hsl(${hue} 85% 96%)`,
    text: `hsl(${hue} 55% 18%)`,
    accent: `hsl(${hue} 65% 35%)`,
  };
}

// Evaluates confidence and returns theme-aware Tailwind classes
function getConfidenceColorClass(confidence: number): string {
  if (confidence >= 0.8) return "text-emerald-600 dark:text-emerald-400 font-semibold";
  if (confidence >= 0.5) return "text-amber-600 dark:text-amber-400 font-semibold";
  return "text-rose-600 dark:text-rose-400 font-semibold";
}

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
  "teach-back": { label: "Teach-back", icon: GraduationCap },
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
  const [factsStep, setFactsStep] = React.useState<"input" | "review">("input");
  const [extracting, setExtracting] = React.useState(false);
  const [merging, setMerging] = React.useState(false);
  const [proposal, setProposal] = React.useState<KnowledgeGraphProposal | null>(null);
  const [stats, setStats] = React.useState<KnowledgeGraphTopicStats>({});
  const [pulsingIds, setPulsingIds] = React.useState<Set<string>>(new Set());
  const [practicingId, setPracticingId] = React.useState<string | null>(null);
  const prevNodeIdsRef = React.useRef<Set<string>>(new Set());

  const selected = graph.nodes.find((node) => node.id === selectedId) ?? graph.nodes[0];
  const relatedEdges = graph.edges.filter(
    (edge) => edge.source === selected?.id || edge.target === selected?.id,
  );
  const sprintItems = React.useMemo(() => buildStudySprint(graph, stats), [graph, stats]);

  const loadStats = React.useCallback(async () => {
    try {
      const next = await getKnowledgeGraphTopicStats();
      setStats(next);
    } catch {
      // Stats are best-effort — empty means "no practice yet".
    }
  }, []);

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
      void loadStats();
    });
  }, [loadGraph, loadStats]);

  // Realtime: kg_versions inserts mean a new build just landed. Refetch
  // (graph + stats) and let the pulse-on-arrive effect highlight the deltas.
  // Falls through harmlessly if the channel can't subscribe (e.g. local dev
  // without the publication migration applied).
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("kg-versions")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "kg_versions" },
        () => {
          void loadGraph({ silent: true });
          void loadStats();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadGraph, loadStats]);

  // Fallback poll — kept as a safety net when Realtime isn't wired up yet.
  // Cheap (15s, silent) so it doesn't compete with subscriptions.
  React.useEffect(() => {
    const id = window.setInterval(() => {
      void loadGraph({ silent: true });
    }, 15000);
    return () => window.clearInterval(id);
  }, [loadGraph]);

  // Pulse the *new* node ids whenever the graph changes. Ignores the very
  // first render (prev is empty) so we don't flash every node on initial load.
  React.useEffect(() => {
    const current = new Set(graph.nodes.map((node) => node.id));
    const prev = prevNodeIdsRef.current;
    prevNodeIdsRef.current = current;
    if (prev.size === 0) return;

    const arrived: string[] = [];
    for (const id of current) {
      if (!prev.has(id)) arrived.push(id);
    }
    if (arrived.length === 0) return;

    setPulsingIds((existing) => {
      const merged = new Set(existing);
      for (const id of arrived) merged.add(id);
      return merged;
    });
    const timer = window.setTimeout(() => {
      setPulsingIds((existing) => {
        const next = new Set(existing);
        for (const id of arrived) next.delete(id);
        return next;
      });
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [graph.nodes]);

  const handlePracticed = React.useCallback(
    async (item: SprintItem) => {
      setPracticingId(item.id);
      try {
        const result = await recordKnowledgeGraphPractice(item.topicId, item.principle);
        setGraph((current) => ({
          ...current,
          nodes: current.nodes.map((node) =>
            node.id === item.topicId
              ? { ...node, mastery: result.mastery, confidence: result.confidence }
              : node,
          ),
        }));
        setStats((current) => ({
          ...current,
          [item.topicId]: {
            practice_count: result.practice_count,
            last_practiced_at: result.last_practiced_at,
            last_principle: item.principle,
            first_seen_at: current[item.topicId]?.first_seen_at ?? result.last_practiced_at,
          },
        }));
        setPulsingIds((existing) => {
          const merged = new Set(existing);
          merged.add(item.topicId);
          return merged;
        });
        window.setTimeout(() => {
          setPulsingIds((existing) => {
            const next = new Set(existing);
            next.delete(item.topicId);
            return next;
          });
        }, 1500);
        toast.success(
          `Practiced ${item.title} — mastery ${Math.round(result.mastery * 100)}%`,
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not record practice.",
        );
      } finally {
        setPracticingId(null);
      }
    },
    [],
  );

  const resetFactsDialog = React.useCallback(() => {
    setFactsStep("input");
    setProposal(null);
    setFactsTitle("");
    setFactsText("");
  }, []);

  const extractFacts = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = factsText.trim();
    if (!text) return;

    setExtracting(true);
    try {
      const next = await proposeKnowledgeGraphFromText({
        title: factsTitle.trim() || undefined,
        text,
      });
      setProposal(next);
      setFactsStep("review");
      if (!next.proposed_nodes.length && !next.proposed_edges.length) {
        toast.info("LLM returned no facts — try adding more detail.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not extract facts.");
    } finally {
      setExtracting(false);
    }
  };

  const commitProposal = async () => {
    if (!proposal) return;
    if (!proposal.proposed_nodes.length && !proposal.proposed_edges.length) {
      toast.info("Add at least one node or edge before committing.");
      return;
    }
    setMerging(true);
    try {
      const result = await mergeKnowledgeGraphProposal({
        source_id: proposal.source_id,
        title: proposal.title,
        text: proposal.text,
        proposed_nodes: proposal.proposed_nodes,
        proposed_edges: proposal.proposed_edges,
      });
      toast.success(result.message || "Reviewed proposal queued for merge.");
      setFactsOpen(false);
      resetFactsDialog();
      window.setTimeout(() => void loadGraph({ silent: true }), 3000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not merge proposal.");
    } finally {
      setMerging(false);
    }
  };

  const updateProposalNode = (index: number, patch: Partial<KnowledgeGraphProposalNode>) => {
    setProposal((current) => {
      if (!current) return current;
      const proposed_nodes = current.proposed_nodes.map((node, i) =>
        i === index ? { ...node, ...patch } : node,
      );
      return { ...current, proposed_nodes };
    });
  };

  const removeProposalNode = (index: number) => {
    setProposal((current) => {
      if (!current) return current;
      const removed = current.proposed_nodes[index];
      const proposed_nodes = current.proposed_nodes.filter((_, i) => i !== index);
      // Drop edges that reference the removed node title; merge would either
      // skip them or auto-create a placeholder otherwise.
      const proposed_edges = removed
        ? current.proposed_edges.filter(
            (edge) =>
              edge.source_title !== removed.title && edge.target_title !== removed.title,
          )
        : current.proposed_edges;
      return { ...current, proposed_nodes, proposed_edges };
    });
  };

  const addProposalNode = () => {
    setProposal((current) => {
      if (!current) return current;
      const blank: KnowledgeGraphProposalNode = {
        title: "",
        summary: "",
        revision_prompt: "",
        aliases: [],
        tags: [],
        cluster: "general",
        confidence: 0.65,
        evidence: ["user-added"],
        matched_existing_id: null,
        matched_existing_title: null,
        is_new: true,
      };
      return { ...current, proposed_nodes: [...current.proposed_nodes, blank] };
    });
  };

  const updateProposalEdge = (index: number, patch: Partial<KnowledgeGraphProposalEdge>) => {
    setProposal((current) => {
      if (!current) return current;
      const proposed_edges = current.proposed_edges.map((edge, i) =>
        i === index ? { ...edge, ...patch } : edge,
      );
      return { ...current, proposed_edges };
    });
  };

  const removeProposalEdge = (index: number) => {
    setProposal((current) => {
      if (!current) return current;
      return {
        ...current,
        proposed_edges: current.proposed_edges.filter((_, i) => i !== index),
      };
    });
  };

  const addProposalEdge = () => {
    setProposal((current) => {
      if (!current) return current;
      const blank: KnowledgeGraphProposalEdge = {
        source_title: current.proposed_nodes[0]?.title ?? "",
        target_title: current.proposed_nodes[1]?.title ?? current.existing_node_titles[0] ?? "",
        relation: "extends",
        strength: 0.6,
        confidence: 0.65,
        evidence: "",
      };
      return { ...current, proposed_edges: [...current.proposed_edges, blank] };
    });
  };

  const positions = React.useMemo(() => layoutNodes(graph.nodes), [graph.nodes]);

  const flowNodes = React.useMemo<Node[]>(
    () =>
      graph.nodes.map((topic) => ({
        id: topic.id,
        type: "default",
        position: positions.get(topic.id) ?? topic.position,
        data: {
          label: (
            <TopicNode
              topic={topic}
              selected={topic.id === selected?.id}
              pulsing={pulsingIds.has(topic.id)}
            />
          ),
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
    [graph.nodes, positions, selected?.id, pulsingIds],
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
      <style dangerouslySetInnerHTML={{ __html: PULSE_KEYFRAMES }} />
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
            {sprintItems.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Sprint needs at least one node — add facts to the graph first.
              </p>
            ) : null}
            {sprintItems.map((item) => {
              const meta = PRINCIPLE_META[item.principle];
              const Icon = meta.icon;
              const stat = stats[item.topicId];
              const isPracticing = practicingId === item.id;
              return (
                <article key={item.id} className="rounded-md border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <Icon className="size-4" />
                        <h3 className="text-sm font-semibold">{item.title}</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{meta.label}</Badge>
                        {stat?.practice_count ? (
                          <Badge variant="outline" className="text-[10px]">
                            {stat.practice_count} prior {stat.practice_count === 1 ? "rep" : "reps"}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                      <Button
                        size="sm"
                        variant="default"
                        disabled={isPracticing}
                        onClick={() => void handlePracticed(item)}
                      >
                        {isPracticing ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Check className="size-4" />
                        )}
                        Mark practiced
                      </Button>
                    </div>
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

      <Dialog
        open={factsOpen}
        onOpenChange={(open) => {
          setFactsOpen(open);
          if (!open) resetFactsDialog();
        }}
      >
        <DialogContent className={factsStep === "review" ? "sm:max-w-4xl" : "sm:max-w-2xl"}>
          {factsStep === "input" ? (
            <>
              <DialogHeader>
                <DialogTitle>Add Knowledge</DialogTitle>
                <DialogDescription>
                  Paste a topic name and optional notes. The LLM proposes nodes and edges,
                  you review and edit, then we async-merge into the graph.
                </DialogDescription>
              </DialogHeader>

              <form className="grid gap-3" onSubmit={extractFacts}>
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
                  <Button type="submit" disabled={!factsText.trim() || extracting}>
                    {extracting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    Preview facts
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <ProposalReview
              proposal={proposal}
              merging={merging}
              onBack={() => setFactsStep("input")}
              onCommit={commitProposal}
              onUpdateNode={updateProposalNode}
              onRemoveNode={removeProposalNode}
              onAddNode={addProposalNode}
              onUpdateEdge={updateProposalEdge}
              onRemoveEdge={removeProposalEdge}
              onAddEdge={addProposalEdge}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const RELATION_OPTIONS: KnowledgeGraphEdge["relation"][] = [
  "prerequisite",
  "extends",
  "analogous",
  "contrasts",
  "debugs",
];

function ProposalReview({
  proposal,
  merging,
  onBack,
  onCommit,
  onUpdateNode,
  onRemoveNode,
  onAddNode,
  onUpdateEdge,
  onRemoveEdge,
  onAddEdge,
}: {
  proposal: KnowledgeGraphProposal | null;
  merging: boolean;
  onBack: () => void;
  onCommit: () => void;
  onUpdateNode: (index: number, patch: Partial<KnowledgeGraphProposalNode>) => void;
  onRemoveNode: (index: number) => void;
  onAddNode: () => void;
  onUpdateEdge: (index: number, patch: Partial<KnowledgeGraphProposalEdge>) => void;
  onRemoveEdge: (index: number) => void;
  onAddEdge: () => void;
}) {
  if (!proposal) return null;
  const totalItems = proposal.proposed_nodes.length + proposal.proposed_edges.length;
  return (
    <>
      <DialogHeader>
        <DialogTitle>Review proposed facts</DialogTitle>
        <DialogDescription>
          The LLM extracted {proposal.proposed_nodes.length} nodes and{" "}
          {proposal.proposed_edges.length} edges. Edit titles, summaries, and relations
          before committing. Nodes flagged &quot;merging&quot; will fold into an existing
          graph node.
        </DialogDescription>
      </DialogHeader>

      <ScrollArea className="max-h-[60vh] pr-2">
        <div className="space-y-5">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Nodes ({proposal.proposed_nodes.length})</h3>
              <Button type="button" size="sm" variant="outline" onClick={onAddNode}>
                <Plus className="size-4" />
                Add node
              </Button>
            </div>
            {proposal.proposed_nodes.length === 0 ? (
              <p className="text-muted-foreground text-xs">No nodes proposed.</p>
            ) : (
              <ul className="space-y-2">
                {proposal.proposed_nodes.map((node, index) => (
                  <li key={`node-${index}`} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {node.is_new ? (
                          <Badge variant="default">New</Badge>
                        ) : (
                          <Badge variant="secondary">
                            Merging into {node.matched_existing_title}
                          </Badge>
                        )}
                        <Badge variant="outline">cluster: {node.cluster}</Badge>
                      </div>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Remove node"
                        onClick={() => onRemoveNode(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-2">
                      <Input
                        value={node.title}
                        onChange={(event) => onUpdateNode(index, { title: event.target.value })}
                        placeholder="Title"
                      />
                      <textarea
                        className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-20 rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                        value={node.summary}
                        onChange={(event) => onUpdateNode(index, { summary: event.target.value })}
                        placeholder="Summary"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Edges ({proposal.proposed_edges.length})</h3>
              <Button type="button" size="sm" variant="outline" onClick={onAddEdge}>
                <Plus className="size-4" />
                Add edge
              </Button>
            </div>
            {proposal.proposed_edges.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No edges proposed. Add edges manually or commit only the nodes.
              </p>
            ) : (
              <ul className="space-y-2">
                {proposal.proposed_edges.map((edge, index) => (
                  <li key={`edge-${index}`} className="rounded-md border p-3">
                    <div className="flex items-center justify-end">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Remove edge"
                        onClick={() => onRemoveEdge(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr]">
                      <Input
                        value={edge.source_title}
                        onChange={(event) =>
                          onUpdateEdge(index, { source_title: event.target.value })
                        }
                        placeholder="Source title"
                      />
                      <select
                        className="border-input bg-background rounded-md border px-2 py-2 text-sm"
                        value={edge.relation}
                        onChange={(event) =>
                          onUpdateEdge(index, {
                            relation: event.target.value as KnowledgeGraphEdge["relation"],
                          })
                        }
                      >
                        {RELATION_OPTIONS.map((rel) => (
                          <option key={rel} value={rel}>
                            {rel}
                          </option>
                        ))}
                      </select>
                      <Input
                        value={edge.target_title}
                        onChange={(event) =>
                          onUpdateEdge(index, { target_title: event.target.value })
                        }
                        placeholder="Target title"
                      />
                    </div>
                    <textarea
                      className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring mt-2 min-h-12 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                      value={edge.evidence}
                      onChange={(event) => onUpdateEdge(index, { evidence: event.target.value })}
                      placeholder="Evidence (why this relation holds)"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </ScrollArea>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button type="button" onClick={onCommit} disabled={merging || totalItems === 0}>
          {merging ? <Loader2 className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />}
          Commit to graph
        </Button>
      </DialogFooter>
    </>
  );
}

// Sprint selection — stats-aware, four-principle.
//
// Priority score = (1 - mastery) * 0.6 + (1 - confidence) * 0.4
//                  * stalenessBoost (penalize anything practiced within the
//                  last SPRINT_RECENCY_PENALTY_DAYS so the user doesn't see
//                  the same item twice in a row).
//
// Slots:
//   1. Retrieval     — highest priority node                  (active recall)
//   2. Prerequisite  — largest mastery gap across prereq edge (foundational repair)
//   3. Interleaving  — different cluster from #1              (transfer)
//   4. Teach-back    — high mastery + cool-down satisfied     (Feynman consolidation)
function buildStudySprint(
  graph: KnowledgeGraphPayload,
  stats: KnowledgeGraphTopicStats,
): SprintItem[] {
  if (!graph.nodes.length) return [];
  const now = Date.now();
  const DAY = 86_400_000;

  const scored = graph.nodes.map((node) => {
    const stat = stats[node.id];
    const daysSince = stat?.last_practiced_at
      ? (now - new Date(stat.last_practiced_at).getTime()) / DAY
      : Number.POSITIVE_INFINITY;
    const stalenessBoost =
      daysSince < SPRINT_RECENCY_PENALTY_DAYS
        ? daysSince / SPRINT_RECENCY_PENALTY_DAYS
        : 1;
    const need = (1 - node.mastery) * 0.6 + (1 - node.confidence) * 0.4;
    return { node, priority: need * stalenessBoost };
  });
  const byPriority = [...scored].sort((a, b) => b.priority - a.priority);

  const retrieval = byPriority[0]?.node;

  // Prereq score = gap * stalenessBoost(source). The boost mirrors the one
  // used for Retrieval, so marking the source practiced drops this edge to
  // ~0 score and lets another prereq surface. Without it, the biggest-gap
  // edge keeps winning even after several reps. We also drop:
  //   - edges with non-positive gap (prereq is already stronger than dependent)
  //   - edges whose source already holds the Retrieval slot (no duplication)
  const prereq = graph.edges
    .filter((edge) => edge.relation === "prerequisite")
    .map((edge) => {
      const source = graph.nodes.find((node) => node.id === edge.source);
      const target = graph.nodes.find((node) => node.id === edge.target);
      if (!source || !target) return null;
      if (source.id === retrieval?.id) return null;
      const gap = target.mastery - source.mastery;
      if (gap <= 0) return null;
      const stat = stats[source.id];
      const daysSince = stat?.last_practiced_at
        ? (now - new Date(stat.last_practiced_at).getTime()) / DAY
        : Number.POSITIVE_INFINITY;
      const stalenessBoost =
        daysSince < SPRINT_RECENCY_PENALTY_DAYS
          ? daysSince / SPRINT_RECENCY_PENALTY_DAYS
          : 1;
      return { edge, source, target, score: gap * stalenessBoost };
    })
    .filter(
      (
        item,
      ): item is {
        edge: KnowledgeGraphEdge;
        source: KnowledgeGraphNode;
        target: KnowledgeGraphNode;
        score: number;
      } => item !== null,
    )
    .sort((a, b) => b.score - a.score)[0];

  const interleave = byPriority.find(
    (entry) =>
      entry.node.cluster !== retrieval?.cluster &&
      entry.node.id !== retrieval?.id &&
      entry.node.id !== prereq?.source.id,
  )?.node;

  const teachable = [...graph.nodes]
    .filter((node) => node.mastery >= SPRINT_TEACHBACK_THRESHOLD)
    .filter((node) => node.id !== retrieval?.id && node.id !== interleave?.id)
    .filter((node) => {
      const stat = stats[node.id];
      if (!stat?.last_practiced_at) return true;
      const days = (now - new Date(stat.last_practiced_at).getTime()) / DAY;
      return days > SPRINT_TEACH_COOLDOWN_DAYS || stat.last_principle !== "teach-back";
    })
    .sort((a, b) => b.mastery - a.mastery)[0];

  const items: (SprintItem | null)[] = [
    retrieval
      ? {
          id: `retrieval-${retrieval.id}`,
          principle: "retrieval",
          title: retrieval.title,
          topicId: retrieval.id,
          prompt: retrieval.revision_prompt,
          why: `${Math.round((1 - retrieval.mastery) * 100)}% mastery gap — recall before reading notes.`,
        }
      : null,
    prereq
      ? {
          id: `prerequisite-${prereq.edge.id}`,
          principle: "prerequisite",
          title: `${prereq.source.title} → ${prereq.target.title}`,
          topicId: prereq.source.id,
          prompt: `Explain why ${prereq.source.title} has to be stable before ${prereq.target.title}.`,
          why: prereq.edge.evidence,
        }
      : null,
    interleave
      ? {
          id: `interleave-${interleave.id}`,
          principle: "interleaving",
          title: interleave.title,
          topicId: interleave.id,
          prompt: `Different cluster — answer without rereading. ${interleave.revision_prompt}`,
          why: "Cluster switch breaks blocked practice and builds transfer.",
        }
      : null,
    teachable
      ? {
          id: `teach-${teachable.id}`,
          principle: "teach-back",
          title: teachable.title,
          topicId: teachable.id,
          prompt: `Teach ${teachable.title} aloud to a peer. Use one example and one analogy.`,
          why: `${Math.round(teachable.mastery * 100)}% mastery — teach-back locks it in.`,
        }
      : null,
  ];

  return items.filter((item): item is SprintItem => item !== null);
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

function TopicNode({
  topic,
  selected,
  pulsing,
}: {
  topic: KnowledgeGraphNode;
  selected: boolean;
  pulsing: boolean;
}) {
  const palette = paletteForCluster(topic.cluster);
  return (
    <div
      className={cn(
        "rounded-lg border-2 p-3 shadow-sm",
        selected && "ring-ring ring-2 ring-offset-2",
        pulsing && "kg-pulse",
      )}
      style={{
        borderColor: palette.border,
        background: palette.background,
        color: palette.text,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-semibold">{topic.title}</p>
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{ background: "rgba(255,255,255,0.7)", color: palette.accent }}
        >
          {Math.round(topic.mastery * 100)}%
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs opacity-80">{topic.summary}</p>
      <div className="mt-3 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.6)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(8, Math.round(topic.mastery * 100))}%`,
            background: palette.accent,
          }}
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
          <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
            {selected.cluster.replace("-", " ")} · confidence 
            <span className={getConfidenceColorClass(selected.confidence)}>
              {Math.round(selected.confidence * 100)}%
            </span>
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
