export const ALL_SYMBOLS = [
  "R_10", "R_25", "R_50", "R_75", "R_100",
  "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
  "BOOM300N", "BOOM500", "BOOM1000",
  "CRASH300N", "CRASH500", "CRASH1000",
  "stpRNG", "RBREUR", "RBREU200",
];

export const extractDigit = (quote: number): number => {
  return parseInt(String(quote).replace('.','').slice(-1));
};

export const computeStreak = (digits: number[]) => {
  if (digits.length === 0) return { direction: "NONE", count: 0 };
  
  const isEven = (d: number) => d % 2 === 0;
  const firstIsEven = isEven(digits[digits.length - 1]);
  let count = 0;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    if (isEven(digits[i]) === firstIsEven) {
      count++;
    } else {
      break;
    }
  }
  
  return {
    direction: firstIsEven ? "EVEN" : "ODD",
    count
  };
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
  
  return { digit: mostAbsentDigit, count: maxAbsence };
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

export const computeBestPick = (scannerData: Record<string, number[]>) => {
  let bestSymbol = "";
  let bestScore = -1;
  let tradeType = "";
  let targetDigit = -1;
  
  for (const symbol of ALL_SYMBOLS) {
    const digits = scannerData[symbol] || [];
    if (digits.length === 0) continue;
    
    const streak = computeStreak(digits);
    const absence = computeAbsence(digits);
    
    let currentScore = -1;
    let currentType = "";
    let currentTargetDigit = -1;
    
    if (streak.count >= 5 && streak.count > currentScore) {
      currentScore = streak.count;
      currentType = streak.direction;
    }
    
    if (absence.count >= 20 && absence.count > currentScore) {
      currentScore = absence.count;
      currentType = "DIFFERS";
      currentTargetDigit = absence.digit;
    }
    
    if (currentScore > bestScore) {
      bestScore = currentScore;
      bestSymbol = symbol;
      tradeType = currentType;
      targetDigit = currentTargetDigit;
    }
  }
  
  return { symbol: bestSymbol, score: bestScore, type: tradeType, targetDigit };
};
