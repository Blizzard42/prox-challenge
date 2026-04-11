import React from 'react';
import { Send, Menu, ShieldAlert, Cpu } from 'lucide-react';

export default function ChatInterface() {
  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-950 text-zinc-100 font-sans selection:bg-yellow-500/30">
      
      {/* Header */}
      <header className="flex-none p-4 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.3)]">
            <Cpu size={18} className="text-zinc-950" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-zinc-100">Vulcan OmniPro 220</h1>
            <p className="text-[10px] uppercase tracking-widest text-yellow-500/80 font-semibold">Support Agent</p>
          </div>
        </div>
        <button className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors">
          <Menu size={20} />
        </button>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Intro Message */}
        <div className="flex justify-center">
          <span className="text-xs font-medium text-zinc-600 bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-800">
            System Initialized
          </span>
        </div>

        {/* User Message */}
        <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-zinc-800 px-4 py-3 text-sm text-zinc-100 shadow-sm border border-zinc-700/50">
            What's the duty cycle for MIG welding at 200A on 240V?
          </div>
        </div>

        {/* Agent Message */}
        <div className="flex justify-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both">
          <div className="flex-shrink-0 mt-1">
            <div className="w-7 h-7 rounded-full bg-zinc-900 border border-yellow-500/50 flex items-center justify-center">
              <Cpu size={14} className="text-yellow-500" />
            </div>
          </div>
          <div className="max-w-[85%] space-y-3">
            <div className="rounded-2xl rounded-tl-sm bg-zinc-900 px-4 py-3 text-sm text-zinc-200 border border-zinc-800/80 shadow-md">
              <p>For the Vulcan OmniPro 220, running <strong>MIG at 200A on a 240V input</strong>, the duty cycle is exactly <strong>25%</strong>.</p>
              
              <div className="mt-3 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 text-yellow-100/90 flex gap-3 text-xs leading-relaxed">
                <ShieldAlert size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                <p>This means you can weld continuously for <strong>2.5 minutes</strong> out of a 10-minute period before the thermal overload protection kicks in to cool the machine.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Input Area */}
      <footer className="flex-none p-3 bg-zinc-950 border-t border-zinc-900 relative">
        <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto flex gap-2 items-end bg-zinc-900/80 border border-zinc-800 rounded-2xl p-1.5 focus-within:ring-1 focus-within:ring-yellow-500/50 focus-within:border-yellow-500/50 transition-all">
          <textarea 
            rows={1}
            placeholder="Ask about the Vulcan OmniPro 220..."
            className="flex-1 max-h-32 min-h-[40px] resize-none bg-transparent border-none text-sm text-zinc-100 placeholder:text-zinc-500 focus:ring-0 px-3 py-2.5 outline-none leading-relaxed"
            defaultValue=""
          />
          <button className="p-2.5 bg-yellow-500 hover:bg-yellow-400 text-zinc-950 rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed mb-0.5 mr-0.5 flex-shrink-0">
            <Send size={18} className="ml-0.5" />
          </button>
        </div>
        <p className="text-center text-[10px] text-zinc-600 mt-2">
          Vulcan Multimodal Agent. Responses may vary based on manual version.
        </p>
      </footer>
    </div>
  );
}
