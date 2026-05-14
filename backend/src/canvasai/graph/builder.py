"""Compose the 5-agent CanvasAI pipeline as a LangGraph.

To add an agent:
  1. Implement it in `canvasai.agents.<name>`.
  2. Import it here, instantiate it, register a node, wire the edge.
The graph is recompiled on every call to `build_graph()` (cheap).
"""

from __future__ import annotations

from langgraph.graph import END, StateGraph

from canvasai.agents.context_synthesizer import ContextSynthesizer
from canvasai.agents.pedagogical_architect import PedagogicalArchitect
from canvasai.agents.retrieval_agent import RetrievalAgent
from canvasai.agents.schema_enforcer import SchemaEnforcer
from canvasai.agents.curriculum_planner import CurriculumPlanner
from canvasai.graph.state import GraphState

# --- NEW: Conditional Routing Logic ---
def route_after_synth(state: GraphState) -> str:
    """Decides where to send the prompt after context is synthesized."""
    # If the frontend flagged this as a planning request, or the 
    # synthesizer detected a broad topic that needs a roadmap:
    if state.get("is_planning") or "PLAN_REQUIRED" in state.get("intent_statement", ""):
        return "planner"
    return "architect"

def build_graph():
    retrieval = RetrievalAgent()
    synth = ContextSynthesizer()
    architect = PedagogicalArchitect()
    enforcer = SchemaEnforcer()
    planner = CurriculumPlanner() # <--- Instantiate the new agent

    g: StateGraph = StateGraph(GraphState)
    g.add_node("retrieval", retrieval)
    g.add_node("synthesizer", synth)
    g.add_node("planner", planner)
    g.add_node("architect", architect)
    g.add_node("enforcer", enforcer)

    g.set_entry_point("retrieval")
    g.add_edge("retrieval", "synthesizer")
    
    # --- NEW: The crossroads ---
    # We remove the direct edge from synthesizer -> architect
    # and replace it with our conditional routing function.
    g.add_conditional_edges(
        "synthesizer",
        route_after_synth,
        {
            "planner": "planner",
            "architect": "architect"
        }
    )
    
    # Both paths eventually flow into the schema enforcer to ensure 
    # the frontend receives perfectly formatted JSON.
    g.add_edge("planner", "architect")
    g.add_edge("architect", "enforcer")
    g.add_edge("enforcer", END)

    return g.compile()