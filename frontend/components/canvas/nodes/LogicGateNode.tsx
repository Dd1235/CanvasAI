import React, { useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

export function LogicGateNode({ data }: { data: any }) {
  const [flash, setFlash] = useState(false);

  // Flash when outputs change
  useEffect(() => {
    if (data.outputs !== undefined) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(timer);
    }
  }, [data.outputs]);

  // Parse "A=1, B=0" into an array of objects
  const parseStates = (str: string) => {
    if (!str) return [];
    return str.split(',').map(s => {
      const [name, val] = s.split('=').map(x => x.trim());
      return { name, val };
    });
  };

  const inputs = parseStates(data.inputs);
  const outputs = parseStates(data.outputs);

  return (
    <div className="bg-zinc-950 border-2 border-zinc-800 rounded-md shadow-xl font-mono min-w-[220px] overflow-hidden">
      {/* Header */}
      <div className="bg-amber-900/30 px-3 py-2 flex items-center justify-between border-b border-amber-900/50">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-amber-100 uppercase tracking-widest">
            {data.label || "GATE"}
          </span>
        </div>
      </div>

      <div className="flex justify-between p-3 gap-6 relative">
        {/* Left Side: Inputs */}
        <div className="flex flex-col gap-2 relative z-10">
          <span className="text-[9px] uppercase text-zinc-500 font-bold mb-1">Inputs</span>
          {inputs.map((inp, i) => (
             <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">{inp.name}</span>
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-xs font-bold border",
                  inp.val === "1" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-zinc-900 text-zinc-500 border-zinc-800"
                )}>{inp.val}</span>
             </div>
          ))}
        </div>

        {/* Right Side: Outputs */}
        <div className="flex flex-col gap-2 items-end relative z-10">
          <span className="text-[9px] uppercase text-zinc-500 font-bold mb-1">Outputs</span>
          {outputs.map((out, i) => (
             <div key={i} className="flex items-center gap-2">
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-xs font-bold border transition-colors duration-300",
                  flash ? "bg-white text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" : 
                  out.val === "1" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-zinc-900 text-zinc-500 border-zinc-800"
                )}>{out.val}</span>
                <span className="text-xs text-zinc-400">{out.name}</span>
             </div>
          ))}
        </div>
      </div>

      <Handle type="target" position={Position.Left} className="w-3 h-4 rounded-sm bg-amber-600 border-none -ml-1" />
      <Handle type="source" position={Position.Right} className="w-3 h-4 rounded-sm bg-green-600 border-none -mr-1" />
    </div>
  );
}