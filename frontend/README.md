# CanvasAI Client (Frontend)

The presentation and hydration layer for CanvasAI. 

## 🛠 Tech Stack
* **Framework:** Next.js 16 (App Router, Server Actions)
* **Visual Canvas:** React Flow (`@xyflow/react`)
* **Styling:** Tailwind CSS v4, Radix UI (Shadcn), Framer Motion
* **State Management:** TanStack React Query (Aggressive in-memory caching)
* **Package Manager:** `pnpm`

## 🚀 Setup & Execution

```bash
# 1. Install dependencies
pnpm install

# 2. Run the development server
pnpm dev

```

## 🏗 Directory Highlights

* `/app`: Next.js 16 file-system routing.
* `/components/canvas`: The core interactive workspace. `canvas-workbench.tsx` is the "God Component" orchestrating resizable panels, WebSocket trace logs, and the React Flow canvas.
* `/components/canvas/timeline`: Contains the highly polished, automated learning journey tracker with floating glassmorphic toolbars.
* `/components/canvas/nodes`: Specialized custom interactive UI nodes (`CodeStepperNode`, `MemoryBlock`, `LogicGate`).
* `/lib/session-cache.ts`: Centralized hydration logic to prefetch and map backend history instantly to avoid loading states.
