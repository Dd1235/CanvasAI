"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Database, FileText, History, MessageSquare, Network, Sparkles, Workflow } from "lucide-react";

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
import { getActiveRecallStats, listCanvasSessions } from "@/lib/canvasai-api";
import type {
  ActiveRecallStats,
  DemoDocument,
  DemoSession,
  SessionSummary,
} from "@/lib/canvasai-types";

type Props = {
  initialSessions: DemoSession[];
  initialDocuments: DemoDocument[];
};

export function DashboardHomeClient({ initialSessions, initialDocuments }: Props) {
  const [sessions, setSessions] = React.useState<SessionSummary[]>([]);
  const [recallStats, setRecallStats] = React.useState<ActiveRecallStats | null>(null);

  React.useEffect(() => {
    listCanvasSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
    getActiveRecallStats()
      .then(setRecallStats)
      .catch(() => setRecallStats(null));
  }, []);

  const latestSession = sessions[0];
  const fallbackSession = initialSessions[0];
  const indexedDocuments = initialDocuments.filter((document) => document.status === "Indexed").length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary">CanvasAI workspace</Badge>
          <h1 className="text-foreground text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground max-w-2xl">
            Continue a visual tutoring session, try the learning chat, or review cards generated
            from prior canvas turns.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/knowledge">
              <Network className="size-4" />
              Graph
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/chat">
              <MessageSquare className="size-4" />
              Chat
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dashboard/canvas/${latestSession?.id ?? fallbackSession.id}`}>
              Resume latest
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <NewSessionDialog />
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={Workflow} label="Backend sessions" value={sessions.length.toString()} />
        <MetricCard icon={Database} label="Indexed sources" value={indexedDocuments.toString()} />
        <MetricCard icon={History} label="Due recall" value={(recallStats?.due_cards ?? 0).toString()} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="bg-secondary text-secondary-foreground mb-2 inline-flex size-9 items-center justify-center rounded-md">
              <Sparkles className="size-4" />
            </div>
            <CardTitle>{latestSession?.title ?? "Demo canvas"}</CardTitle>
            <CardDescription>
              {latestSession
                ? `${latestSession.turn_count} backend turns tracked.`
                : "Start a backend-backed canvas turn to populate real history."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat label="Mode" value="LangGraph canvas" />
              <MiniStat label="Recall cards" value={(recallStats?.total_cards ?? 0).toString()} />
              <MiniStat
                label="Updated"
                value={latestSession ? new Date(latestSession.updated_at).toLocaleTimeString() : "local mock"}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link href={`/dashboard/canvas/${latestSession?.id ?? fallbackSession.id}`}>
                Open canvas
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <div className="bg-secondary text-secondary-foreground mb-2 inline-flex size-9 items-center justify-center rounded-md">
              <FileText className="size-4" />
            </div>
            <CardTitle>Grounding library</CardTitle>
            <CardDescription>
              {initialDocuments.length} staged sources across PDFs, lab notes, and API references.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {initialDocuments.slice(0, 2).map((document) => (
                <li key={document.id} className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm">{document.title}</span>
                  <Badge variant={document.status === "Indexed" ? "secondary" : "outline"}>
                    {document.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" asChild>
              <Link href="/dashboard/documents">Browse documents</Link>
            </Button>
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
          <ul className="divide-border divide-y">
            {(sessions.length ? sessions : initialSessions).map((session) => {
              const id = "topic" in session ? session.id : session.id;
              const title = "topic" in session ? session.topic : session.title;
              const subtitle =
                "topic" in session
                  ? `${session.duration} · ${session.profile} · ${session.updatedAt}`
                  : `${session.turn_count} turns · ${session.last_prompt ?? "No prompt yet"}`;
              return (
                <li key={id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <span className="font-medium">{title}</span>
                    <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="self-start md:self-auto">
                    <Link href={`/dashboard/canvas/${id}`}>Open</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
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
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-md border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}
