import * as React from "react";
import { Undo2, GitBranch, Sparkles, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DemoTurn, CanvasPayload } from "@/lib/canvasai-types";

type ExtendedPayload = CanvasPayload & { step_title?: string };

interface TimelineNodeProps {
  frame: DemoTurn & { payload: ExtendedPayload };
  isActive: boolean;
  isPast: boolean;
  onSelect: () => void;
  onRevert: (e: React.MouseEvent) => void;
  onBranch: (e: React.MouseEvent) => void;
}

export function TimelineNode({ frame, isActive, isPast, onSelect, onRevert, onBranch }: TimelineNodeProps) {
  const title = frame.payload.step_title || `Turn ${frame.index + 1}`;

  return (
    <div className="relative flex w-full gap-4 group">
      
      {/* The Connecting Icon Column */}
      <div className="relative flex items-start justify-center w-6 shrink-0 z-10 pt-4">
        <div className={cn(
          "flex items-center justify-center size-6 rounded-full border-2 ring-4 ring-background transition-all duration-300",
          isActive ? "border-primary bg-primary shadow-[0_0_15px_rgba(var(--primary),0.5)] scale-110 text-primary-foreground" :
          isPast ? "border-primary bg-background text-primary" : "border-muted bg-muted text-muted-foreground"
        )}>
          {isActive ? <Sparkles className="size-3" /> : isPast ? <CheckCircle2 className="size-4" /> : <Circle className="size-3" />}
        </div>
      </div>

      {/* The Rich Block Card */}
      <div
        onClick={onSelect}
        className={cn(
          "flex-1 relative rounded-xl p-4 cursor-pointer transition-all duration-300 border backdrop-blur-sm min-w-0",
          isActive 
            ? "bg-gradient-to-br from-primary/10 via-background to-background border-primary shadow-md ring-1 ring-primary/20" 
            : "bg-card/80 border-border hover:border-primary/40 hover:shadow-sm",
          !isPast && "opacity-50 hover:opacity-80"
        )}
      >
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
           <h4 className={cn(
             "text-sm font-bold tracking-tight leading-snug truncate",
             isActive ? "text-primary" : "text-foreground"
           )}>
             {title}
           </h4>
           {isActive && (
             <Badge variant="default" className="text-[9px] h-4 px-1.5 py-0 uppercase font-bold tracking-wider shrink-0">
               Active
             </Badge>
           )}
        </div>
        
        {/* User's Prompt as the descriptive text */}
        <p className="text-xs text-muted-foreground line-clamp-2 italic border-l-2 border-primary/30 pl-2">
          "{frame.prompt}"
        </p>

        {/* Hover Action Toolbar (Floating Glassmorphism) */}
        <div className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-background/95 backdrop-blur-md rounded-lg p-1 border shadow-lg z-20 scale-95 group-hover:scale-100 duration-200">
          <Button size="icon-sm" variant="ghost" onClick={onRevert} title="Revert to here" className="h-7 w-7 text-destructive hover:bg-destructive/15">
            <Undo2 className="size-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onBranch} title="Branch from here" className="h-7 w-7 text-primary hover:bg-primary/15">
            <GitBranch className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}