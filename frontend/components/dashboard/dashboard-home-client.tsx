"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Database,
  FileText,
  History,
  Network,
  Sparkles,
  Workflow,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import BorderGlow from "@/components/ui/border-glow";
import LogoLoop from "@/components/ui/logo-loop";
import { useRouter } from "next/navigation";
import DomeGallery from "@/components/ui/dome-gallery";
import { cn } from "@/lib/utils";
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
  const menuItems = React.useMemo(() => {
    return sessions.map((session) => ({
      // Generate a unique geometric shape based on the session ID
      image: `https://api.dicebear.com/7.x/shapes/svg?seed=${session.id}&backgroundColor=120F17`,
      title: session.title,
      description: `${session.turn_count} turns · ${session.last_prompt ?? "No prompt yet"}`,
      link: `/dashboard/canvas/${session.id}`,
    }));
  }, [sessions]);
  const metricItems = React.useMemo(() => [
    {
      node: (
        <div className="w-[320px] h-[130px]">
          <MetricCard
            icon={Workflow}
            label="Backend sessions"
            value={sessions.length.toString()}
            hint="Canvas sessions stored on the backend for your account."
          />
        </div>
      )
    },
    {
      node: (
        <div className="w-[320px] h-[130px]">
          <MetricCard
            icon={Database}
            label="Recall cards"
            value={(recallStats?.total_cards ?? 0).toString()}
            hint="Total spaced-repetition cards built from your canvases."
          />
        </div>
      )
    },
    {
      node: (
        <div className="w-[320px] h-[130px]">
          <MetricCard
            icon={History}
            label="Due recall"
            value={(recallStats?.due_cards ?? 0).toString()}
            hint="Recall cards scheduled for review today."
          />
        </div>
      )
    }
  ], [sessions.length, recallStats]);

  const router = useRouter(); // <--- Make sure this is added inside the component!

