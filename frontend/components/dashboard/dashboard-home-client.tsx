"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Database,
  FileText,
  History,
  MessageSquare,
  Network,
  Sparkles,
  Workflow,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewSessionDialog } from "@/components/dashboard/new-session-dialog";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getActiveRecallStats,
  listCanvasSessions,
} from "@/lib/canvasai-api";
import {
  prefetchTopSessions,
  SESSIONS_KEY,
  useQuery,
} from "@/lib/session-cache";
import type {
  ActiveRecallStats,
  SessionSummary,
} from "@/lib/canvasai-types";

export function DashboardHomeClient() {
  const sessionsQuery = useQuery<SessionSummary[]>(
    SESSIONS_KEY,
    listCanvasSessions,
    { staleTime: 15_000 },
  );
  const sessions = React.useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const [recallStats, setRecallStats] = React.useState<ActiveRecallStats | null>(null);

  React.useEffect(() => {
    getActiveRecallStats()
      .then(setRecallStats)
      .catch(() => setRecallStats(null));
  }, []);

  // Warm the canvas-history cache for the top 3 recent sessions so opening
  // them feels instant. Re-runs when the session list refreshes.
  React.useEffect(() => {
    if (sessions.length) void prefetchTopSessions(sessions, 3);
  }, [sessions]);

  const latestSession = sessions[0];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary">CanvasAI workspace</Badge>
            <h1 className="text-foreground text-3xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Continue a visual tutoring session, try the learning chat, or review cards
              generated from prior canvas turns.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="outline">
                  <Link href="/dashboard/knowledge">
                    <Network className="size-4" />
                    Graph
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open the knowledge graph</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="outline">
                  <Link href="/dashboard/chat">
                    <MessageSquare className="size-4" />
                    Chat
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Talk to the tutor in plain chat</TooltipContent>
            </Tooltip>
            {latestSession ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild variant="outline">
                    <Link href={`/dashboard/canvas/${latestSession.id}`}>
                      Resume latest
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reopen your most recent canvas</TooltipContent>
              </Tooltip>
            ) : null}
            <NewSessionDialog />
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            icon={Workflow}
            label="Backend sessions"
            value={sessions.length.toString()}
            hint="Canvas sessions stored on the backend for your account."
          />
          <MetricCard
            icon={Database}
            label="Recall cards"
            value={(recallStats?.total_cards ?? 0).toString()}
            hint="Total spaced-repetition cards built from your canvases."
          />
          <MetricCard
            icon={History}
            label="Due recall"
            value={(recallStats?.due_cards ?? 0).toString()}
            hint="Recall cards scheduled for review today."
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <div className="bg-secondary text-secondary-foreground mb-2 inline-flex size-9 items-center justify-center rounded-md">
                <Sparkles className="size-4" />
              </div>
              <CardTitle>{latestSession?.title ?? "Start your first canvas"}</CardTitle>
              <CardDescription>
                {latestSession
                  ? `${latestSession.turn_count} backend turns tracked.`
                  : "Create a new session below to populate your canvas."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat label="Mode" value="LangGraph canvas" />
                <MiniStat label="Recall cards" value={(recallStats?.total_cards ?? 0).toString()} />
                <MiniStat
                  label="Updated"
                  value={
                    latestSession
                      ? new Date(latestSession.updated_at).toLocaleTimeString()
                      : "—"
                  }
                />
              </div>
            </CardContent>
            <CardFooter>
              {latestSession ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild>
                      <Link href={`/dashboard/canvas/${latestSession.id}`}>
                        Open canvas
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Resume this canvas session</TooltipContent>
                </Tooltip>
              ) : (
                <NewSessionDialog />
              )}
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <div className="bg-secondary text-secondary-foreground mb-2 inline-flex size-9 items-center justify-center rounded-md">
                <FileText className="size-4" />
              </div>
              <CardTitle>Grounding library</CardTitle>
              <CardDescription>
                Stage sources to ground retrieval and citations across canvas turns.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Upload PDFs, markdown notes, or API references to make them available to the
                retrieval agent.
              </p>
            </CardContent>
            <CardFooter>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/documents">Browse documents</Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Manage uploaded grounding sources</TooltipContent>
              </Tooltip>
            </CardFooter>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle>Recent sessions</CardTitle>
              <CardDescription>
                Backend sessions appear here after a canvas turn streams successfully.
              </CardDescription>
            </div>
            <CardAction>
              <NewSessionDialog />
            </CardAction>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                {sessionsQuery.isLoading
                  ? "Loading sessions…"
                  : "No sessions yet. Start one above."}
              </div>
            ) : (
              <ul className="divide-border divide-y">
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <span className="font-medium">{session.title}</span>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {session.turn_count} turns · {session.last_prompt ?? "No prompt yet"}
                      </p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="self-start md:self-auto"
                        >
                          <Link href={`/dashboard/canvas/${session.id}`}>Open</Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Open this canvas session</TooltipContent>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  const card = (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="mt-2 text-2xl">{value}</CardTitle>
        </div>
        <CardAction>
          <div className="bg-secondary text-secondary-foreground flex size-9 items-center justify-center rounded-md">
            <Icon className="size-4" />
          </div>
        </CardAction>
      </CardHeader>
    </Card>
  );
  if (!hint) return card;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-md border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}
