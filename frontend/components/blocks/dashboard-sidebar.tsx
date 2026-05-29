"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheck,
  FileText,
  LayoutDashboard,
  Network,
  Plus,
  Sparkles,
  Workflow,
} from "lucide-react";

import { listCanvasSessions } from "@/lib/canvasai-api";
import type { SessionSummary } from "@/lib/canvasai-types";
import {
  prefetchSessionHistory,
  prefetchTopSessions,
  SESSIONS_KEY,
  useQuery,
} from "@/lib/session-cache";
import { NewSessionDialog } from "@/components/dashboard/new-session-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const NAV: {
  href: string;
  label: string;
  tooltip: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    href: "/dashboard",
    label: "Overview",
    tooltip: "Workspace overview and recent activity",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/knowledge",
    label: "Knowledge Graph",
    tooltip: "Your topics, mastery, and review prompts",
    icon: Network,
  },
  {
    href: "/dashboard/recall",
    label: "Active Recall",
    tooltip: "Spaced-repetition review cards",
    icon: BookOpenCheck,
  },
  {
    href: "/dashboard/documents",
    label: "Documents",
    tooltip: "Grounding sources for retrieval",
    icon: FileText,
  },
];

export function DashboardSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const sessionsQuery = useQuery<SessionSummary[]>(
    SESSIONS_KEY,
    listCanvasSessions,
    { staleTime: 15_000 },
  );
  const sessions = React.useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);

  // Re-fetch the session list whenever the user navigates (cheap, deduped).
  // The actual fetch is debounced by the cache's stale check.
  React.useEffect(() => {
    void sessionsQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Warm canvas history for the most recent sessions so opening them is
  // instant. Re-runs whenever the list changes.
  React.useEffect(() => {
    if (sessions.length) void prefetchTopSessions(sessions, 3);
  }, [sessions]);

  const canvasActive = pathname.startsWith("/dashboard/canvas");
  const currentCanvasId = canvasActive ? pathname.split("/").pop() : undefined;
  const canvasSession =
    sessions.find((session) => session.id === currentCanvasId) ?? sessions[0];

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link
          href="/"
          className="flex items-center gap-2 px-2 py-1.5 font-semibold"
          title="Back to landing page"
        >
          <Sparkles className="size-4" />
          <span className="group-data-[collapsible=icon]:hidden">CanvasAI</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigate</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                {canvasSession ? (
                  <SidebarMenuButton
                    asChild
                    isActive={canvasActive}
                    tooltip={`Open ${canvasSession.title}`}
                    onMouseEnter={() => void prefetchSessionHistory(canvasSession.id)}
                    onFocus={() => void prefetchSessionHistory(canvasSession.id)}
                  >
                    <Link href={`/dashboard/canvas/${canvasSession.id}`}>
                      <Workflow />
                      <span>Canvas</span>
                    </Link>
                  </SidebarMenuButton>
                ) : (
                  <NewSessionDialog
                    onCreated={() => void sessionsQuery.refetch()}
                    trigger={
                      <SidebarMenuButton
                        isActive={canvasActive}
                        title="Start a canvas session"
                      >
                        <Workflow />
                        <span>Canvas</span>
                      </SidebarMenuButton>
                    }
                  />
                )}
              </SidebarMenuItem>
              {NAV.map(({ href, label, tooltip, icon: Icon }) => {
                const active =
                  pathname === href ||
                  (href !== "/dashboard" && pathname.startsWith(href));
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={tooltip}>
                      <Link href={href}>
                        <Icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Sessions</SidebarGroupLabel>
          <NewSessionDialog
            onCreated={() => void sessionsQuery.refetch()}
            trigger={
              <SidebarGroupAction title="Start a new canvas session">
                <Plus />
                <span className="sr-only">New session</span>
              </SidebarGroupAction>
            }
          />
          <SidebarGroupContent>
            <SidebarMenu>
              {sessions.length === 0 ? (
                <p className="text-muted-foreground px-3 py-2 text-xs group-data-[collapsible=icon]:hidden">
                  {sessionsQuery.isLoading ? "Loading…" : "No sessions yet."}
                </p>
              ) : (
                sessions.map((session) => (
                  <SidebarMenuItem key={session.id}>
                    <SidebarMenuButton
                      asChild
                      tooltip={`Open ${session.title}`}
                      onMouseEnter={() => void prefetchSessionHistory(session.id)}
                      onFocus={() => void prefetchSessionHistory(session.id)}
                    >
                      <Link href={`/dashboard/canvas/${session.id}`}>
                        <Workflow />
                        <span>{session.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter />
      <SidebarRail />
    </Sidebar>
  );
}
