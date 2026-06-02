# CanvasAI

## Overview

CanvasAI is an AI-powered visual learning platform that transforms conversations into interactive, node-based learning experiences. Instead of presenting concepts as plain text, CanvasAI generates dynamic visual explanations that help learners understand complex Computer Science topics through structured, spatial reasoning.

The platform follows an **Inside-Out Learning** approach, starting from low-level concepts and progressively building toward higher-level abstractions. Lessons are personalized through cognitive learning profiles, allowing users to receive explanations tailored to how they process information best.

---

## Key Features

### Interactive Visual Learning

* Real-time node-based lesson generation
* Dynamic concept maps and dependency graphs
* Interactive code walkthroughs and visual explanations
* React Flow powered canvas workspace

### Personalized Learning Experience

CanvasAI supports adaptive learning profiles that modify lesson structure and information density:

* **Spatial** – Visual and relationship-focused explanations
* **Micro-Step** – Highly granular, step-by-step instruction
* **Low-Stim** – Reduced cognitive load and simplified layouts

### Learning Journey Tracking

* Automatic timeline generation for every learning session
* Semantic milestone creation for each learning step
* Session branching for exploring alternative learning paths
* Timeline-based concept revisiting and progression tracking

### Active Recall System

* AI-generated flashcards linked directly to lesson content
* Context-aware review material
* Spaced repetition scheduling using the SM-2 algorithm

---

## Architecture

CanvasAI is built around a real-time AI orchestration pipeline that converts user conversations into visual learning experiences.

### Workflow

1. User interacts with the platform through a chat interface.
2. Messages are streamed to the backend using WebSockets.
3. A multi-agent orchestration system analyzes intent and educational context.
4. The system generates pedagogical content and visual instructions.
5. Structured JSON payloads describing nodes and edges are streamed back.
6. The frontend instantly renders the updated lesson state.

---

## Technology Stack

### Frontend

* Next.js
* React
* React Flow
* Tailwind CSS
* Shadcn UI
* TanStack Query

### Backend

* Python
* FastAPI
* LangGraph
* LangChain
* Gemini
* WebSockets
* Inngest

### Data Layer

* Supabase
* PostgreSQL
* Row Level Security (RLS)

### Learning Algorithms

* SM-2 Spaced Repetition Algorithm
* Cognitive Profile Adaptation
* Graph-Based Lesson Generation

---

## Multi-Agent Learning Pipeline

CanvasAI uses a specialized multi-agent architecture where each agent performs a distinct educational task.

### Intent Agent

Identifies user goals and determines whether a lesson plan is required.

### Context Agent

Synthesizes user intent, lesson history, and canvas state into a condensed learning context.

### Teaching Agent

Generates explanations, instructional content, and visual actions required for the lesson.

### Layout Agent

Transforms educational instructions into structured node and edge data suitable for visual rendering.

This separation allows educational reasoning and visual layout generation to evolve independently.

---

## Session Capabilities

### Persistent Learning Profiles

User learning preferences persist across sessions and influence future lesson generation.

### Timeline Branching

Create alternative learning paths from any previous point without affecting the original session.

### Session Rewind

Return to earlier learning states and rebuild understanding from a chosen point.

### Context-Aware Flashcards

Flashcards are generated from the exact lesson state that produced a concept, preserving visual and conversational context.

---

## Project Goals

CanvasAI aims to make technical education more intuitive by combining:

* Conversational AI
* Visual learning systems
* Adaptive pedagogy
* Real-time interaction
* Long-term knowledge retention

The goal is to move beyond traditional chat-based tutoring and create an environment where learners can see, explore, and interact with concepts as they learn.
