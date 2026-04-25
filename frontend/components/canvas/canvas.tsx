"use client";

import * as React from "react";
import {
  addEdge,
  Background,
  type Connection,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import type { CanvasEdge, CanvasNode } from "@/lib/canvasai-types";
import { cn } from "@/lib/utils";

type Props = {
  initialNodes?: CanvasNode[];
  initialEdges?: CanvasEdge[];
  className?: string;
};

export function Canvas({ initialNodes = [], initialEdges = [], className }: Props) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = React.useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) =>
        addEdge({ ...connection, type: "smoothstep", animated: true }, currentEdges),
      );
    },
    [setEdges],
  );

  return (
    <ReactFlowProvider>
      <div className={cn("bg-card border-border h-full w-full overflow-hidden rounded-lg border", className)}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          defaultEdgeOptions={{ type: "smoothstep" }}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
