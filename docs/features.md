# Feature Specifications & Rationale

## 🧠 1. Persistent Neuroprofiles (Cognitive Accessibility)
**The Problem:** Traditional interfaces induce cognitive overload for neurodivergent learners. 

**The Solution:** CanvasAI injects a global `neuro_profile` state from the frontend directly into the backend agent instructions.
* **Spatial (Default):** For visual thinkers. Maximizes the canvas, rendering complex algorithms as node-based ecosystems.
* **Micro-Step:** For ADHD/executive dysfunction. Hides the big picture, forcing the LangGraph Architect Agent to output single-action, sequential visual steps.
* **Low-Stim:** For sensory processing differences. Next.js Tailwind configurations strip out background gradients and animations, providing a high-contrast, distraction-free environment.

## ⏳ 2. ChronoSync Branchable Timelines
**The Problem:** Linear chat histories penalize mistakes and discourage exploration.

**The Solution:** A native flexbox vertical timeline (`vertical-timeline.tsx`). Every LangGraph turn generates a semantic 2-9 word title. 
* **Branching:** Users can hover over any past node to safely "fork" the database state into a new session ID to explore tangential questions.
* **Reverting:** Hard-deletes subsequent turns in the backend ledger to safely undo confusion.

## 🕸️ 3. Asynchronous Knowledge Graph (Workforce Signaling)
**The Problem:** Traditional GPA signals fail to capture a candidate's actual problem-solving pathways.

**The Solution:** 
1. The user exports their canvas session.
2. The FastAPI backend fires an event to **Inngest**.
3. Inngest asynchronously runs an extraction pipeline against Gemini to merge new topics and edges into the global graph.
4. Supabase Realtime pushes the updated graph back to the client.

*This creates a verifiable, data-rich constellation of a user's exact capabilities for future employers.*

## 🔁 4. Spaced Repetition (Active Recall)
**The Problem:** Retaining technical jargon is a massive barrier, particularly for those with working memory deficits.

**The Solution:** Native SM-2 algorithm integration. The frontend captures the precise visual canvas state alongside the AI's explanation and compiles it into flashcards. The backend tracks `ease_factor`, `interval_days`, and `repetitions`, ensuring equitable long-term retention.