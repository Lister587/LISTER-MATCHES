import { useRef, useState } from "react";

export const useAudio = () => {
  const [muted, setMuted] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = (): AudioContext | null => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext();
      }
      if (ctxRef.current.state === "suspended") {
        ctxRef.current.resume();
      }
      return ctxRef.current;
    } catch {
      return null;
    }
  };

  const playTone = (
    freq: number,
    duration: number,
    gain = 0.12,
    type: OscillatorType = "sine"
  ) => {
    if (muted) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = type;
      osc.frequency.value = freq;
      gainNode.gain.setValueAtTime(gain, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration + 0.01);
    } catch {
      // ignore audio errors
    }
  };

  const playEven = () => playTone(880, 0.02, 0.1, "square");
  const playOdd = () => playTone(220, 0.03, 0.1, "sine");
  const playStreak = () => playTone(660, 0.15, 0.14, "triangle");

  const toggleMute = () => setMuted(m => !m);

  return { muted, toggleMute, playEven, playOdd, playStreak };
};
