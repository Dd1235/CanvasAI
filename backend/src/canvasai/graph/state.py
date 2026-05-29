from __future__ import annotations

from typing import Annotated, Any, TypedDict
import operator

def merge_list(a: list, b: list) -> list:
    return a + b

class GraphState(TypedDict, total=False):
    # Inputs
    prompt: str
    user_neuroprofile: str
    chat_history: list[dict[str, str]]
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    trace: Annotated[list[dict[str, Any]], merge_list]
    
    is_planning: bool          # Flags if we are currently building/approving a plan
    lesson_plan: list[str]     # The generated steps
    current_step_index: int    # Which step the user is currently on
    
    # Intermediate NEW PIPELINE VARIABLES
    intent_statement: str
    external_docs: str 
    retrieved_facts: str
    visual_script: str
    ai_response_draft: str
    output_payload: dict[str, Any]