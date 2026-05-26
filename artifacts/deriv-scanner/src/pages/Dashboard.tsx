import { useState, useEffect, useRef } from "react";
import { useTickerStream } from "@/hooks/useTickerStream";
import { useScannerStream } from "@/hooks/useScannerStream";
import {
  ALL_SYMBOLS,
  computeBestPick,
  computeStreak,
  computeAbsence,
  computeFrequency,
  type StrategyFilter,
} from "@/lib/digitAnalytics";
import { Activity, RadioReceiver, Zap, Clock, Target, Crosshair } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STRATEGY_TABS: { label: string; value: StrategyFilter }[] = [
  { label: "ALL MATCHES/DIFFERS", value: "ALL" },
  { label: "MATCHES ONLY", value: "MATCHES" },
  { label: "DIFFERS ONLY", value: "DIFFERS" },
  { label: "EVEN/ODD ONLY", value: "EVEN_ODD" },
];

const TRADE_TYPE_COLOR: Record<string, string> = {
  DIFFERS: "text-purple-400",
  MATCHES: "text-emerald-400",
  EVEN: "text-blue-400",
  ODD: "text-amber-400",
};

const TRADE_TYPE_BG: Record<string, string> = {
  DIFFERS: "bg-purple-500/15 border-purple-500/30 text-purple-300",
  MATCHES: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
  EVEN: "bg-blue-500/15 border-blue-500/30 text-blue-300",
  ODD: "bg-amber-500/15 border-amber-500/30 text-amber-300",
};

