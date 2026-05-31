# CanvasAI System Architecture 

CanvasAI decouples "teaching" from "layout rendering" to guarantee stable, visual-first UI components.

## 1. System Overview

```mermaid
flowchart LR
    Browser[Browser / Next.js] -->|HTTPS| SupaAuth[(Supabase Auth)]
    Browser -->|REST| FastAPI[FastAPI Backend]
    Browser <-->|Bi-directional WebSocket| FastAPI
    
    subgraph Engine [Backend Engine]
        FastAPI -->|State| LangGraph[LangGraph Multi-Agent]
        LangGraph -->|LLM Calls| Gemini[(Gemini 3.5 Flash)]
    end
    
    Engine -. Async Events .-> Inngest[(Inngest Workers)]
    Inngest -. Build .-> DB[(Supabase Postgres)]
    Engine -. Persist .-> DB

```

## 2. The 5-Agent LangGraph Pipeline (DAG)

Standard LLMs fail at visual education because they attempt to reason about pedagogy and compute strict JSON coordinate math simultaneously. We solve this via a specialized pipeline:

```mermaid
sequenceDiagram
    participant UI as React Flow Canvas
    participant WS as WebSocket Route
    participant A0 as Retrieval (Agent 0)
    participant A1 as Synthesizer (Agent 1)
    participant CP as Curriculum Planner (Agent 1.5)
    participant A2 as Architect (Agent 2)
    participant A3 as Schema Enforcer (Agent 3)

    UI->>WS: { prompt, current_nodes, current_edges }
    WS->>A0: Router: Extract active context to prevent amnesia
    A0->>A1: Librarian: Distill high-yield contextual payload
    WS-->>UI: { status: "Synthesizing context..." }
    
    alt New Topic Detected
        A1->>CP: Conditional Trigger: Generate foundational roadmap
        WS-->>UI: { status: "Planning curriculum..." }
        CP->>A2: Pass structured curriculum context
    else Existing Topic
        A1->>A2: Direct routing
    end
    
    A2->>A3: Teacher: Generate pedagogical text & visual_script
    WS-->>UI: { status: "Architecting lesson..." }
    A3-->>WS: Compiler: Translate script to strict X/Y JSON via Constrained Prompting
    WS-->>UI: { status: "Enforcing layout..." }
    WS-->>UI: { nodes, edges, ai_chat_response }
    UI->>UI: Hydrate canvas & push timeline frame
```

## 3. Frontend Hydration & Session Caching

To ensure instantaneous loading without SSR blocking, the frontend uses a highly aggressive TanStack Query cache (`frontend/lib/session-cache.ts`):

* **Stale-while-revalidate:** Serves cached canvas payloads instantly while re-fetching background updates.
* **Hover Prefetching:** Hovering over a session row in the sidebar pre-warms the cache before the user clicks, resulting in zero network-latency transitions.
* **Timeline Branching:** When a user forks a timeline, the new session's cache is warmed dynamically before routing to ensure the destination canvas paints immediately.
