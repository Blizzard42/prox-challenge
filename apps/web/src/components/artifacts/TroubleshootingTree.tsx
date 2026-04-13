"use client";

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, ChevronRight } from 'lucide-react';

interface TroubleshootingTreeProps {
  payload: {
    issue: string;
    steps: string[];
  };
}

export default function TroubleshootingTree({ payload }: TroubleshootingTreeProps) {
  const { issue, steps } = payload || { issue: "Unknown Issue", steps: [] };
  const [resolvedSteps, setResolvedSteps] = useState<boolean[]>(new Array(steps?.length || 0).fill(false));

  const toggleStep = (index: number) => {
    const newSteps = [...resolvedSteps];
    newSteps[index] = !newSteps[index];
    setResolvedSteps(newSteps);
  };

  const progressPercentage = steps.length > 0 ? (resolvedSteps.filter(Boolean).length / steps.length) * 100 : 0;
  const isFullyResolved = steps.length > 0 && resolvedSteps.every(Boolean);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl mt-4 mb-2 max-w-2xl animate-in fade-in zoom-in-95 duration-500">
      
      {/* Header */}
      <div className={`px-5 py-4 border-b ${isFullyResolved ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} flex items-center justify-between transition-colors duration-500`}>
        <div className="flex items-center gap-3">
          {isFullyResolved ? (
            <CheckCircle2 className="text-green-500 w-5 h-5" />
          ) : (
            <AlertTriangle className="text-red-500 w-5 h-5" />
          )}
          <div>
            <h3 className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold mb-0.5">Troubleshooting</h3>
            <p className={`text-sm font-medium ${isFullyResolved ? 'text-green-400' : 'text-red-400'}`}>{issue}</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-zinc-950 h-1.5 flex flex-col">
        <div 
          className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-700 ease-out" 
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Steps List */}
      <div className="p-3 space-y-1">
        {steps.map((step, idx) => {
          const isResolved = resolvedSteps[idx];
          return (
            <div 
              key={idx} 
              className={`flex items-start gap-4 p-3 rounded-xl transition-all duration-300 ${isResolved ? 'bg-zinc-900/40' : 'bg-zinc-800/50 hover:bg-zinc-800'}`}
            >
              <button 
                onClick={() => toggleStep(idx)}
                className={`mt-0.5 w-6 h-6 shrink-0 rounded-full flex items-center justify-center border transition-all duration-300 ${isResolved ? 'bg-green-500 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'border-zinc-500 bg-zinc-950 hover:border-yellow-500'}`}
              >
                {isResolved ? <CheckCircle2 className="w-4 h-4 text-zinc-950" /> : <Circle className="w-4 h-4 text-transparent" />}
              </button>
              
              <div className="flex-1">
                <p className={`text-sm tracking-wide ${isResolved ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                  {step}
                </p>
              </div>

              {!isResolved && (
                <button 
                  onClick={() => toggleStep(idx)}
                  className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 hover:text-yellow-500 flex items-center mt-0.5 transition-colors shrink-0"
                >
                  Mark fixed <ChevronRight className="w-3 h-3 ml-1" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      
    </div>
  );
}
