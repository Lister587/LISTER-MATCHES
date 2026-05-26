import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTickerStream } from "@/hooks/useTickerStream";
import { useScannerStream } from "@/hooks/useScannerStream";
import { useAudio } from "@/hooks/useAudio";
import FloatingMiniTracker from "@/components/FloatingMiniTracker";
import {
  ALL_SYMBOLS,
  SYMBOL_NAMES,
  computeBestPick,
  computeStreak,
  computeAbsence,
  computeFrequency,
  computeHistoryDots,
  computePoissonLayer,
  type StrategyFilter,
  type BestPick,
} from "@/lib/digitAnalytics";
import {
  Activity, RadioReceiver, Zap, Clock, Target, Crosshair,
  Lock, ScanLine, Volume2, VolumeX, PictureInPicture2, Copy, Check,
  AlertTriangle, Trophy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ScannerPhase = "scanning" | "locked";

const STRATEGY_TABS: { label: string; value: StrategyFilter; color: string }[] = [
  { label: "MATCHES ONLY", value: "MATCHES", color: "emerald" },
  { label: "DIFFERS ONLY", value: "DIFFERS", color: "purple" },
  { label: "EVEN ONLY",    value: "EVEN",    color: "blue" },
  { label: "ODD ONLY",     value: "ODD",     color: "amber" },
];

const TAB_ACTIVE_STYLE: Record<string, string> = {
  emerald: "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.2)]",
  purple:  "bg-purple-500/20  border-purple-500  text-purple-400  shadow-[0_0_8px_rgba(168,85,247,0.2)]",
  blue:    "bg-blue-500/20    border-blue-500    text-blue-400    shadow-[0_0_8px_rgba(59,130,246,0.2)]",
  amber:   "bg-amber-500/20   border-amber-500   text-amber-400   shadow-[0_0_8px_rgba(245,158,11,0.2)]",
};

const TRADE_TYPE_COLOR: Record<string, string> = {
  DIFFERS: "text-purple-400",
  MATCHES: "text-emerald-400",
  EVEN:    "text-blue-400",
  ODD:     "text-amber-400",
};

const TRADE_TYPE_BG: Record<string, string> = {
  DIFFERS: "bg-purple-500/15 border-purple-500/30 text-purple-300",
  MATCHES: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
  EVEN:    "bg-blue-500/15    border-blue-500/30    text-blue-300",
  ODD:     "bg-amber-500/15   border-amber-500/30   text-amber-300",
};

const TYPE_CODE: Record<string, string> = {
  DIFFERS: "DIFF", MATCHES: "MTCH", EVEN: "EVEN", ODD: "ODD",
};

const DOT_AGE_CLASS = (age: number) => {
  if (age === 0)   return "bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]";
  if (age <= 2)    return "bg-emerald-500/80";
  if (age <= 5)    return "bg-emerald-700/60";
  if (age <= 10)   return "bg-slate-600/60";
  return "bg-slate-800";
};

const LOCK_RELEASE_DELAY_MS = 1600;

export default function Dashboard() {
  const [activeSymbol, setActiveSymbol]         = useState("R_10");
  const [strategyFilter, setStrategyFilter]     = useState<StrategyFilter>("DIFFERS");
  const [windowSize, setWindowSize]             = useState<20 | 50 | 100>(100);
  const [tickPulse, setTickPulse]               = useState(false);
  const [scannerPhase, setScannerPhase]         = useState<ScannerPhase>("scanning");
  const [lockedPick, setLockedPick]             = useState<BestPick | null>(null);
  const [lockWinCount, setLockWinCount]         = useState(0);
  const [lockTimeElapsed, setLockTimeElapsed]   = useState(0);
  const [lastWinFlash, setLastWinFlash]         = useState(false);
  const [mutationDetected, setMutationDetected] = useState(false);
  const [showMiniTracker, setShowMiniTracker]   = useState(false);
  const [copied, setCopied]                     = useState(false);

  // Stable refs — avoids stale closures in effects
  const scannerPhaseRef   = useRef<ScannerPhase>("scanning");
  const lockedPickRef     = useRef<BestPick | null>(null);
  const lockWinCountRef   = useRef(0);
  const lockStartTimeRef  = useRef(0);
  const prevLockedLenRef  = useRef(0);
  const prevDigitsLenRef  = useRef(0);
  const prevMaxStreakRef  = useRef(0);
  const tickTimestampsRef = useRef<number[]>([]);
  const pulseTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winFlashTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync
  useEffect(() => { scannerPhaseRef.current  = scannerPhase; }, [scannerPhase]);
  useEffect(() => { lockedPickRef.current    = lockedPick;   }, [lockedPick]);
  useEffect(() => { lockWinCountRef.current  = lockWinCount; }, [lockWinCount]);

  const { digits: activeDigits, status: activeStatus } = useTickerStream(activeSymbol);
  const { data: scannerData, status: scannerStatus }   = useScannerStream();
  const { muted, toggleMute, playEven, playOdd, playStreak } = useAudio();

  const isScannerLocked   = scannerPhase === "locked";
  const currentBestPick   = computeBestPick(scannerData, strategyFilter);
  const displayPick       = isScannerLocked && lockedPick ? lockedPick : currentBestPick;

  const activeStreak  = computeStreak(activeDigits);
  const frequencies   = computeFrequency(activeDigits, windowSize);
  const poissonFlags  = computePoissonLayer(activeDigits);
  const latestDigit   = activeDigits.length > 0 ? activeDigits[activeDigits.length - 1] : null;
  const isConnected   = scannerStatus === "connected" || activeStatus === "connected";

  // Tick velocity
  const tickVelocityMs = useMemo(() => {
    const ts = tickTimestampsRef.current;
    if (ts.length < 2) return null;
    const deltas = ts.slice(1).map((t, i) => t - ts[i]);
    return deltas.reduce((a, b) => a + b, 0) / deltas.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDigits.length]);

  // Velocity-adjusted ticks
  const velocityAdjustedTicks = useMemo(() => {
    if (displayPick.score <= 0) return 1;
    let ticks = displayPick.optimalTicks;
    if (tickVelocityMs !== null) {
      if (tickVelocityMs < 500) ticks = Math.max(1, ticks - 1);
      else if (tickVelocityMs > 2000) ticks = Math.min(5, ticks + 1);
    }
    return ticks;
  }, [tickVelocityMs, displayPick]);

  // Execution string
  const execString = displayPick.score > 0
    ? `${SYMBOL_NAMES[displayPick.symbol] ?? displayPick.symbol}-${TYPE_CODE[displayPick.type] ?? displayPick.type}-D${displayPick.targetDigit >= 0 ? displayPick.targetDigit : "P"}-T${velocityAdjustedTicks}`
    : "NO SIGNAL";

  // Release lock (stable, no deps)
  const releaseLock = useCallback(() => {
    setScannerPhase("scanning");
    setLockedPick(null);
    setLockWinCount(0);
    setLockTimeElapsed(0);
    setMutationDetected(false);
    lockWinCountRef.current   = 0;
    prevLockedLenRef.current  = 0;
  }, []);

  // Engage lock
  const handleEngageEdge = useCallback(() => {
    if (currentBestPick.score <= 0) return;
    const pick = currentBestPick;
    setLockedPick(pick);
    setActiveSymbol(pick.symbol);
    setScannerPhase("locked");
    setLockWinCount(0);
    setLockTimeElapsed(0);
    setMutationDetected(false);
    lockStartTimeRef.current  = Date.now();
    lockWinCountRef.current   = 0;
    prevLockedLenRef.current  = (scannerData[pick.symbol] || []).length;
  }, [currentBestPick, scannerData]);

  // Tick pulse + audio (active symbol)
  useEffect(() => {
    if (activeDigits.length <= prevDigitsLenRef.current) return;
    prevDigitsLenRef.current = activeDigits.length;
    tickTimestampsRef.current.push(Date.now());
    if (tickTimestampsRef.current.length > 6) tickTimestampsRef.current.shift();

    const last = activeDigits[activeDigits.length - 1];
    if (last % 2 === 0) playEven(); else playOdd();
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(25);

    setTickPulse(true);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setTickPulse(false), 220);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDigits.length]);

  // Win-signal valve (Module 03): check locked symbol for tick confirmation
  useEffect(() => {
    if (scannerPhaseRef.current !== "locked") return;
    const pick = lockedPickRef.current;
    if (!pick || pick.score <= 0) return;

    const lockedDigits = scannerData[pick.symbol] || [];
    if (lockedDigits.length <= prevLockedLenRef.current) return;

    const newTicks = lockedDigits.slice(prevLockedLenRef.current);
    prevLockedLenRef.current = lockedDigits.length;

    let newWins = 0;
    for (const d of newTicks) {
      const isWin =
        pick.type === "DIFFERS" ? d !== pick.targetDigit :
        pick.type === "MATCHES" ? d === pick.targetDigit :
        pick.type === "EVEN"    ? d % 2 === 0 :
        pick.type === "ODD"     ? d % 2 === 1 : false;
      if (isWin) newWins++;
    }

    if (newWins > 0) {
      const updated = Math.min(lockWinCountRef.current + newWins, 3);
      setLockWinCount(updated);
      setLastWinFlash(true);
      if (winFlashTimerRef.current) clearTimeout(winFlashTimerRef.current);
      winFlashTimerRef.current = setTimeout(() => setLastWinFlash(false), 1500);

      if (updated >= 3) {
        setTimeout(releaseLock, LOCK_RELEASE_DELAY_MS);
      }
    }

    // Mutation detection: target digit appears 2+ times in last 3 ticks on any OTHER symbol
    if (pick.targetDigit >= 0) {
      for (const sym of ALL_SYMBOLS) {
        if (sym === pick.symbol) continue;
        const last3 = (scannerData[sym] || []).slice(-3);
        if (last3.filter(d => d === pick.targetDigit).length >= 2) {
          setMutationDetected(true);
          break;
        }
      }
    }
  }, [scannerData, releaseLock]);

  // Persistent edge timer — Module 04: 60s clock
  useEffect(() => {
    if (scannerPhase !== "locked") return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lockStartTimeRef.current) / 1000);
      setLockTimeElapsed(elapsed);
      if (elapsed >= 60) {
        releaseLock();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [scannerPhase, releaseLock]);

  // Streak milestone audio
  useEffect(() => {
    let maxStreak = 0;
    for (const sym of ALL_SYMBOLS) {
      const { count } = computeStreak(scannerData[sym] || []);
      if (count > maxStreak) maxStreak = count;
    }
    if (maxStreak >= 5 && maxStreak > prevMaxStreakRef.current) {
      prevMaxStreakRef.current = maxStreak;
      playStreak();
    } else if (maxStreak < 5) {
      prevMaxStreakRef.current = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerData]);

  // Cleanup
  useEffect(() => () => {
    if (pulseTimerRef.current)   clearTimeout(pulseTimerRef.current);
    if (winFlashTimerRef.current) clearTimeout(winFlashTimerRef.current);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(execString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, [execString]);

  const timeRemaining = Math.max(0, 60 - lockTimeElapsed);
  const timerPct      = timeRemaining / 60;

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-200 font-mono p-4 flex flex-col gap-6 overflow-x-hidden">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-500/10 backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
        <div className="flex items-center gap-3">
          <Zap className="text-amber-500 w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight uppercase text-white drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">
            Deriv Market Scanner
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <button onClick={toggleMute} data-testid="button-mute-toggle"
            className="p-2 rounded-lg border border-slate-700 bg-slate-900/50 hover:border-slate-500 transition-colors">
            {muted
              ? <VolumeX className="w-4 h-4 text-slate-500" />
              : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
          <button onClick={() => setShowMiniTracker(v => !v)} data-testid="button-popout"
            className={`px-3 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${
              showMiniTracker
                ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500"
            }`}>
            <PictureInPicture2 className="w-3 h-3" />
            {showMiniTracker ? "Close Mini" : "[Pop-Out Mini Tracker]"}
          </button>
          <select value={activeSymbol} onChange={(e) => setActiveSymbol(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg outline-none focus:border-amber-500 transition-colors font-bold max-w-[200px]">
            {ALL_SYMBOLS.map(sym => (
              <option key={sym} value={sym}>{SYMBOL_NAMES[sym] ?? sym}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            <span className="uppercase text-slate-400">{isConnected ? "CONNECTED" : scannerStatus.toUpperCase()}</span>
          </div>
        </div>
      </header>

      {/* ── AI BEST ENTRY PICK ──────────────────────────────────────── */}
      <div className={`rounded-xl bg-slate-500/10 backdrop-blur-xl border transition-all p-6 relative overflow-hidden ${
        mutationDetected && isScannerLocked
          ? "border-rose-500/60 shadow-[0_-4px_12px_-2px_rgba(244,63,94,0.3),inset_0_1px_1px_rgba(255,255,255,0.1)]"
          : "border-white/10 shadow-[0_-4px_12px_-2px_rgba(245,158,11,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)]"
      }`}>
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <RadioReceiver className="w-32 h-32 text-amber-500" />
        </div>

        <div className="flex flex-col gap-5 relative z-10">

          {/* Title + status + strategy tabs */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {isScannerLocked
                ? <Lock className="w-4 h-4 text-rose-400 flex-shrink-0" />
                : <ScanLine className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
              <div>
                <h2 className="text-amber-500 font-bold tracking-widest flex items-center gap-2">
                  <Activity className="w-5 h-5" /> [AI BEST ENTRY PICK]
                </h2>
                <p className={`text-xs uppercase tracking-wider mt-0.5 ${isScannerLocked ? "text-rose-400/70" : "text-emerald-400/70"}`}>
                  {isScannerLocked ? "LOCKED ON CURRENT VOLATILITY" : "SCANNING ALL VOLATILE INDEXES..."}
                </p>
              </div>
            </div>

            {/* Strategy tabs — 4 independent channels */}
            <div className="flex flex-wrap gap-2">
              {STRATEGY_TABS.map(tab => {
                const isActive = strategyFilter === tab.value;
                return (
                  <button key={tab.value} onClick={() => { setStrategyFilter(tab.value); if (isScannerLocked) releaseLock(); }}
                    data-testid={`strategy-tab-${tab.value}`}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all border ${
                      isActive
                        ? TAB_ACTIVE_STYLE[tab.color]
                        : "bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300"
                    }`}>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main readout */}
          {displayPick.score > 0 ? (
            <div className="flex flex-col gap-5">

              {/* Symbol + type + CTA button row */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Market</div>
                    <div className="text-xl font-bold text-white bg-slate-900/50 px-4 py-3 rounded-lg border border-slate-700 leading-tight whitespace-nowrap">
                      {SYMBOL_NAMES[displayPick.symbol] ?? displayPick.symbol}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 pt-4">
                    <span className={`text-2xl font-bold uppercase tracking-wider ${TRADE_TYPE_COLOR[displayPick.type] ?? "text-white"}`}>
                      {displayPick.type}{displayPick.targetDigit >= 0 ? ` ${displayPick.targetDigit}` : ""}
                    </span>
                    <span className="text-slate-500 text-xs">{displayPick.detail}</span>
                  </div>
                </div>

                {isScannerLocked ? (
                  <div className="flex flex-col items-end gap-2">
                    <button data-testid="button-unlock" onClick={releaseLock}
                      className="px-5 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg uppercase tracking-wider font-bold transition-all whitespace-nowrap text-sm">
                      [Unlock Next Market Scan]
                    </button>
                    {mutationDetected && (
                      <div className="flex items-center gap-2 text-xs text-rose-400 animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        MARKET MUTATION DETECTED — CONSIDER REFRESHING
                      </div>
                    )}
                  </div>
                ) : (
                  <button data-testid="button-engage" onClick={handleEngageEdge}
                    disabled={currentBestPick.score <= 0}
                    className="px-6 py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 border border-amber-500/50 rounded-lg uppercase tracking-wider font-bold transition-all whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed">
                    [Engage Current Highest Edge]
                  </button>
                )}
              </div>

              {/* Module 04 — Win-progress + 60s timer panel (locked only) */}
              {isScannerLocked && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/50 border border-slate-700/60 rounded-xl p-4">

                  {/* Win counter */}
                  <div className="flex flex-col gap-3">
                    <span className="text-slate-500 text-xs uppercase tracking-wider flex items-center gap-2">
                      <Trophy className="w-3 h-3" /> Win Progress
                    </span>
                    <div className="flex gap-2">
                      {[0, 1, 2].map(i => (
                        <div key={i} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                          i < lockWinCount
                            ? "bg-emerald-500/30 border-emerald-400"
                            : "bg-slate-800 border-slate-600"
                        }`}>
                          {i < lockWinCount && <Check className="w-4 h-4 text-emerald-400" />}
                        </div>
                      ))}
                    </div>
                    <span className={`font-bold text-sm ${lockWinCount > 0 ? "text-emerald-400" : "text-slate-500"}`}>
                      {lockWinCount} / 3 CONFIRMED WINS
                    </span>
                  </div>

                  {/* 60s timer */}
                  <div className="flex flex-col gap-2 items-center justify-center">
                    <span className="text-slate-500 text-xs uppercase tracking-wider">Lock Timer</span>
                    <div className="relative w-20 h-20">
                      <svg className="w-full h-full -rotate-90">
                        <circle cx="40" cy="40" r="32" className="stroke-slate-800 fill-none" strokeWidth="5" />
                        <circle cx="40" cy="40" r="32"
                          className={`fill-none transition-all duration-500 ${timeRemaining > 15 ? "stroke-amber-500" : "stroke-rose-500"}`}
                          strokeWidth="5"
                          strokeDasharray={2 * Math.PI * 32}
                          strokeDashoffset={(1 - timerPct) * 2 * Math.PI * 32} />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-2xl font-bold leading-none ${timeRemaining > 15 ? "text-amber-400" : "text-rose-400"}`}>
                          {timeRemaining}
                        </span>
                        <span className="text-slate-600 text-xs">sec</span>
                      </div>
                    </div>
                    <span className="text-slate-500 text-xs">until auto-release</span>
                  </div>

                  {/* Win flash / status */}
                  <div className="flex flex-col gap-2 justify-center items-end sm:items-center">
                    <span className="text-slate-500 text-xs uppercase tracking-wider">Signal Status</span>
                    <AnimatePresence mode="wait">
                      {lastWinFlash ? (
                        <motion.div key="win"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center gap-1">
                          <span className="text-emerald-400 font-bold text-lg">WIN CONFIRMED!</span>
                          <span className="text-emerald-500/70 text-xs">{lockWinCount} of 3 complete</span>
                        </motion.div>
                      ) : (
                        <motion.div key="wait"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${tickPulse ? "bg-emerald-400" : "bg-slate-700"} transition-colors duration-75`} />
                          <span className="text-slate-400 text-sm font-medium">AWAITING TICK...</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Target sub-grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-white/5 pt-4">
                <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-700/60 rounded-lg px-4 py-3">
                  <Target className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-slate-500 text-xs uppercase tracking-wider">Target Digit</span>
                    <span className={`font-bold text-lg leading-tight ${TRADE_TYPE_COLOR[displayPick.type] ?? "text-white"}`}>
                      {displayPick.targetDigitLabel}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-700/60 rounded-lg px-4 py-3">
                  <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-500 text-xs uppercase tracking-wider">
                      Duration{tickVelocityMs !== null ? ` · ${tickVelocityMs < 500 ? "fast" : tickVelocityMs > 2000 ? "slow" : "normal"}` : ""}
                    </span>
                    <span className="font-bold text-lg text-white leading-tight">
                      {velocityAdjustedTicks} {velocityAdjustedTicks === 1 ? "Tick" : "Ticks"}
                    </span>
                  </div>
                </div>
                <div className={`flex items-center gap-3 border rounded-lg px-4 py-3 ${TRADE_TYPE_BG[displayPick.type] ?? "bg-slate-900/50 border-slate-700/60"}`}>
                  <Crosshair className="w-4 h-4 flex-shrink-0 opacity-60" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs uppercase tracking-wider opacity-60">Contract</span>
                    <span className="font-bold text-lg leading-tight uppercase tracking-wider">{displayPick.type}</span>
                  </div>
                </div>
              </div>

              {/* Entry trigger */}
              <div className="flex items-center gap-3 bg-slate-900/40 border border-slate-700/40 rounded-lg px-4 py-3">
                <div className="relative flex-shrink-0 w-3 h-3">
                  <span className={`absolute inset-0 rounded-full transition-colors duration-75 ${tickPulse ? "bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.6)]" : "bg-emerald-800"}`} />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-slate-500 text-xs uppercase tracking-wider">Entry Point Trigger</span>
                  <span className="text-amber-200/80 text-sm font-medium leading-snug">{displayPick.entryTrigger}</span>
                </div>
              </div>

              {/* Execution string */}
              <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-700/50 rounded-lg px-4 py-3">
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-slate-500 text-xs uppercase tracking-wider">[Execution String]</span>
                  <span className="text-emerald-300/90 text-sm font-bold tracking-wide truncate">{execString}</span>
                </div>
                <button onClick={handleCopy} data-testid="button-copy-exec"
                  className="flex-shrink-0 p-2 rounded-md border border-slate-700 bg-slate-800/50 hover:border-slate-500 transition-colors">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 py-2 uppercase tracking-widest text-sm">
              Scanning {Object.keys(scannerData).length} / {ALL_SYMBOLS.length} markets for high-probability setups...
            </div>
          )}
        </div>
      </div>

      {/* ── 2-Column Analytics ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Even/Odd Parity Terminal */}
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
              {latestDigit !== null ? latestDigit : "—"}
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
                <motion.div key={`${arr.length - i}-${d}`}
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 24, opacity: 1 }}
                  className={`h-12 flex-shrink-0 flex items-center justify-center rounded-sm font-bold text-sm text-slate-950 ${d % 2 === 0 ? "bg-blue-500" : "bg-amber-500"}`}>
                  {d}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Matches/Differs Ring Engine */}
        <div className="lg:col-span-2 rounded-xl bg-slate-500/10 backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] p-6">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-slate-400 uppercase tracking-widest text-sm">Matches/Differs Ring Engine</h3>
            <div className="flex gap-2 bg-slate-900/50 p-1 rounded-lg border border-slate-700">
              {([20, 50, 100] as const).map(size => (
                <button key={size} onClick={() => setWindowSize(size)} data-testid={`window-size-${size}`}
                  className={`px-3 py-1 rounded-md text-sm font-bold transition-colors ${windowSize === size ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"}`}>
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
              const isMutating = poissonFlags[i];
              const textColor = isHot ? "text-emerald-500" : isCold ? "text-red-500" : "text-slate-400";
              const ringColor = isHot ? "stroke-emerald-500" : isCold ? "stroke-red-500" : "stroke-slate-500";
              const dashArray = 2 * Math.PI * 30;
              const dashOffset = dashArray - (dashArray * freq) / 100;
              const historyDots = computeHistoryDots(activeDigits, i);

              return (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="relative w-20 h-20">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="40" cy="40" r="30" className="stroke-slate-800 fill-none" strokeWidth="6" />
                      <circle cx="40" cy="40" r="30"
                        className={`fill-none transition-all duration-500 ${ringColor}`}
                        strokeWidth="6"
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-2xl font-bold ${textColor}`}>{i}</span>
                    </div>
                    {isMutating && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.8)]" title="Mutation imminent — cooling off period approaching" />
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{freq.toFixed(1)}%</span>
                  <div className="flex gap-1 items-center">
                    {historyDots.map((age, di) => (
                      <div key={di} className={`w-2 h-2 rounded-full transition-all duration-300 ${DOT_AGE_CLASS(age)}`}
                        title={age < 999 ? `${age} ticks ago` : "not recent"} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Multi-Index Scanner Grid ─────────────────────────────────── */}
      <div className="rounded-xl bg-slate-500/10 backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-slate-400 uppercase tracking-widest text-sm">Volatility Index Scanner</h3>
          <span className="text-slate-600 text-xs uppercase tracking-wider">{ALL_SYMBOLS.length} core markets</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {ALL_SYMBOLS.map(sym => {
            const symDigits = scannerData[sym] || [];
            const latest = symDigits.length > 0 ? symDigits[symDigits.length - 1] : "—";
            const streak = computeStreak(symDigits);
            const absence = computeAbsence(symDigits);
            const isSevereStreak = streak.count >= 6;
            const isSevereAbsence = absence.count >= 20;
            const isActive = sym === activeSymbol;
            const isBestPick = sym === displayPick.symbol && displayPick.score > 0;

            return (
              <div key={sym} onClick={() => setActiveSymbol(sym)}
                data-testid={`scanner-cell-${sym}`}
                className={`cursor-pointer border p-3 rounded-lg flex flex-col gap-2 transition-colors ${
                  isActive
                    ? "bg-amber-500/10 border-amber-500/50"
                    : isBestPick
                    ? "bg-purple-500/10 border-purple-500/40 animate-pulse"
                    : isSevereStreak || isSevereAbsence
                    ? "bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50"
                    : "bg-slate-900/50 border-slate-800 hover:border-slate-600"
                }`}>
                <div className="flex justify-between items-center">
                  <span className={`font-bold text-xs ${isActive ? "text-amber-500" : isBestPick ? "text-purple-400" : "text-slate-300"}`}>
                    {sym.startsWith("1HZ") ? sym.replace("1HZ", "").replace("V", "") + " 1s" : sym.replace("R_", "Vol ")}
                  </span>
                  <span className="text-lg font-bold text-white">{latest}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className={`${isSevereStreak ? (streak.direction === "EVEN" ? "text-blue-400" : "text-amber-400") : "text-slate-600"}`}>
                    {streak.direction !== "NONE" ? `${streak.direction[0]}:${streak.count}` : "—"}
                  </span>
                  <span className={`${isSevereAbsence ? "text-purple-400" : "text-slate-600"}`}>
                    {absence.digit >= 0 ? `D${absence.digit}:${absence.count}` : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Floating Mini Tracker ───────────────────────────────────── */}
      {showMiniTracker && (
        <FloatingMiniTracker
          displayPick={displayPick}
          latestDigit={latestDigit}
          velocityAdjustedTicks={velocityAdjustedTicks}
          tickPulse={tickPulse}
          onClose={() => setShowMiniTracker(false)}
        />
      )}
    </div>
  );
}
