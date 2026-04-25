"""Compose the 4-agent CanvasAI pipeline as a LangGraph.

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
from canvasai.graph.state import GraphState


def build_graph():
    retrieval = RetrievalAgent()
    synth = ContextSynthesizer()
    architect = PedagogicalArchitect()
    enforcer = SchemaEnforcer()

    g: StateGraph = StateGraph(GraphState)
    g.add_node("retrieval", retrieval)
    g.add_node("synthesizer", synth)
    g.add_node("architect", architect)
    g.add_node("enforcer", enforcer)

    g.set_entry_point("retrieval")
    g.add_edge("retrieval", "synthesizer")
    g.add_edge("synthesizer", "architect")
    g.add_edge("architect", "enforcer")
    g.add_edge("enforcer", END)

    return g.compile()