export default function Dashboard() {
  const [activeSymbol, setActiveSymbol] = useState("R_10");
  const [strategyFilter, setStrategyFilter] = useState<StrategyFilter>("ALL");
  const [windowSize, setWindowSize] = useState<20 | 50 | 100>(100);
  const [tickPulse, setTickPulse] = useState(false);
  const prevDigitsLen = useRef(0);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { digits: activeDigits, status: activeStatus } = useTickerStream(activeSymbol);
  const { data: scannerData, status: scannerStatus } = useScannerStream();

  useEffect(() => {
    if (activeDigits.length !== prevDigitsLen.current) {
      prevDigitsLen.current = activeDigits.length;
      setTickPulse(true);
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      pulseTimer.current = setTimeout(() => setTickPulse(false), 220);
    }
  }, [activeDigits.length]);

  useEffect(() => {
    return () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    };
  }, []);

  const bestPick = computeBestPick(scannerData, strategyFilter);
  const activeStreak = computeStreak(activeDigits);
  const frequencies = computeFrequency(activeDigits, windowSize);
  const latestDigit = activeDigits.length > 0 ? activeDigits[activeDigits.length - 1] : null;
  const isConnected = scannerStatus === "connected" || activeStatus === "connected";

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-200 font-mono p-4 flex flex-col gap-6 overflow-x-hidden">

      {/* Header */}
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
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            <span className="uppercase text-slate-400">{isConnected ? "CONNECTED" : scannerStatus.toUpperCase()}</span>
          </div>
        </div>
      </header>

      {/* AI BEST ENTRY PICK */}
      <div className="rounded-xl bg-slate-500/10 backdrop-blur-xl border border-white/10 shadow-[0_-4px_12px_-2px_rgba(245,158,11,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <RadioReceiver className="w-32 h-32 text-amber-500" />
        </div>

        <div className="flex flex-col gap-5 relative z-10">
          {/* Card title + strategy tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-amber-500 font-bold tracking-widest flex items-center gap-2">
              <Activity className="w-5 h-5" /> [AI BEST ENTRY PICK]
            </h2>
            <div className="flex flex-wrap gap-2">
              {STRATEGY_TABS.map(tab => {
                const isActive = strategyFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setStrategyFilter(tab.value)}
                    data-testid={`strategy-tab-${tab.value}`}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all border ${
                      isActive
                        ? "bg-amber-500/20 border-amber-500 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.25)]"
                        : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main readout */}
          {bestPick.score > 0 ? (
            <div className="flex flex-col gap-5">
              {/* Top row: symbol + trade type + auto-switch */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div className="text-4xl font-bold text-white bg-slate-900/50 px-6 py-4 rounded-lg border border-slate-700">
                    {bestPick.symbol}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className={`text-2xl font-bold uppercase tracking-wider ${TRADE_TYPE_COLOR[bestPick.type] ?? "text-white"}`}>
                      {bestPick.type}{bestPick.targetDigit >= 0 ? ` ${bestPick.targetDigit}` : ""}
                    </span>
                    <span className="text-slate-500 text-xs">{bestPick.detail}</span>
                  </div>
                </div>
                <button
                  data-testid="button-auto-switch"
                  onClick={() => setActiveSymbol(bestPick.symbol)}
                  className="px-6 py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 border border-amber-500/50 rounded-lg uppercase tracking-wider font-bold transition-all whitespace-nowrap"
                >
                  [Auto-Switch to Target Market]
                </button>
              </div>

              {/* Target data sub-grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-white/5 pt-4">
                {/* Target Digit badge */}
                <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-700/60 rounded-lg px-4 py-3">
                  <Target className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-slate-500 text-xs uppercase tracking-wider">Target Digit</span>
                    <span className={`font-bold text-lg leading-tight truncate ${TRADE_TYPE_COLOR[bestPick.type] ?? "text-white"}`}>
                      {bestPick.targetDigitLabel}
                    </span>
                  </div>
                </div>

                {/* Duration badge */}
                <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-700/60 rounded-lg px-4 py-3">
                  <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-500 text-xs uppercase tracking-wider">Duration</span>
                    <span className="font-bold text-lg text-white leading-tight">
                      {bestPick.optimalTicks} {bestPick.optimalTicks === 1 ? "Tick" : "Ticks"}
                    </span>
                  </div>
                </div>

                {/* Trade type badge */}
                <div className={`flex items-center gap-3 border rounded-lg px-4 py-3 ${TRADE_TYPE_BG[bestPick.type] ?? "bg-slate-900/50 border-slate-700/60"}`}>
                  <Crosshair className="w-4 h-4 flex-shrink-0 opacity-60" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs uppercase tracking-wider opacity-60">Contract</span>
                    <span className="font-bold text-lg leading-tight uppercase tracking-wider">
                      {bestPick.type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Entry trigger row */}
              <div className="flex items-center gap-3 bg-slate-900/40 border border-slate-700/40 rounded-lg px-4 py-3">
                {/* Tick-sync pulse dot */}
                <div className="relative flex-shrink-0 w-3 h-3">
                  <span className={`absolute inset-0 rounded-full transition-colors duration-75 ${tickPulse ? "bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.6)]" : "bg-emerald-700"}`} />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-slate-500 text-xs uppercase tracking-wider">Entry Point Trigger</span>
                  <span className="text-amber-200/80 text-sm font-medium leading-snug">
                    {bestPick.entryTrigger}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 py-2 uppercase tracking-widest text-sm">
              Scanning markets for high-probability setups...
            </div>
          )}
        </div>
      </div>

      {/* 2-Column Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Even/Odd Parity Terminal */}
        <div className="lg:col-span-1 rounded-xl bg-slate-500/10 backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] p-6 flex flex-col items-center justify-center gap-8">
          <h3 className="text-slate-400 uppercase tracking-widest text-sm w-full text-center">Even/Odd Parity Terminal</h3>

          <div className="relative w-48 h-48 flex items-center justify-center">
            {latestDigit !== null && (
              <motion.div
                key={latestDigit + "-" + activeDigits.length}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`absolute inset-0 rounded-full blur-2xl opacity-20 ${latestDigit % 2 === 0 ? "bg-blue-500" : "bg-amber-500"}`}
              />
            )}
            <span className={`text-8xl font-bold z-10 ${latestDigit !== null && latestDigit % 2 === 0 ? "text-blue-400" : "text-amber-400"}`}>
              {latestDigit !== null ? latestDigit : "-"}
            </span>
          </div>

          <div className="bg-slate-900/50 border border-slate-700 px-6 py-3 rounded-lg text-center w-full">
            <div className="text-sm text-slate-400 uppercase mb-1">
              Active {activeStreak.direction === "NONE" ? "" : activeStreak.direction} Streak
            </div>
            <div className={`text-3xl font-bold ${activeStreak.direction === "EVEN" ? "text-blue-400" : activeStreak.direction === "ODD" ? "text-amber-400" : "text-slate-500"}`}>
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
                  className={`h-12 flex-shrink-0 flex items-center justify-center rounded-sm font-bold text-sm text-slate-950 ${d % 2 === 0 ? "bg-blue-500" : "bg-amber-500"}`}
                >
                  {d}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Right — Matches/Differs Ring Engine */}
        <div className="lg:col-span-2 rounded-xl bg-slate-500/10 backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] p-6">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-slate-400 uppercase tracking-widest text-sm">Matches/Differs Ring Engine</h3>
            <div className="flex gap-2 bg-slate-900/50 p-1 rounded-lg border border-slate-700">
              {([20, 50, 100] as const).map(size => (
                <button
                  key={size}
                  onClick={() => setWindowSize(size)}
                  data-testid={`window-size-${size}`}
                  className={`px-3 py-1 rounded-md text-sm font-bold transition-colors ${windowSize === size ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"}`}
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
              const textColor = isHot ? "text-emerald-500" : isCold ? "text-red-500" : "text-slate-400";
              const ringColor = isHot ? "stroke-emerald-500" : isCold ? "stroke-red-500" : "stroke-slate-500";
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
                      <span className={`text-2xl font-bold ${textColor}`}>{i}</span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{freq.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Multi-Index Scanner Grid */}
      <div className="rounded-xl bg-slate-500/10 backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] p-6">
        <h3 className="text-slate-400 uppercase tracking-widest text-sm mb-6">Multi-Index Scanner</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {ALL_SYMBOLS.map(sym => {
            const symDigits = scannerData[sym] || [];
            const latest = symDigits.length > 0 ? symDigits[symDigits.length - 1] : "-";
            const streak = computeStreak(symDigits);
            const absence = computeAbsence(symDigits);
            const isSevereStreak = streak.count >= 6;
            const isSevereAbsence = absence.count >= 20;
            const isActive = sym === activeSymbol;
            const isBestPick = sym === bestPick.symbol && bestPick.score > 0;

            return (
              <div
                key={sym}
                onClick={() => setActiveSymbol(sym)}
                data-testid={`scanner-cell-${sym}`}
                className={`cursor-pointer border p-3 rounded-lg flex flex-col gap-2 transition-colors ${
                  isActive
                    ? "bg-amber-500/10 border-amber-500/50"
                    : isBestPick
                    ? "bg-purple-500/10 border-purple-500/40 animate-pulse"
                    : isSevereStreak || isSevereAbsence
                    ? "bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50"
                    : "bg-slate-900/50 border-slate-800 hover:border-slate-600"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className={`font-bold text-sm ${isActive ? "text-amber-500" : isBestPick ? "text-purple-400" : "text-slate-300"}`}>
                    {sym}
                  </span>
                  <span className="text-lg font-bold text-white">{latest}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className={`${isSevereStreak ? (streak.direction === "EVEN" ? "text-blue-400" : "text-amber-400") : "text-slate-500"}`}>
                    {streak.direction !== "NONE" ? `${streak.direction[0]}:${streak.count}` : "-"}
                  </span>
                  <span className={`${isSevereAbsence ? "text-purple-400" : "text-slate-500"}`}>
                    {absence.digit >= 0 ? `D${absence.digit}:${absence.count}` : "-"}
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
