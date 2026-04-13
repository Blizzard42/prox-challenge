"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Menu, ShieldAlert, Cpu, Mic, MicOff, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ProcessSelector from './artifacts/ProcessSelector';
import PhysicalSetup from './artifacts/PhysicalSetup';
import TroubleshootingTree from './artifacts/TroubleshootingTree';
import DiagramViewer from './artifacts/DiagramViewer';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type ContentBlock =
  | { type: 'text'; content: string }
  | { type: 'artifact'; artifact: any };

const parseContentBlocks = (content: string): ContentBlock[] => {
  if (!content) return [];

  const blocks: ContentBlock[] = [];
  try {
    const regex = /```json\s+([\s\S]*?)\s+```/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        blocks.push({ type: 'text', content: content.slice(lastIndex, match.index) });
      }

      if (match[1]) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed && typeof parsed === 'object') {
            blocks.push({ type: 'artifact', artifact: parsed });
          } else {
            blocks.push({ type: 'text', content: match[0] });
          }
        } catch (e) {
          console.warn("Failed to parse a JSON block", e);
          blocks.push({ type: 'text', content: match[0] });
        }
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      blocks.push({ type: 'text', content: content.slice(lastIndex) });
    }
  } catch (e) {
    console.warn("Failed artifact parsing entirely:", e);
    blocks.push({ type: 'text', content });
  }

  return blocks.reduce((acc: ContentBlock[], curr: ContentBlock) => {
    if (curr.type === 'text') {
      if (acc.length > 0 && acc[acc.length - 1].type === 'text') {
        const lastBlock = acc[acc.length - 1] as { type: 'text', content: string };
        lastBlock.content += curr.content;
      } else {
        acc.push({ ...curr });
      }
    } else {
      acc.push(curr);
    }
    return acc;
  }, []).map(block => {
    if (block.type === 'text') {
      return { ...block, content: block.content.trim() };
    }
    return block;
  }).filter(block => {
    if (block.type === 'text' && !block.content) return false;
    return true;
  });
};

