from __future__ import annotations

from typing import Any, TypedDict


class GraphState(TypedDict, total=False):
    # Inputs
    prompt: str
    chat_history: list[dict[str, Any]]  # NEW: For conversation context
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]

    # Intermediate
    retrieved_context: list[str]
    technical_directive: str
    visual_script: str

    # Output
    output_payload: dict[str, list[dict[str, Any]]]

    # Streaming trace (one entry per agent, for WS status frames)
    trace: list[dict[str, Any]]