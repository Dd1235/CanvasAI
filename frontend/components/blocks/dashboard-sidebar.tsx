"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, FileText, LayoutDashboard, MessageSquare, Network, Sparkles, Workflow } from "lucide-react";

import { listCanvasSessions } from "@/lib/canvasai-api";
import type { SessionSummary } from "@/lib/canvasai-types";
import { DEMO_SESSIONS } from "@/lib/mock-data";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/canvas/demo", label: "Canvas", icon: Workflow },
  { href: "/dashboard/knowledge", label: "Knowledge Graph", icon: Network },
  { href: "/dashboard/chat", label: "Chat", icon: MessageSquare },
  { href: "/dashboard/recall", label: "Active Recall", icon: BookOpenCheck },
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
];

export function DashboardSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const [sessions, setSessions] = React.useState<SessionSummary[]>([]);

  React.useEffect(() => {
    listCanvasSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [pathname]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 px-2 py-1.5 font-semibold">
          <Sparkles className="size-4" />
          <span className="group-data-[collapsible=icon]:hidden">CanvasAI</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigate</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href ||
                  (href === "/dashboard/canvas/demo" && pathname.startsWith("/dashboard/canvas")) ||
                  (href !== "/dashboard" && pathname.startsWith(href));
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={label}>
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
          <SidebarGroupLabel>Recent sessions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {(sessions.length ? sessions : DEMO_SESSIONS).map((session) => {
                const label = "topic" in session ? session.topic : session.title;
                return (
                  <SidebarMenuItem key={session.id}>
                    <SidebarMenuButton asChild tooltip={label}>
                      <Link href={`/dashboard/canvas/${session.id}`}>
                      <Workflow />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter />
      <SidebarRail />
    </Sidebar>
  );
}
