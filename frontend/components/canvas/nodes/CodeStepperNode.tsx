import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';

interface Frame {
  line: number;
  variables: Record<string, string | number>;
  explanation: string;
}

interface CodeStepperData {
  code: string;
  language: string;
  frames: Frame[];
}

export default function CodeStepperNode({ data }: { data: CodeStepperData }) {
  const [currentFrame, setCurrentFrame] = useState(0);
  // Force 'frames' to be an array even if the backend explicitly sends null
  const code = data.code || "";
  const frames = Array.isArray(data.frames) ? data.frames : [];
  
  // Safely grab current frame data
  const frameData = frames[currentFrame] || { line: -1, variables: {}, explanation: "" };
  const lines = code.split('\n');

  return (
    <div className="w-[500px] bg-slate-900 rounded-xl border-2 border-slate-700 shadow-2xl font-mono text-sm overflow-hidden flex flex-col">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-400" />
      
      {/* Top Header */}
      <div className="bg-slate-800 px-4 py-2 flex justify-between items-center border-b border-slate-700">
        <span className="text-slate-300 font-bold">Algorithm Tracer</span>
        <span className="text-slate-400 text-xs bg-slate-700 px-2 py-1 rounded">
          Step {currentFrame + 1} of {frames.length}
        </span>
      </div>

      <div className="flex flex-row h-64">
        {/* Left Side: Code Viewer */}
        <div className="w-2/3 bg-slate-900 p-4 overflow-y-auto border-r border-slate-700">
          {lines.map((codeLine, index) => {
            // +1 because code lines usually start at 1, not 0
            const isHighlighted = frameData.line === index + 1;
            return (
              <div 
                key={index} 
                className={`px-2 py-0.5 rounded ${isHighlighted ? 'bg-blue-900 border-l-2 border-blue-400 text-white' : 'text-slate-400'}`}
              >
                <span className="opacity-50 mr-4 select-none">{index + 1}</span>
                {codeLine}
              </div>
            );
          })}
        </div>

        {/* Right Side: Memory State & Explanation */}
        <div className="w-1/3 bg-slate-800 p-4 flex flex-col gap-4 overflow-y-auto">
          <div>
            <h4 className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Memory State</h4>
            {Object.entries(frameData.variables).map(([key, value]) => (
              <div key={key} className="flex justify-between text-slate-300 bg-slate-700/50 px-2 py-1 rounded mb-1">
                <span className="text-pink-400">{key}</span>
                <span className="text-green-400">{value}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-auto">
            <h4 className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Execution</h4>
            <p className="text-slate-300 text-xs leading-relaxed">
              {frameData.explanation}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="bg-slate-800 p-3 flex justify-between items-center border-t border-slate-700">
        <button 
          onClick={() => setCurrentFrame(prev => Math.max(0, prev - 1))}
          disabled={currentFrame === 0}
          className="px-4 py-1.5 bg-slate-700 text-white rounded disabled:opacity-50 hover:bg-slate-600 transition"
        >
          &larr; Prev
        </button>
        <button 
          onClick={() => setCurrentFrame(prev => Math.min(frames.length - 1, prev + 1))}
          disabled={currentFrame === frames.length - 1}
          className="px-4 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-500 transition"
        >
          Next &rarr;
        </button>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-400" />
    </div>
  );
}