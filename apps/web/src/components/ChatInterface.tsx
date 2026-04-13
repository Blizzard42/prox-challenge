"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Menu, ShieldAlert, Cpu } from 'lucide-react';
import ProcessSelector from './artifacts/ProcessSelector';
import PhysicalSetup from './artifacts/PhysicalSetup';
import TroubleshootingTree from './artifacts/TroubleshootingTree';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const parseArtifacts = (content: string): { text: string; artifacts: any[] } => {
  if (!content) return { text: "", artifacts: [] };

  const artifacts: any[] = [];
  let text = content;

  try {
    const regex = /```json\s+([\s\S]*?)\s+```/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (match[1]) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed && typeof parsed === 'object') {
            artifacts.push(parsed);
            text = text.replace(match[0], "");
          }
        } catch (e) {
          console.warn("Failed to parse a JSON block", e);
        }
      }
    }
  } catch (e) {
    console.warn("Failed artifact parsing entirely:", e);
  }

  return { text: text.trim(), artifacts };
};

const parseInlineStyles = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold text-yellow-500/90">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index} className="italic text-zinc-300">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
};

const MarkdownRenderer = ({ content }: { content: string }) => {
  if (!content) return null;

  const lines = content.split('\n');

  return (
    <div className="flex flex-col gap-1.5 break-words">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />;

        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const text = headingMatch[2];
          const sizes = ['text-xl', 'text-lg', 'text-base', 'text-sm', 'text-sm', 'text-sm'];
          const margin = i === 0 ? 'mb-1' : 'mt-3 mb-1';
          return (
            <div key={i} className={`font-semibold text-zinc-100 ${sizes[level - 1]} ${margin}`}>
              {parseInlineStyles(text)}
            </div>
          );
        }

        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          return (
            <div key={i} className="flex gap-2 ml-1">
              <span className="text-zinc-500 select-none">•</span>
              <span className="flex-1">{parseInlineStyles(line.replace(/^[-*]\s+/, ''))}</span>
            </div>
          );
        }

        if (/^\d+\.\s/.test(line.trim())) {
          const match = line.trim().match(/^(\d+\.)\s+(.*)/);
          return (
            <div key={i} className="flex gap-2 ml-1">
              <span className="text-zinc-500 tabular-nums select-none">{match?.[1]}</span>
              <span className="flex-1">{parseInlineStyles(match?.[2] || '')}</span>
            </div>
          );
        }

        return <p key={i} className="leading-relaxed">{parseInlineStyles(line)}</p>;
      })}
    </div>
  );
};

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: inputMessage };
    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    setInputMessage("");
    setIsLoading(true);

    try {
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.body) throw new Error('No streaming response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let agentContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (!dataStr) continue;

            try {
              const event = JSON.parse(dataStr);
              if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                agentContent += event.delta.text;
                setMessages(prev => {
                  const updated = [...prev];
                  const lastIndex = updated.length - 1;
                  updated[lastIndex] = { ...updated[lastIndex], content: agentContent };
                  return updated;
                });
              } else if (event.error) {
                console.error("Stream error:", event.error);
              }
            } catch (e) {
              console.error("Error parsing JSON chunk", e, dataStr);
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

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
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-6 w-full">

          {/* Intro Message */}
          <div className="flex justify-center">
            <span className="text-xs font-medium text-zinc-600 bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-800">
              System Initialized
            </span>
          </div>

          {messages.map((msg, index) => {
            if (msg.role === 'user') {
              return (
                <div key={index} className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-zinc-800 px-4 py-3 text-sm text-zinc-100 shadow-sm border border-zinc-700/50 whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              );
            }

            const isLastAgentMessage = index === messages.length - 1 && isLoading;
            const { text, artifacts } = parseArtifacts(msg.content);

            return (
              <div key={index} className="flex justify-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
                <div className="flex-shrink-0 mt-1">
                  <div className={`w-7 h-7 rounded-full bg-zinc-900 border border-yellow-500/50 flex items-center justify-center ${isLastAgentMessage ? 'animate-pulse' : ''}`}>
                    <Cpu size={14} className={`text-yellow-500 ${isLastAgentMessage ? 'animate-[spin_2.5s_linear_infinite]' : ''}`} />
                  </div>
                </div>
                <div className="max-w-[85%] space-y-3 w-full">
                  {(text || isLastAgentMessage || artifacts.length === 0) && (
                    <div className="rounded-2xl rounded-tl-sm bg-zinc-900 px-4 py-3 text-sm text-zinc-200 border border-zinc-800/80 shadow-md">
                      {text ? <MarkdownRenderer content={text} /> : <p className="leading-relaxed text-zinc-500 animate-pulse">Thinking...</p>}
                    </div>
                  )}

                  {artifacts.map((artifact, i) => (
                    <React.Fragment key={i}>
                      {artifact.artifact_type === 'process_selector' && (
                        <ProcessSelector payload={artifact} llmText={text} />
                      )}
                      {artifact.artifact_type === 'physical_setup' && (
                        <PhysicalSetup payload={artifact} />
                      )}
                      {artifact.artifact_type === 'troubleshooting' && (
                        <TroubleshootingTree payload={artifact} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
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
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading || !inputMessage.trim()}
            className="p-2.5 bg-yellow-500 hover:bg-yellow-400 text-zinc-950 rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed mb-0.5 mr-0.5 flex-shrink-0"
          >
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
