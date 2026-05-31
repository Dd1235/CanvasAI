import * as React from "react";
import { TimelineNode } from "./timeline-node";
import type { DemoTurn, CanvasPayload } from "@/lib/canvasai-types";

type ExtendedPayload = CanvasPayload & { step_title?: string };
type DeckFrame = DemoTurn & { payload: ExtendedPayload };

interface VerticalTimelineProps {
  frames: DeckFrame[];
  activeIndex: number;
  onGoToFrame: (index: number) => void;
  onRevert: (index: number, e: React.MouseEvent) => void;
  onBranch: (index: number, e: React.MouseEvent) => void;
}

export function VerticalTimeline({ frames, activeIndex, onGoToFrame, onRevert, onBranch }: VerticalTimelineProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      const activeElement = scrollRef.current.children[activeIndex] as HTMLElement;
      if (activeElement) {
        // Native scroll configuration
        activeElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [activeIndex]);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-card border-border rounded-lg border overflow-hidden shadow-sm">
      
      {/* Header - explicitly prevented from shrinking */}
      <div className="shrink-0 p-4 border-b border-border bg-gradient-to-r from-muted/50 to-transparent">
        <h3 className="font-semibold text-sm tracking-tight text-foreground">Learning Journey</h3>
        <p className="text-xs text-muted-foreground mt-1">Your timeline of concept discovery.</p>
      </div>
      
      {/* Scrollable Body - Native overflow guarantees it works in the flex column */}
      <div className="flex-1 overflow-y-auto p-4 pr-6">
        <div className="relative space-y-4 pb-4" ref={scrollRef}>
          
          {/* The vertical tracking line (Perfectly aligned with the icons) */}
          <div className="absolute left-[11px] top-6 bottom-6 w-[2px] bg-gradient-to-b from-primary via-primary/50 to-muted rounded-full" />

          {frames.map((frame, idx) => (
            <TimelineNode
              key={`${frame.index}-${frame.prompt}`}
              frame={frame as any}
              isActive={idx === activeIndex}
              isPast={idx <= activeIndex}
              onSelect={() => onGoToFrame(idx)}
              onRevert={(e) => onRevert(idx, e)}
              onBranch={(e) => onBranch(idx, e)}
            />
          ))}
          
        </div>
      </div>

    </div>
  );
}