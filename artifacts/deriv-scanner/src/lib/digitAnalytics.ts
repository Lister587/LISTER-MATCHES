export const ALL_SYMBOLS = [
  "R_10", "R_25", "R_50", "R_75", "R_100",
  "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
];

export const SYMBOL_NAMES: Record<string, string> = {
  R_10: "Volatility 10 Index",
  R_25: "Volatility 25 Index",
  R_50: "Volatility 50 Index",
  R_75: "Volatility 75 Index",
  R_100: "Volatility 100 Index",
  "1HZ10V": "Volatility 10 (1s) Index",
  "1HZ25V": "Volatility 25 (1s) Index",
  "1HZ50V": "Volatility 50 (1s) Index",
  "1HZ75V": "Volatility 75 (1s) Index",
  "1HZ100V": "Volatility 100 (1s) Index",
};

export type StrategyFilter = "MATCHES" | "DIFFERS" | "EVEN" | "ODD";
export type TradeType = "MATCHES" | "DIFFERS" | "EVEN" | "ODD" | "";

export interface BestPick {
  symbol: string;
  score: number;
  type: TradeType;
  targetDigit: number;
  detail: string;
  targetDigitLabel: string;
  optimalTicks: number;
  entryTrigger: string;
}

export const extractDigit = (quote: number): number =>
  parseInt(String(quote).replace(".", "").slice(-1));

export const computeStreak = (digits: number[]) => {
  if (digits.length === 0) return { direction: "NONE" as const, count: 0 };
  const isEven = (d: number) => d % 2 === 0;
  const lastIsEven = isEven(digits[digits.length - 1]);
  let count = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    if (isEven(digits[i]) === lastIsEven) count++;
    else break;
  }
  return { direction: lastIsEven ? "EVEN" as const : "ODD" as const, count };
};

export const computeAbsence = (digits: number[]) => {
  const absences = Array(10).fill(0);
  for (let i = 0; i < 10; i++) {
    let n = 0;
    for (let j = digits.length - 1; j >= 0; j--) {
      if (digits[j] !== i) n++;
      else break;
    }
    absences[i] = n;
  }
  let maxAbsence = -1;
  let mostAbsentDigit = -1;
  for (let i = 0; i < 10; i++) {
    if (absences[i] > maxAbsence) { maxAbsence = absences[i]; mostAbsentDigit = i; }
  }
  return { digit: mostAbsentDigit, count: maxAbsence, all: absences };
};

export const computeFrequency = (digits: number[], windowSize: number) => {
  const w = digits.slice(-windowSize);
  const freqs = Array(10).fill(0);
  if (w.length === 0) return freqs;
  for (const d of w) freqs[d]++;
  return freqs.map(f => (f / w.length) * 100);
};

export const computeHistoryDots = (digits: number[], targetDigit: number): number[] => {
  const appearances: number[] = [];
  for (let i = digits.length - 1; i >= 0 && appearances.length < 5; i--) {
    if (digits[i] === targetDigit) appearances.push(digits.length - 1 - i);
  }
  while (appearances.length < 5) appearances.push(999);
  return appearances;
};

export const computePoissonLayer = (digits: number[]): boolean[] => {
  if (digits.length < 20) return Array(10).fill(false);
  const baseline = computeFrequency(digits, Math.min(digits.length, 100));
  const short = computeFrequency(digits, 20);
  return short.map((f, i) => f > 22 && f > baseline[i] * 1.4);
};

const differsOptimalTicks = (n: number) => n >= 30 ? 1 : n >= 25 ? 2 : 5;
const matchesOptimalTicks = (f: number) => f >= 28 ? 1 : f >= 22 ? 2 : 5;
const parityOptimalTicks = (n: number) => n >= 8 ? 1 : n >= 6 ? 2 : 3;

const computeMatchesEdge = (digits: number[]) => {
  if (digits.length < 10) return { digit: -1, score: -1, freq: 0 };
  let bestDigit = -1, bestScore = -1, bestFreq = 0;
  for (const window of [20, 50] as const) {
    const freqs = computeFrequency(digits, window);
    for (let d = 0; d < 10; d++) {
      if (freqs[d] > 18 && freqs[d] > bestScore) {
        bestScore = freqs[d]; bestDigit = d; bestFreq = freqs[d];
      }
    }
  }
  return { digit: bestDigit, score: bestScore, freq: bestFreq };
};

export const computeBestPick = (
  scannerData: Record<string, number[]>,
  filter: StrategyFilter
): BestPick => {
  const empty: BestPick = {
    symbol: "", score: -1, type: "", targetDigit: -1,
    detail: "", targetDigitLabel: "—", optimalTicks: 1, entryTrigger: "",
  };
  let best: BestPick = { ...empty };

  for (const symbol of ALL_SYMBOLS) {
    const digits = scannerData[symbol] || [];
    if (digits.length < 5) continue;

    let candidate: BestPick | null = null;

    if (filter === "DIFFERS") {
      const absence = computeAbsence(digits);
      if (absence.count >= 20) {
        const ticks = differsOptimalTicks(absence.count);
        candidate = {
          symbol, score: absence.count, type: "DIFFERS",
          targetDigit: absence.digit,
          detail: `Digit ${absence.digit} absent ${absence.count} ticks`,
          targetDigitLabel: String(absence.digit),
          optimalTicks: ticks,
          entryTrigger: `Wait for digit ${absence.digit} to appear once, then enter Differs`,
        };
      }
    }

    if (filter === "MATCHES") {
      const me = computeMatchesEdge(digits);
      if (me.score >= 18) {
        const ticks = matchesOptimalTicks(me.freq);
        candidate = {
          symbol, score: me.score, type: "MATCHES",
          targetDigit: me.digit,
          detail: `Digit ${me.digit} at ${me.freq.toFixed(1)}% frequency`,
          targetDigitLabel: String(me.digit),
          optimalTicks: ticks,
          entryTrigger: `Enter immediately — digit ${me.digit} at ${me.freq.toFixed(1)}% frequency`,
        };
      }
    }

    if (filter === "EVEN") {
      const streak = computeStreak(digits);
      if (streak.direction === "ODD" && streak.count >= 6) {
        const ticks = parityOptimalTicks(streak.count);
        candidate = {
          symbol, score: streak.count, type: "EVEN",
          targetDigit: -1,
          detail: `${streak.count} consecutive ODD — fade with EVEN`,
          targetDigitLabel: "N/A (Parity Trade)",
          optimalTicks: ticks,
          entryTrigger: `Enter immediately — ${streak.count}x ODD streak, buy EVEN recovery`,
        };
      }
    }

    if (filter === "ODD") {
      const streak = computeStreak(digits);
      if (streak.direction === "EVEN" && streak.count >= 6) {
        const ticks = parityOptimalTicks(streak.count);
        candidate = {
          symbol, score: streak.count, type: "ODD",
          targetDigit: -1,
          detail: `${streak.count} consecutive EVEN — fade with ODD`,
          targetDigitLabel: "N/A (Parity Trade)",
          optimalTicks: ticks,
          entryTrigger: `Enter immediately — ${streak.count}x EVEN streak, buy ODD recovery`,
        };
      }
    }

    if (candidate && candidate.score > best.score) best = candidate;
  }

  return best;
};