const MarkdownRenderer = ({ content, onPageClick }: { content: string, onPageClick?: (url: string) => void }) => {
  if (!content) return null;

  const processedContent = content.replace(/\[?[Pp]age\s+(\d+)\]?/gi, '[Page $1](#page-$1)');

  return (
    <div className="flex flex-col break-words text-sm text-zinc-200 space-y-2 max-w-full overflow-hidden [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }: any) => <h1 className="font-semibold text-zinc-100 text-xl mt-4 mb-2" {...props} />,
          h2: ({ node, ...props }: any) => <h2 className="font-semibold text-zinc-100 text-lg mt-4 mb-2" {...props} />,
          h3: ({ node, ...props }: any) => <h3 className="font-semibold text-zinc-100 text-base mt-4 mb-2" {...props} />,
          h4: ({ node, ...props }: any) => <h4 className="font-semibold text-zinc-100 text-sm mt-3 mb-1" {...props} />,
          h5: ({ node, ...props }: any) => <h5 className="font-semibold text-zinc-100 text-sm mt-3 mb-1" {...props} />,
          h6: ({ node, ...props }: any) => <h6 className="font-semibold text-zinc-100 text-sm mt-3 mb-1" {...props} />,
          p: ({ node, ...props }: any) => <p className="leading-relaxed" {...props} />,
          ul: ({ node, ...props }: any) => <ul className="list-disc list-outside space-y-1 ml-5 my-2" {...props} />,
          ol: ({ node, ...props }: any) => <ol className="list-decimal list-outside space-y-1 ml-5 my-2 tabular-nums" {...props} />,
          li: ({ node, ...props }: any) => <li className="text-zinc-200" {...props} />,
          strong: ({ node, ...props }: any) => <strong className="font-semibold text-yellow-500/90" {...props} />,
          em: ({ node, ...props }: any) => <em className="italic text-zinc-300" {...props} />,
          pre: ({ node, ...props }: any) => <pre className="bg-zinc-800 p-3 rounded-md overflow-x-auto text-xs font-mono my-3 border border-zinc-700/50 w-full" {...props} />,
          code: ({ node, className, ...props }: any) => {
            const isInline = !className && !props.children?.toString().includes('\n');
            return <code className={`${isInline ? 'bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded text-xs font-mono border border-zinc-700/50 break-words whitespace-pre-wrap' : 'text-zinc-300 bg-transparent'}`} {...props} />;
          },
          a: ({ node, href, ...props }: any) => {
            if (href?.startsWith('#page-')) {
              const pageNum = href.replace('#page-', '');
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    const apiBaseUri = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                    onPageClick?.(`${apiBaseUri}/static/pages/page_${pageNum}.jpg`);
                  }}
                  className="inline-flex items-center text-sky-400 hover:text-sky-300 underline decoration-sky-400/30 underline-offset-4 cursor-pointer font-medium px-1"
                  {...props}
                />
              );
            }
            return <a href={href} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline hover:text-sky-300" {...props} />;
          },
          hr: ({ node, ...props }: any) => <hr className="border-zinc-800 my-4" {...props} />,
          table: ({ node, ...props }: any) => <div className="overflow-x-auto w-full my-3"><table className="w-full text-sm text-left border-collapse border border-zinc-800 min-w-max" {...props} /></div>,
          th: ({ node, ...props }: any) => <th className="border border-zinc-800 px-3 py-2 bg-zinc-900/80 text-zinc-200 font-medium" {...props} />,
          td: ({ node, ...props }: any) => <td className="border border-zinc-800 px-3 py-2 text-zinc-300 bg-zinc-900/30" {...props} />,
          del: ({ node, ...props }: any) => <del className="line-through text-zinc-500" {...props} />,
          blockquote: ({ node, ...props }: any) => <blockquote className="border-l-4 border-zinc-700 pl-4 py-1 italic text-zinc-400 my-3 bg-zinc-900/40" {...props} />
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTranscript) {
          setInputMessage(prev => {
            const separator = prev && !prev.endsWith(' ') ? ' ' : '';
            return prev + separator + finalTranscript.trim();
          });
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (!inputMessage.trim()) setInputMessage("");
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

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
            const blocks = parseContentBlocks(msg.content);
            const fullText = msg.content.replace(/```json[\s\S]*?```/g, '');

            return (
              <div key={index} className="flex justify-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
                <div className="flex-shrink-0 mt-1">
                  <div className={`w-7 h-7 rounded-full bg-zinc-900 border border-yellow-500/50 flex items-center justify-center ${isLastAgentMessage ? 'animate-pulse' : ''}`}>
                    <Cpu size={14} className={`text-yellow-500 ${isLastAgentMessage ? 'animate-[spin_2.5s_linear_infinite]' : ''}`} />
                  </div>
                </div>
                <div className="max-w-[85%] space-y-3 w-full">
                  {blocks.length === 0 && isLastAgentMessage && (
                    <div className="rounded-2xl rounded-tl-sm bg-zinc-900 px-4 py-3 text-sm text-zinc-200 border border-zinc-800/80 shadow-md">
                      <p className="leading-relaxed text-zinc-500 animate-pulse">Thinking...</p>
                    </div>
                  )}

                  {blocks.map((block, i) => {
                    if (block.type === 'text') {
                      return (
                        <div key={i} className="rounded-2xl rounded-tl-sm bg-zinc-900 px-4 py-3 text-sm text-zinc-200 border border-zinc-800/80 shadow-md">
                          <MarkdownRenderer content={block.content} onPageClick={setModalImage} />
                        </div>
                      );
                    }

                    const artifact = block.artifact;
                    return (
                      <React.Fragment key={i}>
                        {artifact.artifact_type === 'process_selector' && (
                          <ProcessSelector payload={artifact} llmText={fullText} />
                        )}
                        {artifact.artifact_type === 'physical_setup' && (
                          <PhysicalSetup payload={artifact} />
                        )}
                        {artifact.artifact_type === 'troubleshooting' && (
                          <TroubleshootingTree payload={artifact} />
                        )}
                        {artifact.component === 'DiagramViewer' && (
                          <DiagramViewer payload={artifact} />
                        )}
                      </React.Fragment>
                    );
                  })}
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
        <div className={`max-w-3xl mx-auto flex gap-2 items-end bg-zinc-900/80 border rounded-2xl p-1.5 focus-within:ring-1 focus-within:ring-yellow-500/50 focus-within:border-yellow-500/50 transition-all ${isListening ? 'border-yellow-500/50 ring-1 ring-yellow-500/50' : 'border-zinc-800'}`}>
          <textarea
            rows={1}
            placeholder={isListening ? "Listening..." : "Ask about the Vulcan OmniPro 220..."}
            className="flex-1 max-h-32 min-h-[40px] resize-none bg-transparent border-none text-sm text-zinc-100 placeholder:text-zinc-500 focus:ring-0 px-3 py-2.5 outline-none leading-relaxed"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            onClick={toggleListening}
            className={`p-2.5 rounded-xl transition-colors shrink-0 mb-0.5 ${isListening ? 'bg-zinc-800 text-yellow-500 animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.2)]' : 'bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
          >
            {isListening ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
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

      {/* Modal */}
      {modalImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md transition-all"
          onClick={() => setModalImage(null)}
        >
          <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <button
              className="absolute -top-12 right-0 p-2 text-zinc-400 hover:text-white transition-colors bg-zinc-800 rounded-full"
              onClick={(e) => { e.stopPropagation(); setModalImage(null); }}
            >
              <X size={24} />
            </button>
            <img
              src={modalImage}
              alt="Manual Page"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl bg-white"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
