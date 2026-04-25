import type {
  AgentTrace,
  CanvasEdge,
  CanvasNode,
  DemoDocument,
  DemoSession,
} from "@/lib/canvasai-types";

export const DEMO_DOCUMENTS: DemoDocument[] = [
  {
    id: "clrs-bst",
    title: "CLRS binary search tree excerpt.pdf",
    type: "PDF",
    status: "Indexed",
    size: "2.4 MB",
    chunks: 48,
    updatedAt: "Today, 7:42 PM",
    tags: ["trees", "invariants"],
  },
  {
    id: "pointer-notes",
    title: "Pointer arithmetic lab notes.md",
    type: "Notes",
    status: "Indexed",
    size: "84 KB",
    chunks: 12,
    updatedAt: "Today, 6:18 PM",
    tags: ["memory", "c"],
  },
  {
    id: "react-flow-api",
    title: "React Flow node API reference",
    type: "Docs",
    status: "Needs review",
    size: "320 KB",
    chunks: 19,
    updatedAt: "Yesterday",
    tags: ["canvas", "schema"],
  },
];

const BST_NODES: CanvasNode[] = [
  {
    id: "root-42",
    type: "default",
    position: { x: 0, y: 0 },
    data: {
      label: "42",
      detail: "Root value. Every left value is smaller; every right value is larger.",
    },
  },
  {
    id: "left-21",
    type: "default",
    position: { x: -220, y: 150 },
    data: { label: "21", detail: "Left subtree preserves the same ordering rule." },
  },
  {
    id: "right-64",
    type: "default",
    position: { x: 220, y: 150 },
    data: { label: "64", detail: "Right subtree contains values greater than 42." },
  },
  {
    id: "duplicate-case",
    type: "default",
    position: { x: 0, y: 300 },
    data: { label: "duplicate 42?", detail: "Policy branch: reject, count, or store to one side." },
  },
];

const BST_EDGES: CanvasEdge[] = [
  { id: "root-left", source: "root-42", target: "left-21", type: "smoothstep", label: "<" },
  { id: "root-right", source: "root-42", target: "right-64", type: "smoothstep", label: ">" },
  {
    id: "root-duplicate",
    source: "root-42",
    target: "duplicate-case",
    type: "smoothstep",
    animated: true,
    label: "edge case",
  },
];

const STACK_NODES: CanvasNode[] = [
  {
    id: "call-main",
    type: "default",
    position: { x: 0, y: 0 },
    data: { label: "main()", detail: "Caller frame owns argc, argv, and return path." },
  },
  {
    id: "call-sum",
    type: "default",
    position: { x: -180, y: 150 },
    data: { label: "sum(a, b)", detail: "Callee frame receives copied parameters." },
  },
  {
    id: "return-slot",
    type: "default",
    position: { x: 180, y: 150 },
    data: { label: "return slot", detail: "Return value is copied back before popping the frame." },
  },
];

const STACK_EDGES: CanvasEdge[] = [
  { id: "main-sum", source: "call-main", target: "call-sum", type: "smoothstep", label: "call" },
  {
    id: "sum-return",
    source: "call-sum",
    target: "return-slot",
    type: "smoothstep",
    animated: true,
    label: "return",
  },
];

const POINTER_NODES: CanvasNode[] = [
  {
    id: "array-base",
    type: "default",
    position: { x: 0, y: 0 },
    data: { label: "arr[0]", detail: "Base address for contiguous int storage." },
  },
  {
    id: "ptr-plus-one",
    type: "default",
    position: { x: -180, y: 150 },
    data: { label: "p + 1", detail: "Moves by sizeof(int), not one byte." },
  },
  {
    id: "byte-view",
    type: "default",
    position: { x: 180, y: 150 },
    data: { label: "byte view", detail: "Casting changes the stride of pointer arithmetic." },
  },
];

const POINTER_EDGES: CanvasEdge[] = [
  { id: "base-plus", source: "array-base", target: "ptr-plus-one", type: "smoothstep", label: "+4" },
  { id: "base-byte", source: "array-base", target: "byte-view", type: "smoothstep", label: "cast" },
];

const TRACE: AgentTrace[] = [
  {
    agent: "agent_0_retrieval",
    label: "Retrieval",
    message: "Matched 4 source chunks from indexed documents",
    status: "complete",
  },
  {
    agent: "agent_1_synthesizer",
    label: "Synthesizer",
    message: "Converted prompt and canvas state into a technical directive",
    status: "complete",
  },
  {
    agent: "agent_2_architect",
    label: "Architect",
    message: "Selected micro-step pacing with invariant-first layout",
    status: "complete",
  },
  {
    agent: "agent_3_schema",
    label: "Schema Enforcer",
    message: "Emitted React Flow nodes and edges",
    status: "complete",
  },
];

export const DEMO_SESSIONS: DemoSession[] = [
  {
    id: "demo",
    topic: "Binary Search Trees",
    status: "Ready",
    updatedAt: "2 min ago",
    profile: "Spatial dyslexia mode",
    duration: "8 turns",
    confidence: "92%",
    sourceCount: 2,
    prompt: "Show why duplicate inserts break a naive BST invariant.",
    nodes: BST_NODES,
    edges: BST_EDGES,
    trace: TRACE,
    turns: [
      {
        index: 0,
        prompt: "Draw a binary search tree",
        summary: "Created the root and first-order left/right branches.",
        nodes: 3,
        edges: 2,
      },
      {
        index: 1,
        prompt: "What if I insert a duplicate?",
        summary: "Added a policy branch for duplicate handling.",
        nodes: 4,
        edges: 3,
      },
    ],
  },
  {
    id: "stack-frames",
    topic: "Stack frames and calling conventions",
    status: "In review",
    updatedAt: "18 min ago",
    profile: "High-stim micro-steps",
    duration: "5 turns",
    confidence: "86%",
    sourceCount: 1,
    prompt: "Explain what changes when sum(a, b) returns.",
    nodes: STACK_NODES,
    edges: STACK_EDGES,
    trace: TRACE,
    turns: [
      {
        index: 0,
        prompt: "Draw a stack call",
        summary: "Separated caller frame, callee frame, and return slot.",
        nodes: 3,
        edges: 2,
      },
    ],
  },
  {
    id: "pointer-arith",
    topic: "Pointer arithmetic in C",
    status: "Draft",
    updatedAt: "43 min ago",
    profile: "Low-stim focus",
    duration: "4 turns",
    confidence: "81%",
    sourceCount: 1,
    prompt: "Show why p + 1 is different from byte offset +1.",
    nodes: POINTER_NODES,
    edges: POINTER_EDGES,
    trace: TRACE,
    turns: [
      {
        index: 0,
        prompt: "Explain pointer stride",
        summary: "Mapped base address, typed stride, and byte view.",
        nodes: 3,
        edges: 2,
      },
    ],
  },
];

export function getCanvasSession(id: string): DemoSession {
  const found = DEMO_SESSIONS.find((session) => session.id === id);
  if (found) return found;

  return {
    ...DEMO_SESSIONS[0],
    id,
    topic: id
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    status: "Draft",
    updatedAt: "just now",
  };
}
