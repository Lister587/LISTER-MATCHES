export const ALL_SYMBOLS = [
  "R_10", "R_25", "R_50", "R_75", "R_100",
  "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
  "BOOM300N", "BOOM500", "BOOM1000",
  "CRASH300N", "CRASH500", "CRASH1000",
  "stpRNG", "RBREUR", "RBREU200",
];

export type StrategyFilter = "ALL" | "MATCHES" | "DIFFERS" | "EVEN_ODD";
export type TradeType = "MATCHES" | "DIFFERS" | "EVEN" | "ODD" | "";

export interface BestPick {
  symbol: string;
  score: number;
  type: TradeType;
  targetDigit: number;
  detail: string;
}

export const extractDigit = (quote: number): number => {
  return parseInt(String(quote).replace('.', '').slice(-1));
};

export const computeStreak = (digits: number[]) => {
  if (digits.length === 0) return { direction: "NONE" as const, count: 0 };

  const isEven = (d: number) => d % 2 === 0;
  const lastIsEven = isEven(digits[digits.length - 1]);
  let count = 0;

  for (let i = digits.length - 1; i >= 0; i--) {
    if (isEven(digits[i]) === lastIsEven) {
      count++;
    } else {
      break;
    }
  }

  return { direction: lastIsEven ? "EVEN" as const : "ODD" as const, count };
};

export const computeAbsence = (digits: number[]) => {
  const absences = Array(10).fill(0);
  for (let i = 0; i < 10; i++) {
    let absentCount = 0;
    for (let j = digits.length - 1; j >= 0; j--) {
      if (digits[j] !== i) {
        absentCount++;
      } else {
        break;
      }
    }
    absences[i] = absentCount;
  }

  let maxAbsence = -1;
  let mostAbsentDigit = -1;
  for (let i = 0; i < 10; i++) {
    if (absences[i] > maxAbsence) {
      maxAbsence = absences[i];
      mostAbsentDigit = i;
    }
  }

  return { digit: mostAbsentDigit, count: maxAbsence, all: absences };
};

export const computeFrequency = (digits: number[], windowSize: number) => {
  const windowDigits = digits.slice(-windowSize);
  const freqs = Array(10).fill(0);
  if (windowDigits.length === 0) return freqs;

  for (const d of windowDigits) {
    freqs[d]++;
  }

  return freqs.map(f => (f / windowDigits.length) * 100);
};

const computeMatchesEdge = (digits: number[]): { digit: number; score: number } => {
  if (digits.length < 10) return { digit: -1, score: -1 };

  let bestDigit = -1;
  let bestScore = -1;

  for (const window of [20, 50] as const) {
    const freqs = computeFrequency(digits, window);
    for (let d = 0; d < 10; d++) {
      if (freqs[d] > 18 && freqs[d] > bestScore) {
        bestScore = freqs[d];
        bestDigit = d;
      }
    }
  }

  return { digit: bestDigit, score: bestScore };
};

export const computeBestPick = (
  scannerData: Record<string, number[]>,
  filter: StrategyFilter = "ALL"
): BestPick => {
  const empty: BestPick = { symbol: "", score: -1, type: "", targetDigit: -1, detail: "" };

  let best: BestPick = { ...empty };

  for (const symbol of ALL_SYMBOLS) {
    const digits = scannerData[symbol] || [];
    if (digits.length < 5) continue;

    const streak = computeStreak(digits);
    const absence = computeAbsence(digits);
    const matchesEdge = computeMatchesEdge(digits);

    const candidates: BestPick[] = [];

    if (filter === "ALL" || filter === "DIFFERS") {
      if (absence.count >= 20) {
        candidates.push({
          symbol,
          score: absence.count,
          type: "DIFFERS",
          targetDigit: absence.digit,
          detail: `Digit ${absence.digit} absent ${absence.count} ticks`,
        });
      }
    }

    if (filter === "ALL" || filter === "MATCHES") {
      if (matchesEdge.score >= 18) {
        candidates.push({
          symbol,
          score: matchesEdge.score,
          type: "MATCHES",
          targetDigit: matchesEdge.digit,
          detail: `Digit ${matchesEdge.digit} at ${matchesEdge.score.toFixed(1)}% frequency`,
        });
      }
    }

    if (filter === "ALL" || filter === "EVEN_ODD") {
      if (streak.count >= 6) {
        const entryType: TradeType = streak.direction === "ODD" ? "EVEN" : "ODD";
        candidates.push({
          symbol,
          score: streak.count,
          type: entryType,
          targetDigit: -1,
          detail: `${streak.count} consecutive ${streak.direction} — fade with ${entryType}`,
        });
      }
    }

    for (const c of candidates) {
      if (c.score > best.score) {
        best = c;
      }
    }
  }

  return best;
};
