import type {
  ActiveRecallCard,
  ActiveRecallSessionGroup,
  ActiveRecallStats,
  CanvasEdge,
  CanvasNode,
  KnowledgeGraphPayload,
  KnowledgeGraphPracticePrinciple,
  KnowledgeGraphPracticeResponse,
  KnowledgeGraphProposal,
  KnowledgeGraphProposalEdge,
  KnowledgeGraphProposalNode,
  KnowledgeGraphTopicStats,
  SessionSummary,
  SessionTurn,
} from "@/lib/canvasai-types";
import { createClient } from "@/lib/supabase/client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
export const KNOWLEDGE_GRAPH_ENDPOINT = "/knowledge-graph/current";
export const KNOWLEDGE_GRAPH_EXPORT_ENDPOINT = "/knowledge-graph/from-session";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export class CanvasAIApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "CanvasAIApiError";
  }
}

export function backendWebSocketUrl(sessionId: string, token: string) {
  const url = new URL(BACKEND_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/ws/sessions/${sessionId}`;
  url.searchParams.set("token", token); // Attach for the backend query param
  return url.toString();
}

export async function listCanvasSessions() {
  return request<SessionSummary[]>("/sessions");
}

export async function createCanvasSession(title?: string) {
  return request<{ id: string; title: string }>("/sessions", {
    method: "POST",
    body: { title },
  });
}

export async function getCanvasHistory(sessionId: string) {
  return request<{ turns: SessionTurn[] }>(`/sessions/${sessionId}/history`);
}

export async function getActiveRecallStats() {
  return request<ActiveRecallStats>("/active-recall/stats");
}

export async function listActiveRecallCards(options: { sessionId?: string; dueOnly?: boolean } = {}) {
  const params = new URLSearchParams();
  if (options.sessionId) params.set("session_id", options.sessionId);
  if (options.dueOnly) params.set("due_only", "true");
  const query = params.toString();
  return request<ActiveRecallCard[]>(`/active-recall/cards${query ? `?${query}` : ""}`);
}

export async function listActiveRecallSessions(options: { dueOnly?: boolean } = {}) {
  const params = new URLSearchParams();
  if (options.dueOnly) params.set("due_only", "true");
  const query = params.toString();
  return request<ActiveRecallSessionGroup[]>(`/active-recall/sessions${query ? `?${query}` : ""}`);
}

export async function buildRecallFromSession({
  sessionId,
  title,
  prompt,
  nodes,
  edges,
}: {
  sessionId: string;
  title?: string;
  prompt?: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}) {
  return request<{ session_id: string; cards: ActiveRecallCard[]; replaced_count: number }>(
    `/active-recall/from-session/${sessionId}`,
    {
      method: "POST",
      body: { title, prompt, nodes, edges },
    },
  );
}

export async function reviewRecallCard(cardId: string, rating: "again" | "hard" | "good" | "easy") {
  return request<ActiveRecallCard>(`/active-recall/cards/${cardId}/review`, {
    method: "POST",
    body: { rating },
  });
}

export async function deleteSessionRecallCards(sessionId: string) {
  return request<{ deleted: number }>(`/active-recall/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export async function getKnowledgeGraph() {
  return request<KnowledgeGraphPayload>(KNOWLEDGE_GRAPH_ENDPOINT);
}

export async function getKnowledgeGraphTopicStats() {
  return request<KnowledgeGraphTopicStats>("/knowledge-graph/stats");
}

export async function recordKnowledgeGraphPractice(
  node_id: string,
  principle: KnowledgeGraphPracticePrinciple,
) {
  return request<KnowledgeGraphPracticeResponse>("/knowledge-graph/practice", {
    method: "POST",
    body: { node_id, principle },
  });
}

export async function exportSessionToKnowledgeGraph({
  sessionId,
  prompt,
  nodes,
  edges,
}: {
  sessionId: string;
  prompt?: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}) {
  return request<{ graph_id: string; build_id?: string; queued: boolean; message: string }>(
    `${KNOWLEDGE_GRAPH_EXPORT_ENDPOINT}/${sessionId}`,
    {
      method: "POST",
      body: { prompt, nodes, edges },
    },
  );
}

export async function addTextToKnowledgeGraph({
  title,
  text,
}: {
  title?: string;
  text: string;
}) {
  return request<{ graph_id: string; build_id?: string; queued: boolean; message: string }>(
    "/knowledge-graph/from-text",
    {
      method: "POST",
      body: { title, text },
    },
  );
}

export async function proposeKnowledgeGraphFromText({
  title,
  text,
}: {
  title?: string;
  text: string;
}) {
  return request<KnowledgeGraphProposal>("/knowledge-graph/extract", {
    method: "POST",
    body: { title, text },
  });
}

export async function mergeKnowledgeGraphProposal({
  source_id,
  title,
  text,
  proposed_nodes,
  proposed_edges,
}: {
  source_id: string;
  title?: string | null;
  text?: string | null;
  proposed_nodes: KnowledgeGraphProposalNode[];
  proposed_edges: KnowledgeGraphProposalEdge[];
}) {
  return request<{ graph_id: string; build_id?: string; queued: boolean; message: string }>(
    "/knowledge-graph/merge",
    {
      method: "POST",
      body: { source_id, title, text, proposed_nodes, proposed_edges },
    },
  );
}

export async function toggleSessionCheckpoint(sessionId: string, turnIndex: number, isCheckpoint: boolean) {
  return request<{ status: string }>(`/sessions/${sessionId}/turns/${turnIndex}/checkpoint`, {
    method: "POST",
    body: { is_checkpoint: isCheckpoint },
  });
}

export async function revertSessionToTurn(sessionId: string, turnIndex: number) {
  return request<SessionTurn>(`/sessions/${sessionId}/revert/${turnIndex}`, {
    method: "POST",
  });
}

export async function branchSessionFromTurn(sessionId: string, turnIndex: number) {
  return request<{ id: string; title: string }>(`/sessions/${sessionId}/turns/${turnIndex}/branch`, {
    method: "POST",
  });
}

// THE CRITICAL UPDATE: Enforce session existence before fetching
async function request<T>(path: string, options: RequestOptions = {}) {
  const supabase = createClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new CanvasAIApiError("Authentication required. Please log in.", 401);
  }

  const headers = new Headers({
    "Content-Type": "application/json",
    ...options.headers,
  });

  headers.set("Authorization", `Bearer ${session.access_token}`);

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = await response.json();
      message = typeof data.detail === "string" ? data.detail : message;
    } catch {
      // Keep the status text when the server did not send JSON.
    }
    throw new CanvasAIApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export async function uploadResource(sessionId: string, data: {
  resource_type: 'pdf' | 'text' | 'link' | 'youtube';
  content: string;
  metadata?: any;
}) {
  return request<{ status: string; id: string }>(`/sessions/${sessionId}/resources`, {
    method: "POST",
    body: data,
  });
}

export async function updateSessionProfile(sessionId: string, profile: string) {
  return request<{ status: string }>(`/sessions/${sessionId}/profile`, {
    method: "PATCH",
    body: { neuro_profile: profile },
  });
}