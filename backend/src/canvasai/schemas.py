from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class CanvasPosition(BaseModel):
    x: float
    y: float


# --- Strictly typed frame so the LLM doesn't panic ---
class StepperFrame(BaseModel):
    line: int = Field(description="The line number currently executing")
    explanation: str = Field(description="Explanation of what is happening")
    variables: dict[str, str] = Field(default_factory=dict, description="Variable names and their current values")


class CanvasNodeData(BaseModel):
    label: str | None = Field(default=None, description="Main text, variable name, or gate type")
    value: str | None = Field(default=None, description="Data inside memory_block, or a pointer address")
    address: str | None = Field(default=None, description="Hex address for memory_block (e.g., 0xFA12)")
    inputs: str | None = Field(default=None, description="Inputs for logic_gate (e.g., 'S=0, R=1')")
    outputs: str | None = Field(default=None, description="Outputs for logic_gate (e.g., 'Q=1, Q_bar=0')")
    
    # --- NEW: Lesson Plan Fields ---
    steps: list[str] | None = Field(default=None, description="Array of steps for the roadmap")
    active_step: int | None = Field(default=None, description="Index of the currently active step")
    
    # --- NEW: Code Stepper Fields ---
    code: list[str] | None = Field(default=None, description="Array of code lines. NEVER use newline characters.")
    language: str | None = Field(default=None, description="Programming language (e.g., 'cpp', 'python')")
    frames: list[StepperFrame] | None = Field(default=None, description="List of execution frames with line, variables, and explanation")


class CanvasNode(BaseModel):
    id: str
    # STRICT LOCK: Added lesson_plan and code_stepper to the allowed types
    type: Literal["default", "memory_block", "logic_gate", "lesson_plan", "code_stepper"] = "default"
    position: CanvasPosition
    data: CanvasNodeData = Field(default_factory=CanvasNodeData)


class CanvasEdge(BaseModel):
    id: str
    source: str
    target: str
    type: Literal["default", "straight", "step", "smoothstep"] = "smoothstep"
    animated: bool | None = None
    label: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)


class CanvasPayload(BaseModel):
    nodes: list[CanvasNode] = Field(default_factory=list)
    edges: list[CanvasEdge] = Field(default_factory=list)
    ai_response: str = Field(default="Canvas updated.")

class TraceEntry(BaseModel):
    agent: str
    message: str


class SessionTurn(BaseModel):
    prompt: str
    payload: CanvasPayload
    turn_index: int
    created_at: datetime
    is_checkpoint: bool = False
    
    
class BranchSessionResponse(BaseModel):
    id: str
    title: str
    
class ToggleCheckpointRequest(BaseModel):
    is_checkpoint: bool

