import { useState } from "react";
import { useTickerStream } from "@/hooks/useTickerStream";
import { useScannerStream } from "@/hooks/useScannerStream";
import { ALL_SYMBOLS, computeBestPick, computeStreak, computeAbsence, computeFrequency } from "@/lib/digitAnalytics";
import { Activity, RadioReceiver, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Dashboard() {
  const [activeSymbol, setActiveSymbol] = useState("R_10");
  const { digits: activeDigits, status: activeStatus } = useTickerStream(activeSymbol);
  const { data: scannerData, status: scannerStatus } = useScannerStream();
  
  const [windowSize, setWindowSize] = useState<20 | 50 | 100>(100);
  
  const bestPick = computeBestPick(scannerData);
  const activeStreak = computeStreak(activeDigits);
  const activeAbsence = computeAbsence(activeDigits);
  const frequencies = computeFrequency(activeDigits, windowSize);
  
  const latestDigit = activeDigits.length > 0 ? activeDigits[activeDigits.length - 1] : null;

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-200 font-mono p-4 flex flex-col gap-6 overflow-x-hidden">
      {/* Header Bar */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-500/10 backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
        <div className="flex items-center gap-3">
          <Zap className="text-amber-500 w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight uppercase text-white drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">
            Deriv Market Scanner
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <select 
            value={activeSymbol}
            onChange={(e) => setActiveSymbol(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg outline-none focus:border-amber-500 transition-colors uppercase font-bold"
          >
            {ALL_SYMBOLS.map(sym => <option key={sym} value={sym}>{sym}</option>)}
          </select>
          
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${scannerStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="uppercase text-slate-400">{scannerStatus}</span>
          </div>
        </div>
      </header>

      {/* AI BEST ENTRY PICK */}
      <div className="rounded-xl bg-slate-500/10 backdrop-blur-xl border border-white/10 shadow-[0_-4px_12px_-2px_rgba(245,158,11,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <RadioReceiver className="w-32 h-32 text-amber-500" />
        </div>
        <h2 className="text-amber-500 font-bold tracking-widest mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" /> [AI BEST ENTRY PICK]
        </h2>
        
        {bestPick.score > 0 ? (
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-6">
              <div className="text-4xl font-bold text-white bg-slate-900/50 px-6 py-4 rounded-lg border border-slate-700">
                {bestPick.symbol}
              </div>
              <div className="flex flex-col gap-1">
                <span className={`text-2xl font-bold uppercase tracking-wider ${bestPick.type === 'DIFFERS' ? 'text-purple-400' : bestPick.type === 'EVEN' ? 'text-blue-400' : 'text-amber-400'}`}>
                  {bestPick.type} {bestPick.targetDigit >= 0 ? bestPick.targetDigit : ''}
                </span>
                <span className="text-slate-400">Score: {bestPick.score}</span>
              </div>
            </div>
            
            <button 
              onClick={() => setActiveSymbol(bestPick.symbol)}
              className="px-6 py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 border border-amber-500/50 rounded-lg uppercase tracking-wider font-bold transition-all whitespace-nowrap"
            >
              [Auto-Switch to Target Market]
            </button>
          </div>
        ) : (
          <div className="text-slate-500 py-4 uppercase tracking-widest">Scanning markets for high-probability setups...</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col - Parity Terminal */}
        <div className="lg:col-span-1 rounded-xl bg-slate-500/10 backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] p-6 flex flex-col items-center justify-center gap-8">
          <h3 className="text-slate-400 uppercase tracking-widest text-sm w-full text-center">Even/Odd Parity Terminal</h3>
          
          <div className="relative w-48 h-48 flex items-center justify-center">
            {latestDigit !== null ? (
              <motion.div
                key={latestDigit + '-' + activeDigits.length}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`absolute inset-0 rounded-full blur-2xl opacity-20 ${latestDigit % 2 === 0 ? 'bg-blue-500' : 'bg-amber-500'}`}
              />
            ) : null}
            <span className={`text-8xl font-bold z-10 ${latestDigit !== null && latestDigit % 2 === 0 ? 'text-blue-400' : 'text-amber-400'}`}>
              {latestDigit !== null ? latestDigit : '-'}
            </span>
          </div>

          <div className="bg-slate-900/50 border border-slate-700 px-6 py-3 rounded-lg text-center w-full">
            <div className="text-sm text-slate-400 uppercase mb-1">Active {activeStreak.direction} Streak</div>
            <div className={`text-3xl font-bold ${activeStreak.direction === 'EVEN' ? 'text-blue-400' : activeStreak.direction === 'ODD' ? 'text-amber-400' : 'text-slate-500'}`}>
              {activeStreak.count}
            </div>
          </div>

          <div className="w-full flex gap-1 overflow-hidden justify-end">
            <AnimatePresence initial={false}>
              {activeDigits.slice(-30).map((d, i, arr) => (
                <motion.div
                  key={`${arr.length - i}-${d}`}
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 24, opacity: 1 }}
                  className={`h-12 flex-shrink-0 flex items-center justify-center rounded-sm font-bold text-sm text-slate-950 ${d % 2 === 0 ? 'bg-blue-500' : 'bg-amber-500'}`}
                >
                  {d}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Col - Matches/Differs Ring Engine */}
        <div className="lg:col-span-2 rounded-xl bg-slate-500/10 backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] p-6">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-slate-400 uppercase tracking-widest text-sm">Matches/Differs Ring Engine</h3>
            <div className="flex gap-2 bg-slate-900/50 p-1 rounded-lg border border-slate-700">
              {[20, 50, 100].map(size => (
                <button
                  key={size}
                  onClick={() => setWindowSize(size as any)}
                  className={`px-3 py-1 rounded-md text-sm font-bold ${windowSize === size ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-5 gap-4">
            {frequencies.map((freq, i) => {
              const maxFreq = Math.max(...frequencies);
              const minFreq = Math.min(...frequencies);
              const isHot = freq === maxFreq && freq > 0;
              const isCold = freq === minFreq && activeDigits.length >= windowSize;
              
              const color = isHot ? 'text-emerald-500' : isCold ? 'text-crimson-500' : 'text-slate-400';
              const ringColor = isHot ? 'stroke-emerald-500' : isCold ? 'stroke-red-500' : 'stroke-slate-500';
              
              const dashArray = 2 * Math.PI * 30;
              const dashOffset = dashArray - (dashArray * freq) / 100;
              
              return (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="relative w-20 h-20">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="40" cy="40" r="30" className="stroke-slate-800 fill-none" strokeWidth="6" />
                      <circle 
                        cx="40" cy="40" r="30" 
                        className={`fill-none transition-all duration-500 ${ringColor}`} 
                        strokeWidth="6"
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-2xl font-bold ${color}`}>{i}</span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{freq.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Multi-Index Background Scanner Grid */}
      <div className="rounded-xl bg-slate-500/10 backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] p-6">
        <h3 className="text-slate-400 uppercase tracking-widest text-sm mb-6">Multi-Index Scanner</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {ALL_SYMBOLS.map(sym => {
            const symDigits = scannerData[sym] || [];
            const latest = symDigits.length > 0 ? symDigits[symDigits.length - 1] : '-';
            const streak = computeStreak(symDigits);
            const absence = computeAbsence(symDigits);
            
            const isSevereStreak = streak.count >= 5;
            const isSevereAbsence = absence.count >= 20;
            const isActive = sym === activeSymbol;
            
            return (
              <div 
                key={sym} 
                onClick={() => setActiveSymbol(sym)}
                className={`cursor-pointer border p-3 rounded-lg flex flex-col gap-2 transition-colors ${
                  isActive ? 'bg-amber-500/10 border-amber-500/50' : 
                  isSevereStreak || isSevereAbsence ? 'bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50' : 
                  'bg-slate-900/50 border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className={`font-bold text-sm ${isActive ? 'text-amber-500' : 'text-slate-300'}`}>{sym}</span>
                  <span className="text-lg font-bold text-white">{latest}</span>
                </div>
                
                <div className="flex justify-between text-xs">
                  <span className={`${isSevereStreak ? (streak.direction === 'EVEN' ? 'text-blue-400' : 'text-amber-400') : 'text-slate-500'}`}>
                    {streak.direction !== 'NONE' ? `${streak.direction[0]}:${streak.count}` : '-'}
                  </span>
                  <span className={`${isSevereAbsence ? 'text-purple-400' : 'text-slate-500'}`}>
                    {absence.digit >= 0 ? `D${absence.digit}:${absence.count}` : '-'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
