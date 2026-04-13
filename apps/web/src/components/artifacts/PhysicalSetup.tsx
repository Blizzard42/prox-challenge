import React from 'react';
import Image from 'next/image';
import { Settings, Plus, Minus } from 'lucide-react';

interface PhysicalSetupProps {
  payload: {
    process: string;
    ground_polarity: string;
    torch_polarity: string;
    drive_roll?: string;
    gas?: string;
  };
}

export default function PhysicalSetup({ payload }: PhysicalSetupProps) {
  const { process, ground_polarity, torch_polarity, drive_roll, gas } = payload || {};

  const isStickOrTig = process?.toLowerCase().includes('stick') || process?.toLowerCase().includes('tig');

  let torchLabel = 'TORCH';
  if (process?.toLowerCase().includes('stick')) {
    torchLabel = 'ELECTRODE';
  } else if (process?.toLowerCase().includes('tig')) {
    torchLabel = 'TIG TORCH';
  }

  const positivePos = "bottom-[11%] right-[11%]";
  const negativePos = "bottom-[8%] left-[47%]";
  const torchPos = torch_polarity?.toLowerCase().includes('positive') ? positivePos : negativePos;
  const groundPos = ground_polarity?.toLowerCase().includes('positive') ? positivePos : negativePos;

  // Format polarity into clean symbols
  const getPolarityIcon = (pol: string) => {
    pol = pol?.toLowerCase() || '';
    if (pol.includes('positive')) return <Plus className="w-3 h-3" />;
    if (pol.includes('negative')) return <Minus className="w-3 h-3" />;
    return null;
  };

  const getPolarityColor = (pol: string) => {
    pol = pol?.toLowerCase() || '';
    if (pol.includes('positive')) return 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]';
    if (pol.includes('negative')) return 'bg-zinc-900 shadow-[0_0_15px_rgba(0,0,0,0.8)]';
    return 'bg-zinc-500';
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl mt-4 mb-2 max-w-3xl animate-in fade-in zoom-in-95 duration-500">
      <div className="bg-zinc-950/50 px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-zinc-200">
          Physical Configuration: <span className="text-yellow-500 ml-1">{process || 'Unknown'}</span>
        </h3>
        <Settings className="text-zinc-400 w-4 h-4" />
      </div>

      <div className={`p-4 grid gap-4 ${isStickOrTig ? 'md:grid-cols-1 place-items-center' : 'md:grid-cols-2'}`}>
        {/* Front Panel image with overlays */}
        <div className={`relative rounded-xl overflow-hidden border border-zinc-800 bg-black flex items-center justify-center group shadow-inner ${isStickOrTig ? 'aspect-[4/3] w-full max-w-lg' : 'aspect-square w-full'}`}>
          <div className="relative w-full h-full transition-transform duration-700 group-hover:scale-105">
            <Image
              src="/product.webp"
              alt="Vulcan Machine Front Panel"
              fill
              className="object-contain p-4"
            />

            {/* Torch Connection Badge */}
            <div className={`absolute ${torchPos} flex flex-col items-center animate-in slide-in-from-bottom-5 duration-700 delay-100`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white ${getPolarityColor(torch_polarity)} z-10 relative border-solid border-white border-2`}>
                {getPolarityIcon(torch_polarity)}
              </div>
              <div className="bg-zinc-950/90 backdrop-blur-md text-[10px] font-bold text-white px-2 py-1 rounded mt-1 border border-zinc-700 shadow-xl">
                {torchLabel}
              </div>
            </div>

            {/* Ground Connection Badge */}
            <div className={`absolute ${groundPos} flex flex-col items-center animate-in slide-in-from-bottom-5 duration-700 delay-300`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white ${getPolarityColor(ground_polarity)} z-10 relative border-solid border-white border-2`}>
                {getPolarityIcon(ground_polarity)}
              </div>
              <div className="bg-zinc-950/90 backdrop-blur-md text-[10px] font-bold text-white px-2 py-1 rounded mt-1 border border-zinc-700 shadow-xl">
                GROUND
              </div>
            </div>
          </div>
        </div>

        {/* Inside/Drive Roll image with overlays - Hide for Stick/TIG */}
        {!isStickOrTig && (
          <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-black aspect-square flex items-center justify-center group shadow-inner">
            <Image
              src="/product-inside.webp"
              alt="Vulcan Machine Drive Rolls"
              fill
              className="object-cover p-2 group-hover:scale-105 transition-transform duration-700 opacity-80"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>

            <div className="absolute bottom-6 left-0 right-0 px-6 flex flex-col items-center gap-3">
              <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-3 h-3 text-yellow-500" />
                Internal Routing
              </p>
              <div className="flex w-full justify-center gap-4">
                <div className="flex-1 flex flex-col items-center gap-1 text-xs text-zinc-200 bg-zinc-900/90 border border-zinc-700/50 px-3 py-2 rounded-xl backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.8)] text-center">
                  <span className="font-bold text-zinc-500 uppercase tracking-wider text-[9px]">Drive Roll</span>
                  <span className="font-medium">{drive_roll || 'V-Groove / Knurled'}</span>
                </div>
                <div className="flex-1 flex flex-col items-center gap-1 text-xs text-zinc-200 bg-zinc-900/90 border border-zinc-700/50 px-3 py-2 rounded-xl backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.8)] text-center">
                  <span className="font-bold text-zinc-500 uppercase tracking-wider text-[9px]">Gas Supply</span>
                  <span className="font-medium">{gas || 'Check Manual'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
