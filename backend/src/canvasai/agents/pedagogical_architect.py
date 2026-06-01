import json
from typing import Any, Optional
from pydantic import BaseModel, Field
from canvasai.agents.base import AgentBase

# We use structured output here to split the conversational response from the technical script
class ArchitectOutput(BaseModel):
    step_title: str = Field(description="A 2-9 word summary of the learning journey in this step")
    ai_chat_response: str
    visual_script: str
    advance_step: bool

class PedagogicalArchitect(AgentBase):
    role = "agent_2_architect"
    model_tier = "heavy2"
    
    system_prompt = (
        "You are an expert Whiteboard Teacher. Your goal is to guide a student through a concept "
        "using the 'Inside-Out' method (foundation first, then abstraction).\n\n"
        
        "### PLANNING PHASE RULE (CRITICAL)\n"
        "If 'is_planning' is True and no 'lesson_plan' node exists on the canvas, your priority "
        "is to ADD the 'lesson_plan' node using the steps provided. \n\n"
        
        "### LESSON PLAN PROGRESSION (CRITICAL)\n"
        "You have access to a 'lesson_plan' and the 'current_step_index'.\n"
        "1. If the user explicitly confirms the plan (e.g., 'Looks good', 'Start'), or answers a check-in question correctly, you MUST set `advance_step` to true.\n"
        "2. If `advance_step` is true, teach the NEXT step. If false, teach/clarify the CURRENT step.\n\n"

        "### VISUAL COMPONENT LIBRARY (STRICT)\n"
        "- type: \"default\": High-level labels. data: {label}\n"
        "- type: \"lesson_plan\": The sidebar roadmap. data: {steps: list[str], active_step: int}\n"
        "- type: \"memory_block\": Memory/Pointers. data: {label, address, value}\n"
        "- type: \"logic_gate\": Hardware/Circuits. data: {label, inputs, outputs}\n"
        "- type: \"code_stepper\": Algorithm Tracing. data: {code, language, frames}\n"
        "   * 'frames' is a list: [{'line': int, 'explanation': str, 'variables': dict}]\n"
        "   * Use this when the user needs to see HOW code works line-by-line.\n\n"

        "### STATE MUTATION RULES (STRICT CRUD & EFFICIENCY)\n"
        "Your visual_script must act as a precise set of diff instructions for the canvas. You MUST prioritize modifying existing nodes over creating new ones to prevent visual clutter.\n"
        "- UPDATE (PRIORITY 1): If a node representing a concept, pointer, or variable already exists, you MUST reuse its ID and change its data (e.g., 'UPDATE node_3 value to 10'). NEVER spawn a new node just to show a state change.\n"
        "- DELETE (PRIORITY 2): Actively garbage-collect the canvas. Remove specific nodes by ID ONLY when they are no longer needed for the current step, keeping the board clean and focused.\n"
        "- ADD (PRIORITY 3): Only create new nodes when introducing a genuinely new visual element that cannot be represented by updating an existing one.\n"
        "- CLEAR: Wipe the canvas (except the lesson plan) ONLY when transitioning to a completely different macro-topic.\n"
        "IMPLICIT RETENTION: You do not need to list nodes that are staying the same. They will be kept automatically. Only output the changes.\n\n"
        
        "### OUTPUT FORMAT\n"
        "1. ai_chat_response: Encouraging, reference-heavy teaching referencing the visual diagram you are putting on the canvas (e.g., 'Take a look at the memory block on the board...', 'I've drawn a D-FlipFlop for you, notice how the inputs...').\n"
        "2. visual_script: A concise list of CRUD commands (ADD, UPDATE, DELETE, CLEAR). e.g., 'UPDATE node_1 value to 10\nADD code_stepper for bubble sort\nADD memory_block 5\nDELETE node_12'.\n"
        "3. advance_step: true/false based on user readiness."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        intent = state.get("intent_statement", "")
        facts = state.get("retrieved_facts", "")
        plan = state.get("lesson_plan", [])
        step_idx = state.get("current_step_index", 0)
        is_planning = state.get("is_planning", False)
        user_neuroprofile = state.get("user_neuroprofile", "Spatial") # Fetch profile
        
        # Determine the current "Mission"
        current_mission = f"Teaching Step: {plan[step_idx]}" if plan and step_idx < len(plan) else f"Direct Query: {intent}"
        
        current_nodes = state.get("nodes", [])
        simplified_nodes = [{"id": n.get("id"), "type": n.get("type"), "data": n.get("data")} for n in current_nodes]
        
        # --- NEW: Dynamic Neuroprofile Instructions ---
        profile_rules = ""
        if user_neuroprofile == "Micro-step":
            profile_rules = "NEUROPROFILE 'Micro-step': Minimize visual clutter. Favor using a single 'code_stepper' node. Break complex ideas into linear, single-line executions. Delete older redundant nodes aggressively."
        elif user_neuroprofile == "Low-stim":
            profile_rules = "NEUROPROFILE 'Low-stim': Keep the canvas sparse and highly text-focused. Avoid excessive UI components. Favor single 'default' nodes with clear markdown explanations."
        else:
            profile_rules = "NEUROPROFILE 'Spatial': Maximize visual architecture. Break components into separate 'memory_block' and 'logic_gate' nodes to show structural relationships."

        user_input = (
            f"ACTIVE NEUROPROFILE: {profile_rules}\n\n"
            f"IS_PLANNING_PHASE: {is_planning}\n"
            f"CURRENT MISSION: {current_mission}\n\n"
            f"FACTS TO TEACH: {facts}\n\n"
            f"LESSON_PLAN_STEPS: {json.dumps(plan)}\n" # Gives Architect the data to draw the sidebar
            f"CURRENT CANVAS STATE:\n{json.dumps(simplified_nodes, indent=2)}"
        )
        
        output: ArchitectOutput = await self.llm.structured_complete(
            model_schema=ArchitectOutput,
            system=self.system_prompt,
            user=user_input,
            model=self.model_name
        )

        # --- THE PROGRESSION LOGIC ---
        new_step_idx = step_idx
        if output.advance_step and plan and step_idx < len(plan) - 1:
            new_step_idx += 1
            
        # We append a specific instruction to the visual script so the Enforcer
        # knows to visually highlight the new step on the Lesson Plan sidebar!
        final_script = output.visual_script
        
        # If the AI advanced the step, we force a visual update of the sidebar
        if output.advance_step:
            final_script += f"\nUPDATE node with type 'lesson_plan' to highlight active_step: {new_step_idx}"

        return {
            "step_title": output.step_title,
            "ai_response_draft": output.ai_chat_response,
            "visual_script": final_script,
            "current_step_index": new_step_idx, # Mutates the LangGraph state
            "is_planning": False, # Reset planning flag so we don't redraw the plan every turn
            "trace": self._trace(state, f"Advanced to step {new_step_idx}" if output.advance_step else "Refined current step"),
        }