// Track which card is currently expanded in the Dome
  // Track which card is currently expanded in the Dome
  // Track the exact INSTANCE that was clicked
  const [expandedInstanceId, setExpandedInstanceId] = React.useState<string | null>(null);

  // Map sessions to premium Dome Gallery cards
  const domeItems = React.useMemo(() => {
    return sessions.map((session) => {
      return {
        id: session.id,
        // The gallery passes back the specific instanceId that was clicked
        onClick: (instanceId: string) => setExpandedInstanceId(instanceId),
        
        // Content is now a function! The gallery tells us if this exact card is the expanded one.
        content: (isExpanded: boolean) => (
          <div
            className={cn(
              "flex flex-col justify-between w-full min-h-full h-fit text-left transition-all duration-[400ms] ease-out outline-none",
              isExpanded
                ? "p-6 rounded-2xl bg-card shadow-[0_20px_60px_rgba(0,0,0,0.6)] border-2 border-primary z-50 cursor-default"
                : "p-5 rounded-2xl bg-card/90 shadow-lg border border-white/10 hover:border-white/20 hover:bg-card z-10 cursor-pointer"
            )}
            style={{
              transform: isExpanded ? "translateZ(100px) scale(1.15)" : "translateZ(0px) scale(var(--dyn-scale, 1))",
            }}
          >
            <div className="space-y-3">
              <h3 className={cn(
                "font-bold text-foreground transition-all duration-300",
                isExpanded ? "text-2xl line-clamp-none leading-tight" : "text-xl line-clamp-3 leading-snug"
              )}>
                {session.title || "Untitled Session"}
              </h3>
              
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-semibold text-xs px-2.5 py-0.5">
                  {session.turn_count} turns
                </Badge>
              </div>
              
              <div className={cn(
                "overflow-hidden transition-all duration-[400ms] space-y-1.5",
                isExpanded ? "max-h-24 opacity-100 mt-4" : "max-h-0 opacity-0 mt-0"
              )}>
                <p className="text-xs font-medium text-muted-foreground">
                  Updated {new Date(session.updated_at).toLocaleDateString()}
                </p>
                <p className="text-xs font-medium text-muted-foreground/60">
                  Created {new Date(session.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className={cn(
              "flex justify-end transition-all duration-[400ms]",
              isExpanded ? "mt-6 opacity-100 pointer-events-auto" : "mt-0 opacity-0 pointer-events-none"
            )}>
              {isExpanded && (
                <Button
                  title="Continue Session"
                  size="icon"
                  className="bg-[#0A66C2] text-white hover:bg-[#004182] hover:shadow-[0_0_15px_rgba(10,102,194,0.4)] border-0 rounded-full h-10 w-10 shrink-0 transition-transform hover:scale-110"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/dashboard/canvas/${session.id}`);
                  }}
                >
                  <ArrowRight className="size-5" />
                </Button>
              )}
            </div>
          </div>
        )
      };
    });
  }, [sessions, router]);

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
              Continue a visual tutoring session, jump into your knowledge graph, or review
              cards generated from prior canvas turns.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="outline" className="hover:text-[#0A66C2] hover:border-[#0A66C2] hover:bg-[#0A66C2]/10 focus-visible:ring-[#0A66C2] transition-all duration-300">
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
                <Button asChild variant="outline" className="hover:text-[#0A66C2] hover:border-[#0A66C2] hover:bg-[#0A66C2]/10 focus-visible:ring-[#0A66C2] transition-all duration-300">
                  <Link href="/dashboard/recall">
                    <BookOpenCheck className="size-4" />
                    Recall
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Review due spaced-repetition cards</TooltipContent>
            </Tooltip>
            {latestSession ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild variant="outline" className="hover:text-[#0A66C2] hover:border-[#0A66C2] hover:bg-[#0A66C2]/10 focus-visible:ring-[#0A66C2] transition-all duration-300">
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

        {/* SCROLLING METRICS LOOP */}
        <div className="w-full relative py-2">
          <LogoLoop
            logos={metricItems}
            speed={40}
            direction="left"
            logoHeight={130}
            gap={24}
            hoverSpeed={0}
            fadeOut={false}
            // 1. REMOVED fadeOutColor so it auto-switches based on light/dark mode!
            // 2. ADDED overflow-hidden to kill that vertical scrollbar
            className="overflow-hidden" 
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          
          {/* LATEST SESSION CARD */}
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="flex flex-col"
          >
            <Card className="h-full flex-1 w-full bg-card border border-black/10 dark:border-white/10 shadow-sm flex flex-col">
              <CardHeader>
                <div className="bg-[#0A66C2]/10 text-[#0A66C2] dark:bg-[#0A66C2]/20 dark:text-blue-400 mb-2 inline-flex size-9 items-center justify-center rounded-md">
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
              <CardFooter className="mt-auto">
                {latestSession ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button asChild className="bg-[#0A66C2] text-white hover:bg-[#004182] hover:shadow-[0_0_20px_rgba(10,102,194,0.4)] focus-visible:ring-2 focus-visible:ring-[#0A66C2] focus-visible:outline-none border-0 transition-all duration-300">
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
          </motion.div>

          {/* GROUNDING LIBRARY CARD */}
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="flex flex-col"
          >
            <Card className="h-full flex-1 w-full bg-card border border-black/10 dark:border-white/10 shadow-sm flex flex-col">
              <CardHeader>
                <div className="bg-[#0A66C2]/10 text-[#0A66C2] dark:bg-[#0A66C2]/20 dark:text-blue-400 mb-2 inline-flex size-9 items-center justify-center rounded-md">
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
              <CardFooter className="mt-auto">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" asChild className="hover:text-[#0A66C2] hover:border-[#0A66C2] hover:bg-[#0A66C2]/10 focus-visible:ring-[#0A66C2] transition-all duration-300">
                      <Link href="/dashboard/documents">Browse documents</Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Manage uploaded grounding sources</TooltipContent>
                </Tooltip>
              </CardFooter>
            </Card>
          </motion.div>

        </div>

        {/* INTERACTIVE SESSION HISTORY CARD */}
        <Card className="w-full mt-4 overflow-hidden bg-card border border-black/10 dark:border-white/10 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 relative z-10 bg-background/40 backdrop-blur-md border-b border-black/5 dark:border-white/10">
            <div className="space-y-1">
              <CardTitle>Interactive Session History</CardTitle>
              <CardDescription>
                Drag the globe to explore and resume your past canvas workspaces.
              </CardDescription>
            </div>
            <CardAction>
              <NewSessionDialog />
            </CardAction>
          </CardHeader>
          
          <CardContent className="p-0">
          {sessions.length === 0 ? (
            <div className="text-muted-foreground py-16 text-center text-sm">
              {sessionsQuery.isLoading
                ? "Loading sessions…"
                : "No sessions yet. Start one above."}
            </div>
          ) : (
            <div 
              className="relative w-full h-[500px] bg-transparent overflow-hidden rounded-b-xl"
              onMouseLeave={() => setExpandedInstanceId(null)} 
            >
              <DomeGallery
                items={domeItems}
                expandedInstanceId={expandedInstanceId} 
                fit={0.8}
                minRadius={450} 
                segments={24} 
                dragDampening={2}
                autoRotate={true}
                autoRotateSpeed={0.06}
                isPaused={!!expandedInstanceId} 
                onBackgroundClick={() => setExpandedInstanceId(null)}
              />
            </div>
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
    <motion.div
      whileHover={{ scale: 1.04, y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="h-full"
    >
      <Card className="h-full flex-1 w-full bg-card border border-black/10 dark:border-white/10 shadow-sm">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardDescription className="text-muted-foreground font-medium">{label}</CardDescription>
            <CardTitle className="mt-2 text-3xl font-semibold text-[#0A66C2] dark:text-white">{value}</CardTitle>
          </div>
          <CardAction>
            <div className="bg-[#0A66C2]/10 text-[#0A66C2] dark:bg-[#0A66C2]/20 dark:text-blue-400 flex size-9 items-center justify-center rounded-md">
              <Icon className="size-4" />
            </div>
          </CardAction>
        </CardHeader>
      </Card>
    </motion.div>
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