class SessionSummary(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    turn_count: int
    last_prompt: str | None = None


class SessionDetail(SessionSummary):
    turns: list[SessionTurn]


class CreateSessionRequest(BaseModel):
    title: str | None = None


class CreateSessionResponse(BaseModel):
    id: str
    title: str


class SessionHistoryResponse(BaseModel):
    turns: list[SessionTurn]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    created_at: datetime


class ChatSessionSummary(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int


class CreateChatSessionRequest(BaseModel):
    title: str | None = None


class CreateChatSessionResponse(BaseModel):
    id: str
    title: str


class SendChatMessageRequest(BaseModel):
    message: str = Field(min_length=1)
    visualization_tool: Literal["socratic", "analogy", "steps", "diagram"] = "socratic"


class SendChatMessageResponse(BaseModel):
    session_id: str
    user_message: ChatMessage
    assistant_message: ChatMessage


class ActiveRecallBuildRequest(BaseModel):
    title: str | None = None
    prompt: str | None = None
    nodes: list[CanvasNode] = Field(default_factory=list)
    edges: list[CanvasEdge] = Field(default_factory=list)


class ActiveRecallCard(BaseModel):
    id: str
    session_id: str
    front: str
    back: str
    tags: list[str] = Field(default_factory=list)
    ease_factor: float = 2.5
    interval_days: int = 0
    repetitions: int = 0
    due_at: datetime
    created_at: datetime
    updated_at: datetime
    last_reviewed_at: datetime | None = None


class ActiveRecallCardDraft(BaseModel):
    front: str = Field(min_length=1)
    back: str = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)


class ActiveRecallSessionGroup(BaseModel):
    session_id: str
    session_title: str
    updated_at: datetime
    card_count: int
    due_count: int
    cards: list[ActiveRecallCard]


class ActiveRecallBuildResponse(BaseModel):
    session_id: str
    cards: list[ActiveRecallCard]
    replaced_count: int


class ActiveRecallReviewRequest(BaseModel):
    rating: Literal["again", "hard", "good", "easy"]


class ActiveRecallStats(BaseModel):
    total_cards: int
    due_cards: int
    sessions: int


KnowledgeGraphRelation = Literal["prerequisite", "extends", "analogous", "contrasts", "debugs"]
KnowledgeGraphTrigger = Literal["session_export", "nightly_rebuild", "manual_refresh"]
KnowledgeGraphPracticePrinciple = Literal[
    "retrieval", "prerequisite", "interleaving", "teach-back"
]


class KnowledgeGraphSourceSummary(BaseModel):
    sessions: int = 0
    documents: int = 0
    cards: int = 0


class KnowledgeGraphNode(BaseModel):
    id: str
    title: str
    summary: str
    revision_prompt: str
    mastery: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    cluster: str
    tags: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    source_session_ids: list[str] = Field(default_factory=list)
    position: CanvasPosition


class KnowledgeGraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relation: KnowledgeGraphRelation
    strength: float = Field(ge=0, le=1)
    evidence: str
    source_session_ids: list[str] = Field(default_factory=list)


class KnowledgeGraphUpdatePlan(BaseModel):
    trigger: KnowledgeGraphTrigger
    read_endpoint: str
    write_endpoint: str
    algorithm: str
    notes: list[str] = Field(default_factory=list)


class KnowledgeGraphPayload(BaseModel):
    graph_id: str
    user_id: str
    version: int
    generated_at: datetime
    source_summary: KnowledgeGraphSourceSummary
    nodes: list[KnowledgeGraphNode]
    edges: list[KnowledgeGraphEdge]
    update_plan: KnowledgeGraphUpdatePlan


class KnowledgeGraphExportRequest(BaseModel):
    prompt: str | None = None
    nodes: list[CanvasNode] = Field(default_factory=list)
    edges: list[CanvasEdge] = Field(default_factory=list)
    facts: Any | None = None


class KnowledgeGraphManualFactsRequest(BaseModel):
    title: str | None = None
    text: str = Field(min_length=1)


class KnowledgeGraphCanvasFact(BaseModel):
    title: str = Field(min_length=1)
    description: str = ""


class KnowledgeGraphCanvasFactsRequest(BaseModel):
    session_id: str | None = None
    facts: list[KnowledgeGraphCanvasFact] = Field(min_length=1)


class KnowledgeGraphExportResponse(BaseModel):
    graph_id: str
    build_id: str
    queued: bool
    message: str


class KnowledgeGraphProposalNode(BaseModel):
    title: str
    summary: str = ""
    revision_prompt: str = ""
    aliases: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    cluster: str = "general"
    confidence: float = Field(default=0.65, ge=0, le=1)
    evidence: list[str] = Field(default_factory=list)
    matched_existing_id: str | None = None
    matched_existing_title: str | None = None
    is_new: bool = True


class KnowledgeGraphProposalEdge(BaseModel):
    source_title: str
    target_title: str
    relation: KnowledgeGraphRelation = "extends"
    strength: float = Field(default=0.55, ge=0, le=1)
    confidence: float = Field(default=0.65, ge=0, le=1)
    evidence: str = ""


class KnowledgeGraphProposal(BaseModel):
    source_id: str
    title: str | None = None
    text: str | None = None
    proposed_nodes: list[KnowledgeGraphProposalNode]
    proposed_edges: list[KnowledgeGraphProposalEdge]
    existing_node_titles: list[str] = Field(default_factory=list)


class KnowledgeGraphProposeRequest(BaseModel):
    title: str | None = None
    text: str = Field(min_length=1)


class KnowledgeGraphMergeRequest(BaseModel):
    source_id: str
    title: str | None = None
    text: str | None = None
    proposed_nodes: list[KnowledgeGraphProposalNode]
    proposed_edges: list[KnowledgeGraphProposalEdge]


class KnowledgeGraphTopicStat(BaseModel):
    practice_count: int = 0
    last_practiced_at: datetime | None = None
    last_principle: KnowledgeGraphPracticePrinciple | None = None
    first_seen_at: datetime | None = None


class KnowledgeGraphPracticeRequest(BaseModel):
    node_id: str = Field(min_length=1)
    principle: KnowledgeGraphPracticePrinciple = "retrieval"


class KnowledgeGraphPracticeResponse(BaseModel):
    node_id: str
    mastery: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    practice_count: int
    last_practiced_at: datetime
