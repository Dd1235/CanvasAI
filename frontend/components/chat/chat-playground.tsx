"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Brain, Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  createChatSession,
  getChatMessages,
  sendChatMessage,
} from "@/lib/canvasai-api";
import type { ChatMessage, VisualizationTool } from "@/lib/canvasai-types";
import { cn } from "@/lib/utils";

const TOOLS: Array<{ id: VisualizationTool; label: string; description: string }> = [
  { id: "socratic", label: "Socratic", description: "Questions first" },
  { id: "steps", label: "Steps", description: "Micro-step trace" },
  { id: "diagram", label: "Diagram", description: "Text sketch" },
  { id: "analogy", label: "Analogy", description: "Intuition bridge" },
];

export function ChatPlayground() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") ?? "Explain AVL rotations visually.";
  const requestedTool = searchParams.get("tool") as VisualizationTool | null;
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [message, setMessage] = React.useState(initialPrompt);
  const [tool, setTool] = React.useState<VisualizationTool>(
    requestedTool && TOOLS.some((item) => item.id === requestedTool) ? requestedTool : "diagram",
  );
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    createChatSession("Learning chat")
      .then((session) => {
        setSessionId(session.id);
        return getChatMessages(session.id);
      })
      .then(setMessages)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Chat backend unavailable.");
      });
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionId || !message.trim()) return;
    const nextMessage = message.trim();
    setMessage("");
    setLoading(true);
    try {
      const response = await sendChatMessage(sessionId, nextMessage, tool);
      setMessages((current) => [...current, response.user_message, response.assistant_message]);
    } catch (error) {
      setMessage(nextMessage);
      toast.error(error instanceof Error ? error.message : "Chat request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid h-[calc(100svh-3.5rem)] w-full max-w-6xl gap-4 p-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="size-4" />
              Chat Tools
            </CardTitle>
            <CardDescription>Pick how the model frames the answer.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {TOOLS.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant={tool === item.id ? "default" : "outline"}
                className="h-auto justify-start py-3"
                onClick={() => setTool(item.id)}
              >
                <span className="text-left">
                  <span className="block">{item.label}</span>
                  <span className="text-xs opacity-70">{item.description}</span>
                </span>
              </Button>
            ))}
          </CardContent>
        </Card>
      </aside>

      <section className="flex min-h-0 flex-col rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              <MessageSquare className="size-5" />
              Learning Chat
            </h1>
            <p className="text-muted-foreground text-sm">
              Separate backend chat session for trying the LLM without touching the canvas.
            </p>
          </div>
          <Badge variant="secondary">{sessionId ? "live API" : "connecting"}</Badge>
        </div>

        <ScrollArea className="min-h-0 flex-1 p-4">
          <div className="space-y-4 pr-3">
            {!messages.length ? (
              <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
                Ask for an explanation, analogy, or diagram sketch.
              </div>
            ) : null}
            {messages.map((item, index) => (
              <div
                key={`${item.created_at}-${index}`}
                className={cn(
                  "max-w-[85%] rounded-lg border p-3 text-sm",
                  item.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-background",
                )}
              >
                <p className="whitespace-pre-wrap">{item.content}</p>
              </div>
            ))}
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Thinking
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <form onSubmit={submit} className="flex gap-2 border-t p-4">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-12 flex-1 resize-none rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
            placeholder="Ask a learning question"
          />
          <Button type="submit" disabled={!sessionId || loading || !message.trim()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send
          </Button>
        </form>
      </section>
    </div>
  );
}
