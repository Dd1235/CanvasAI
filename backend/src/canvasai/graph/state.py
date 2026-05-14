from __future__ import annotations

from typing import Annotated, Any, TypedDict
import operator

def merge_list(a: list, b: list) -> list:
    return a + b

class GraphState(TypedDict, total=False):
    # Inputs
    prompt: str
    chat_history: list[dict[str, str]]
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    trace: Annotated[list[dict[str, Any]], merge_list]
    
    # Intermediate NEW PIPELINE VARIABLES
    intent_statement: str
    external_docs: str  # <--- New: Holds text from uploaded PDFs, links, or text snippets
    retrieved_facts: str
    retrieved_facts: str
    visual_script: str
    ai_response_draft: str
    output_payload: dict[str, Any]