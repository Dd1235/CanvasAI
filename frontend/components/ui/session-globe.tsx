"use client";

import React from "react";
import InfiniteMenu, { MenuItem } from "@/components/ui/infinite-menu"; // Adjust path if needed

// We will replace this with your real database sessions later
const DUMMY_SESSIONS = [
  {
    id: "session_1",
    title: "binary search trees (Branch)",
    turns: 4,
    description: "insert more nodes",
  },
  {
    id: "session_2",
    title: "heaps",
    turns: 3,
    description: "add another node",
  },
  {
    id: "session_3",
    title: "binary search trees",
    turns: 2,
    description: "okay, insert more nodes",
  },
  {
    id: "session_4",
    title: "queue",
    turns: 0,
    description: "No prompt yet",
  }
];

export function SessionGlobe() {
  // Map your session data into the format the 3D menu expects
  const menuItems: MenuItem[] = React.useMemo(() => {
    return DUMMY_SESSIONS.map((session) => ({
      // Generate a unique, abstract geometric shape for each session based on its ID
      image: `https://api.dicebear.com/7.x/shapes/svg?seed=${session.id}&backgroundColor=120F17`,
      title: session.title,
      description: `${session.turns} turns · ${session.description}`,
      link: `/dashboard/canvas/${session.id}`, // Adjust this to your actual canvas route
    }));
  }, []);

  return (
    <div className="relative w-full h-[600px] bg-background rounded-xl overflow-hidden border border-border mt-6">
      <div className="absolute top-6 left-6 z-10">
        <h3 className="text-xl font-semibold text-foreground">Interactive Session History</h3>
        <p className="text-sm text-muted-foreground">Drag the globe to explore past workspaces</p>
      </div>
      
      <InfiniteMenu items={menuItems} scale={0.85} />
    </div>
  );
}