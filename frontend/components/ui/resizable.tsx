"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) {
  return (
    <ResizablePrimitive.PanelGroup
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

const ResizablePanel = ResizablePrimitive.Panel;

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitive.PanelResizeHandle
      data-slot="resizable-handle"
      className={cn(
        "relative flex items-center justify-center bg-transparent transition-colors",
        "data-[panel-group-direction=horizontal]:w-1.5 data-[panel-group-direction=horizontal]:cursor-col-resize",
        "data-[panel-group-direction=vertical]:h-1.5 data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:cursor-row-resize",
        "hover:bg-border focus-visible:bg-border data-[resize-handle-active]:bg-primary/40",
        "after:absolute after:inset-0 after:content-['']",
        className,
      )}
      {...props}
    >
      {withHandle ? (
        <div
          className={cn(
            "bg-border z-10 flex items-center justify-center rounded-sm border shadow-sm",
            "data-[panel-group-direction=horizontal]:h-8 data-[panel-group-direction=horizontal]:w-3",
            "data-[panel-group-direction=vertical]:h-3 data-[panel-group-direction=vertical]:w-8",
          )}
        >
          <GripVertical className="text-muted-foreground size-3 data-[panel-group-direction=vertical]:rotate-90" />
        </div>
      ) : null}
    </ResizablePrimitive.PanelResizeHandle>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
