import json
from typing import Any
from pydantic import BaseModel
from canvasai.agents.base import AgentBase

class PlannerOutput(BaseModel):
    lesson_plan: list[str]
    ai_response: str

class CurriculumPlanner(AgentBase):
    role = "agent_planner"
    model_tier = "heavy"
    system_prompt = (
        "You are a Curriculum Architect. Your goal is to break down complex topics into "
        "a 4-5 step 'Inside-Out' learning roadmap.\n\n"
        "### GUIDELINES\n"
        "- Step 1 MUST always establish the lowest-level foundation or first principles of the topic "
        "(e.g., if Computer Science, start with memory/hardware; if Biology, start with cellular/chemical levels; if Economics, start with basic human incentives).\n"
        "- Subsequent steps should progressively build up to high-level systems, algorithms, or macro-concepts.\n"
        "- The 'ai_response' should ask the user if this roadmap looks good or if they want to skip prerequisites.\n\n"
        "Output a list of strings for the roadmap steps."
    )

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        intent = state.get("intent_statement", "")
        facts = state.get("retrieved_facts", "")
        
        user_input = f"TOPIC INTENT: {intent}\nFACTS: {facts}"
        
        # We use structured output to get a clean list
        output: PlannerOutput = await self.llm.structured_complete(
            model_schema=PlannerOutput,
            system=self.system_prompt,
            user=user_input,
            model=self.model_name
        )

        # We create a 'pseudo-script' for the enforcer to turn into a UI
        visual_script = f"CREATE_NODE type:lesson_plan steps:{json.dumps(output.lesson_plan)}"

        return {
            "lesson_plan": output.lesson_plan,
            "ai_response_draft": output.ai_response,
            "visual_script": visual_script,
            "is_planning": True,
            "trace": self._trace(state, "Generated a step-by-step lesson plan"),
        }