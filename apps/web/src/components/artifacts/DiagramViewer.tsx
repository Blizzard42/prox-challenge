import React, { useState } from 'react';
import { ZoomIn, X } from 'lucide-react';

interface DiagramViewerProps {
  payload: {
    artifact_type?: string;
    component?: string;
    props?: {
      imageUrl: string;
      caption?: string;
    };
    imageUrl?: string;
    caption?: string;
  };
}

export default function DiagramViewer({ payload }: DiagramViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Handle both possible schema payloads (direct or wrapped in 'props')
  const imageUrl = payload.props?.imageUrl || payload.imageUrl;
  const caption = payload.props?.caption || payload.caption || 'Reference Diagram';

  if (!imageUrl) return null;

  // Add the NEXT_PUBLIC_API_URL locally if it's a relative path? Let's just use it exactly if it starts with http, otherwise proxy to env.
  const apiBaseUri = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `${apiBaseUri}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;

  return (
    <>
      <div className="mt-4 border border-zinc-700/50 rounded-xl overflow-hidden bg-zinc-900 shadow-sm transition-all hover:border-yellow-500/30">
        <div className="bg-zinc-800/80 px-3 py-2 border-b border-zinc-700/50 flex justify-between items-center">
          <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">{caption}</h4>
        </div>
        <div className="relative group cursor-zoom-in bg-zinc-950 p-2 flex justify-center" onClick={() => setIsExpanded(true)}>
          <img 
            src={fullImageUrl} 
            alt={caption} 
            className="max-h-64 object-contain rounded-md"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <ZoomIn className="text-white w-8 h-8 opacity-80 drop-shadow-md" />
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-sm" onClick={() => setIsExpanded(false)}>
          <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <button 
              className="absolute -top-12 right-0 p-2 text-zinc-400 hover:text-white transition-colors bg-zinc-800 rounded-full"
              onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
            >
              <X size={24} />
            </button>
            <img 
              src={fullImageUrl} 
              alt={caption} 
              className="max-w-full max-h-[85vh] object-contain rounded-lg border border-zinc-700/50 shadow-2xl bg-zinc-900"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="mt-4 text-zinc-300 text-sm">{caption}</p>
          </div>
        </div>
      )}
    </>
  );
}
