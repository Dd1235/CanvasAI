import json
from typing import Any
from pydantic import BaseModel
from canvasai.agents.base import AgentBase

# We use structured output here to split the conversational response from the technical script
class ArchitectOutput(BaseModel):
    ai_chat_response: str
    visual_script: str

class PedagogicalArchitect(AgentBase):
    role = "agent_2_architect"
    
    # The ultimate "Brainwashing" prompt
    system_prompt = (
        "You are an expert Whiteboard Teacher and UI State Architect. You have two crucial jobs:\n\n"
        "1. THE TEACHER (ai_chat_response):\n"
        "Write a warm, encouraging, and highly pedagogical explanation for a beginner. "
        "Do NOT just summarize facts; teach the concept using the 'Inside-Out' method. "
        "Explicitly reference the visual diagram you are putting on the canvas (e.g., 'Take a look at the memory block on the board...', 'I've drawn a D-FlipFlop for you, notice how the inputs...').\n\n"
        "2. THE ARCHITECT (visual_script):\n"
        "Design the interactive diagram using STRICTLY our Component Library. Do NOT draw generic flowcharts when explaining low-level mechanics.\n\n"
        "### VISUAL COMPONENT LIBRARY\n"
        "You MUST use the following Node `type` strings. Do not invent new types.\n"
        "- type: \"default\": For high-level concepts, standard flowchart steps, or generic labels. Uses `data.label`.\n"
        "- type: \"memory_block\": For software/memory (RAM, variables, pointers, arrays, linked lists). Uses `data.label` (variable name), `data.address` (e.g., '0x001'), and `data.value`.\n"
        "- type: \"logic_gate\": For hardware/circuits (Flip-flops, Boolean logic). Uses `data.label` (e.g., 'NAND'), `data.inputs` (e.g., 'A=1, B=0'), and `data.outputs` (e.g., 'Out=1').\n\n"
        "### STATE MUTATION RULES\n"
        "If the user asks to change a state (e.g., 'Flip the S switch to 1', 'Update the pointer to 0x8A4'), do NOT spawn new nodes. "
        "Output the EXACT SAME Node ID from the current canvas, but update its `data` fields to reflect the new state."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
            intent = state.get("intent_statement", "")
            facts = state.get("retrieved_facts", "")
            
            # Extract existing nodes so the AI knows exactly what IDs and types to reuse
            current_nodes = state.get("nodes", [])
            simplified_nodes = [
                {"id": n.get("id"), "type": n.get("type"), "data": n.get("data")} 
                for n in current_nodes
            ]
            
            user_input = (
                f"INTENT: {intent}\n\n"
                f"FACTS: {facts}\n\n"
                f"CURRENT CANVAS STATE:\n{json.dumps(simplified_nodes, indent=2)}"
            )
            
            output: ArchitectOutput = await self.llm.structured_complete(
                model_schema=ArchitectOutput,
                system=self.system_prompt,
                user=user_input,
                model="gpt-4o"
            )

            return {
                "ai_response_draft": output.ai_chat_response,
                "visual_script": output.visual_script,
                "trace": self._trace(state, "Designed interactive component layout and drafted teacher response"),
            }