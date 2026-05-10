import type { Edge, Node } from "@xyflow/react";

export type CanvasNodeData = {
  label: string;
  detail?: string;
};

export type CanvasNode = Node<CanvasNodeData>;
export type CanvasEdge = Edge;

export type CanvasPayload = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

export type AgentTrace = {
  agent: string;
  label?: string;
  message: string;
  status?: "complete" | "running" | "queued";
};

export type DemoTurn = {
  index: number;
  prompt: string;
  summary: string;
  nodes: number;
  edges: number;
};

export type SessionTurn = {
  prompt: string;
  payload: CanvasPayload;
  turn_index: number;
  created_at: string;
  is_checkpoint?: boolean;
};

export type SessionSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  turn_count: number;
  last_prompt?: string | null;
};

export type DemoSession = {
  id: string;
  topic: string;
  status: "Ready" | "In review" | "Draft";
  updatedAt: string;
  profile: string;
  duration: string;
  confidence: string;
  sourceCount: number;
  prompt: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  trace: AgentTrace[];
  turns: DemoTurn[];
};

export type DemoDocument = {
  id: string;
  title: string;
  type: "PDF" | "Docs" | "Notes";
  status: "Indexed" | "Queued" | "Needs review";
  size: string;
  chunks: number;
  updatedAt: string;
  tags: string[];
};

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type ChatSessionSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
};

export type VisualizationTool = "socratic" | "analogy" | "steps" | "diagram";

export type ActiveRecallCard = {
  id: string;
  session_id: string;
  front: string;
  back: string;
  tags: string[];
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_at: string;
  created_at: string;
  updated_at: string;
  last_reviewed_at?: string | null;
};

export type ActiveRecallSessionGroup = {
  session_id: string;
  session_title: string;
  updated_at: string;
  card_count: number;
  due_count: number;
  cards: ActiveRecallCard[];
};

export type ActiveRecallStats = {
  total_cards: number;
  due_cards: number;
  sessions: number;
};

export type KnowledgeGraphNode = {
  id: string;
  title: string;
  summary: string;
  revision_prompt: string;
  mastery: number;
  confidence: number;
  cluster: string;
  tags: string[];
  evidence: string[];
  source_session_ids: string[];
  position: {
    x: number;
    y: number;
  };
};

export type KnowledgeGraphEdge = {
  id: string;
  source: string;
  target: string;
  relation: "prerequisite" | "extends" | "analogous" | "contrasts" | "debugs";
  strength: number;
  evidence: string;
  source_session_ids: string[];
};

export type KnowledgeGraphUpdatePlan = {
  trigger: "session_export" | "nightly_rebuild" | "manual_refresh";
  read_endpoint: string;
  write_endpoint: string;
  algorithm: string;
  notes: string[];
};

export type KnowledgeGraphPayload = {
  graph_id: string;
  user_id: string;
  version: number;
  generated_at: string;
  source_summary: {
    sessions: number;
    documents: number;
    cards: number;
  };
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  update_plan: KnowledgeGraphUpdatePlan;
};
