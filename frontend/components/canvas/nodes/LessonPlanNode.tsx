import React from 'react';
import { Handle, Position } from '@xyflow/react';

interface LessonPlanData {
  steps: string[];
  active_step: number;
}

export default function LessonPlanNode({ data }: { data: LessonPlanData }) {
  const { steps = [], active_step = 0 } = data;

  return (
    <div className="w-80 bg-white shadow-xl rounded-lg border border-gray-200 overflow-hidden font-sans">
      <div className="bg-indigo-600 text-white px-4 py-3 font-bold text-lg">
        Learning Roadmap
      </div>
      
      <div className="p-4 flex flex-col gap-3">
        {steps.map((step, index) => {
          // Determine the visual state of each step
          const isCompleted = index < active_step;
          const isActive = index === active_step;
          const isPending = index > active_step;

          return (
            <div 
              key={index} 
              className={`flex items-center gap-3 p-3 rounded-md transition-colors ${
                isActive ? 'bg-indigo-50 border border-indigo-200' : 'bg-transparent'
              }`}
            >
              {/* Status Icon */}
              <div className="flex-shrink-0">
                {isCompleted && <span className="text-green-500 font-bold text-xl">✓</span>}
                {isActive && <span className="text-indigo-600 animate-pulse text-xl">●</span>}
                {isPending && <span className="text-gray-300 text-xl">○</span>}
              </div>
              
              {/* Step Text */}
              <span className={`text-sm ${
                isActive ? 'text-indigo-900 font-semibold' : 
                isCompleted ? 'text-gray-500 line-through' : 'text-gray-400'
              }`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>

      {/* Hidden handle to satisfy React Flow requirements without showing a dot */}
      <Handle type="target" position={Position.Left} className="opacity-0" />
    </div>
  );
}