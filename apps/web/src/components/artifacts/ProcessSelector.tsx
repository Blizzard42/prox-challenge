import React from 'react';
import { Layers, Maximize2, Wind, Zap } from 'lucide-react';

interface ProcessSelectorProps {
  payload: {
    inputs: {
      material: string;
      thickness: string;
      environment: string;
    };
  };
  llmText: string;
}

export default function ProcessSelector({ payload, llmText }: ProcessSelectorProps) {
  // Simple heuristic to extract the recommended process if not explicitly passed
  let recommendedProcess = 'Unknown Process';
  const textLower = llmText ? llmText.toLowerCase() : '';
  
  if (textLower.includes('flux_cored') || textLower.includes('flux cored') || textLower.includes('flux-cored')) {
    recommendedProcess = 'Flux Cored';
  } else if (textLower.includes('mig')) {
    recommendedProcess = 'MIG';
  } else if (textLower.includes('tig')) {
    recommendedProcess = 'TIG';
  } else if (textLower.includes('stick')) {
    recommendedProcess = 'Stick';
  }

  const { material, thickness, environment } = payload.inputs || {};

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl mt-4 mb-2 max-w-xl animate-in fade-in zoom-in-95 duration-500">
      <div className="bg-zinc-950/50 px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-zinc-200">Process Recommendation</h3>
        <Zap className="text-yellow-500 w-4 h-4" />
      </div>
      <div className="p-5 flex flex-col md:flex-row gap-6">
        
        {/* Left: Inputs */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center shrink-0">
              <Layers className="text-zinc-400 w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">Material</p>
              <p className="text-sm text-zinc-200 font-medium">{material || 'Not specified'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center shrink-0">
              <Maximize2 className="text-zinc-400 w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">Thickness</p>
              <p className="text-sm text-zinc-200 font-medium">{thickness || 'Not specified'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center shrink-0">
              <Wind className="text-zinc-400 w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-0.5">Environment</p>
              <p className="text-sm text-zinc-200 font-medium">{environment || 'Not specified'}</p>
            </div>
          </div>
        </div>

        {/* Right: Recommended Process */}
        <div className="w-px bg-zinc-800 hidden md:block"></div>
        <div className="flex-1 flex flex-col justify-center items-center bg-yellow-500/5 rounded-xl border border-yellow-500/20 p-4">
          <p className="text-[11px] uppercase tracking-widest text-yellow-500 font-bold mb-2">Selected Process</p>
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.3)] mb-3">
            <Zap className="text-zinc-950 w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-zinc-100 tracking-tight text-center">{recommendedProcess}</h2>
        </div>

      </div>
    </div>
  );
}
