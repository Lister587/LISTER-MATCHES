import { useRef, useState, useEffect, useCallback } from "react";
import { X, GripHorizontal } from "lucide-react";
import type { BestPick } from "@/lib/digitAnalytics";
import { SYMBOL_NAMES } from "@/lib/digitAnalytics";

interface Props {
  displayPick: BestPick;
  latestDigit: number | null;
  velocityAdjustedTicks: number;
  tickPulse: boolean;
  onClose: () => void;
}

const TRADE_TYPE_COLOR: Record<string, string> = {
  DIFFERS: "text-purple-400",
  MATCHES: "text-emerald-400",
  EVEN: "text-blue-400",
  ODD: "text-amber-400",
};

export default function FloatingMiniTracker({
  displayPick,
  latestDigit,
  velocityAdjustedTicks,
  tickPulse,
  onClose,
}: Props) {
  const [pos, setPos] = useState({ x: window.innerWidth - 260, y: 80 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 240, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 180, e.clientY - dragOffset.current.y)),
      });
    };
    const onUp = () => { dragging.current = false; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const symbolDisplay = displayPick.symbol
    ? SYMBOL_NAMES[displayPick.symbol] ?? displayPick.symbol
    : "—";

  return (
    <div
      ref={panelRef}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 w-56 rounded-xl bg-slate-950/95 backdrop-blur-xl border border-white/10 shadow-[0_0_24px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.08)] select-none"
    >
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing border-b border-white/5"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-3 h-3 text-slate-600" />
          <span className="text-slate-500 text-xs uppercase tracking-widest font-bold">Mini Tracker</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-600 hover:text-slate-300 transition-colors"
          data-testid="mini-tracker-close"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-3">
        {/* Symbol */}
        <div className="text-center">
          <div className="text-slate-400 text-xs uppercase tracking-wider mb-0.5">Market</div>
          <div className="text-white text-sm font-bold leading-tight">{symbolDisplay}</div>
        </div>

        {/* Live digit + pulse */}
        <div className="flex items-center justify-center gap-3">
          <div className="relative w-5 h-5 flex-shrink-0">
            <span className={`absolute inset-0 rounded-full transition-colors duration-75 ${tickPulse ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" : "bg-emerald-800"}`} />
          </div>
          <span className={`text-5xl font-bold ${latestDigit !== null && latestDigit % 2 === 0 ? "text-blue-400" : "text-amber-400"}`}>
            {latestDigit !== null ? latestDigit : "—"}
          </span>
        </div>

        {/* Best pick details */}
        {displayPick.score > 0 ? (
          <div className="bg-slate-900/60 rounded-lg p-2 flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 text-xs">Trade</span>
              <span className={`font-bold text-sm ${TRADE_TYPE_COLOR[displayPick.type] ?? "text-white"}`}>
                {displayPick.type}{displayPick.targetDigit >= 0 ? ` ${displayPick.targetDigit}` : ""}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 text-xs">Duration</span>
              <span className="text-white font-bold text-sm">{velocityAdjustedTicks}T</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 text-xs">Target Digit</span>
              <span className={`font-bold text-sm ${TRADE_TYPE_COLOR[displayPick.type] ?? "text-white"}`}>
                {displayPick.targetDigitLabel}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-slate-600 text-xs text-center uppercase tracking-wider">Scanning...</div>
        )}
      </div>
    </div>
  );
}
