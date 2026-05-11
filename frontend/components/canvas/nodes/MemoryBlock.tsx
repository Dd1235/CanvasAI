import React, { useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { Database, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

export function MemoryBlock({ data }: { data: any }) {
  const [flash, setFlash] = useState(false);

  // Trigger a visual flash whenever the AI mutates the value
  useEffect(() => {
    if (data.value !== undefined) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(timer);
    }
  }, [data.value]);

  return (
    <div className="bg-zinc-950 border-2 border-zinc-800 rounded-md shadow-lg font-mono min-w-[180px] overflow-hidden transition-all duration-300">
      {/* Node Header */}
      <div className="bg-zinc-900 px-3 py-1.5 flex items-center justify-between border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[10px] uppercase font-bold text-zinc-300 tracking-wider">
            {data.label || "Variable"}
          </span>
        </div>
      </div>
      
      {/* Node Body */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Hash className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs text-zinc-400">{data.address || "0x0000"}</span>
        </div>
        <div 
          className={cn(
            "rounded p-2 text-sm font-bold text-center border break-words transition-colors duration-300",
            flash 
              ? "bg-green-500/20 text-green-300 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)]" 
              : "bg-zinc-900 text-zinc-100 border-zinc-800"
          )}
        >
          {data.value ?? "NULL"}
        </div>
      </div>

      {/* Handles for pointers (Left/Right for Linked Lists, Top/Bottom for Stacks) */}
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-blue-500 border-none" />
      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-blue-500 border-none" />
      <Handle type="target" position={Position.Left} id="left" className="w-2.5 h-2.5 bg-blue-500 border-none" />
      <Handle type="source" position={Position.Right} id="right" className="w-2.5 h-2.5 bg-blue-500 border-none" />
    </div>
  );
}