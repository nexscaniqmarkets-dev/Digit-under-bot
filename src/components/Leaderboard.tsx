import { SymbolState, SYMBOLS, BotConfig } from "../types";

interface LeaderboardProps {
  symbolStates: Record<string, SymbolState>;
  activeSymbol: string | null;
  inspectSymbol: string;
  setInspectSymbol: (symbol: string) => void;
  config: BotConfig;
}

export default function Leaderboard({ symbolStates, activeSymbol, inspectSymbol, setInspectSymbol, config }: LeaderboardProps) {
  const capacity = config.analysisTickCount;

  const symbolList = SYMBOLS.map(({ symbol, name }) => {
    const s = symbolStates[symbol];
    if (s) return s;
    return { symbol, displayName: name, buffer: [], underPct: 0, overPct: 0, evenPct: 0, oddPct: 0, signalStrength: "SCANNING..." as const, confirmationCounter: 0, digitFreq: {}, digitPct: {}, lastDigit: null, qualified: false, tickCount: 0, lastTickTime: 0, isClosed: false, evenOddStreakType: null, evenOddStreakCount: 0, parityPatternEven: 0, parityPatternOdd: 0 };
  });

  const isEvenOdd = (config.strategy ?? "under") === "evenodd";

  const sorted = [...symbolList].sort((a, b) => {
    const aW = a.buffer.length >= capacity, bW = b.buffer.length >= capacity;
    const aScore = isEvenOdd ? Math.max((a as any).evenPct ?? 0, (a as any).oddPct ?? 0) : a.underPct;
    const bScore = isEvenOdd ? Math.max((b as any).evenPct ?? 0, (b as any).oddPct ?? 0) : b.underPct;
    if (aW && bW) return bScore - aScore;
    if (aW && !bW) return -1;
    if (!aW && bW) return 1;
    return b.buffer.length - a.buffer.length;
  });

  const getStrengthStyle = (strength: string) => {
    switch (strength) {
      case "VERY STRONG": return "bg-[#ffdea5] text-[#4e3700]";
      case "STRONG":      return "bg-[#d5e0f7] text-[#485e8b]";
      case "MODERATE":    return "bg-amber-100 text-amber-700";
      case "WEAK":        return "bg-[#f5ede4] text-[#7f7667]";
      default:            return "bg-[#f5ede4] text-[#7f7667]";
    }
  };

  // Compute parity win rate from pattern counts
  const getParityRate = (even: number, odd: number, side: "EVEN" | "ODD") => {
    const total = even + odd;
    if (total === 0) return null;
    return Math.round(((side === "EVEN" ? even : odd) / total) * 100);
  };

  const parityColor = (rate: number | null) => {
    if (rate === null) return "text-[#7f7667]";
    if (rate >= 60) return "text-[#2d7a3a] font-bold";
    if (rate >= 50) return "text-[#775a19]";
    return "text-[#c0392b]";
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden shadow-sm animate-fade-in">
      <div className="flex justify-between items-center px-4 py-3 bg-[#f5ede4] border-b border-[#d1c5b4]">
        <h2 className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.15em]">VOLATILITY SCANNER</h2>
        <span className="text-[10px] font-bold text-[#775a19] uppercase tracking-wider">LIVE REFRESH</span>
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-[#d1c5b4]/50 bg-[#fbf2e9]">
            <th className="px-2 py-2 text-[9px] font-bold text-[#4e4639] uppercase tracking-[0.08em]">Asset</th>
            <th className="px-1 py-2 text-[9px] font-bold text-[#4e4639] uppercase tracking-[0.08em] text-right">
              {isEvenOdd ? "Dom%" : "Under%"}
            </th>
            {isEvenOdd ? (
              <>
                <th className="px-1 py-2 text-[9px] font-bold text-[#4e4639] uppercase tracking-[0.08em] text-center">Sig</th>
                <th className="px-1 py-2 text-[9px] font-bold text-[#775a19] uppercase tracking-[0.08em] text-right">E%</th>
                <th className="px-1 py-2 text-[9px] font-bold text-[#7f7667] uppercase tracking-[0.08em] text-right">O%</th>
              </>
            ) : (
              <>
                <th className="px-2 py-2 text-[9px] font-bold text-[#4e4639] uppercase tracking-[0.08em] text-center">Signal</th>
                <th className="px-2 py-2 text-[9px] font-bold text-[#4e4639] uppercase tracking-[0.08em] text-right">Digit</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#d1c5b4]/20">
          {sorted.map((sym) => {
            const isActive = activeSymbol === sym.symbol;
            const isSelected = inspectSymbol === sym.symbol;
            const isWarmed = sym.buffer.length >= capacity;
            const pe = (sym as any).parityPatternEven ?? 0;
            const po = (sym as any).parityPatternOdd ?? 0;
            const eRate = getParityRate(pe, po, "EVEN");
            const oRate = getParityRate(pe, po, "ODD");

            return (
              <tr
                key={sym.symbol}
                onClick={() => setInspectSymbol(sym.symbol)}
                className={`cursor-pointer transition-colors ${
                  isActive
                    ? "bg-[#ffdea5]/40 border-l-2 border-[#c5a059]"
                    : isSelected
                    ? "bg-[#f5ede4] border-l-2 border-[#775a19]"
                    : "hover:bg-[#fbf2e9] border-l-2 border-transparent"
                } ${sym.isClosed ? "opacity-50" : ""}`}
              >
                {/* Asset */}
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1">
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#c5a059] pulsing-dot shrink-0" />}
                    <span
                      className={`text-[11px] font-bold ${isActive ? "text-[#775a19]" : "text-[#1e1b16]"}`}
                      style={{ fontFamily: "IBM Plex Mono, monospace" }}
                    >
                      {sym.displayName.replace("Volatility ", "V").replace(" (1s)", "(1S)")}
                    </span>
                  </div>
                  {!isWarmed && sym.buffer.length > 0 && (
                    <div className="text-[8px] text-[#7f7667]">{sym.buffer.length}/{capacity}</div>
                  )}
                </td>

                {/* Dom% */}
                <td className="px-1 py-2 text-right">
                  {(() => {
                    const displayPct = isEvenOdd
                      ? Math.max((sym as any).evenPct ?? 0, (sym as any).oddPct ?? 0)
                      : sym.underPct;
                    const threshold = isEvenOdd ? (config.evenOddDominance ?? 55) : config.minUnderPercentage;
                    const color = !isWarmed ? "text-[#7f7667]"
                      : displayPct >= threshold ? "text-[#775a19] font-bold"
                      : displayPct >= threshold - 5 ? "text-amber-600"
                      : "text-[#7f7667]";
                    return (
                      <span className={`text-[11px] ${color}`} style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        {isWarmed ? `${displayPct.toFixed(1)}%` : "—"}
                      </span>
                    );
                  })()}
                </td>

                {isEvenOdd ? (
                  <>
                    {/* Signal — compact */}
                    <td className="px-1 py-2 text-center">
                      {(() => {
                        if (!isWarmed) return <span className="text-[8px] text-[#7f7667]">…</span>;
                        const dom = Math.max((sym as any).evenPct ?? 0, (sym as any).oddPct ?? 0);
                        const s = dom >= 65 ? "STR" : dom >= 60 ? "MOD" : dom >= 55 ? "WK" : "—";
                        const sc = dom >= 65 ? "text-[#485e8b] bg-[#d5e0f7]" : dom >= 60 ? "text-amber-700 bg-amber-100" : dom >= 55 ? "text-[#7f7667] bg-[#f5ede4]" : "text-[#7f7667]";
                        return <span className={`text-[8px] font-bold px-1 py-0.5 rounded uppercase ${sc}`}>{s}</span>;
                      })()}
                    </td>
                    {/* E% */}
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[11px] ${parityColor(eRate)}`} style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        {isWarmed && eRate !== null ? `${eRate}%` : "—"}
                      </span>
                    </td>
                    {/* O% */}
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[11px] ${parityColor(oRate)}`} style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        {isWarmed && oRate !== null ? `${oRate}%` : "—"}
                      </span>
                    </td>
                  </>
                ) : (
                  <>
                    {/* Signal */}
                    <td className="px-2 py-2 text-center">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${isWarmed ? getStrengthStyle(sym.signalStrength) : "text-[#7f7667] bg-[#f0e8df] border border-[#d1c5b4]"}`}>
                        {isWarmed ? sym.signalStrength : "LOADING"}
                      </span>
                    </td>
                    {/* Digit */}
                    <td className="px-2 py-2 text-right">
                      <span className={`text-[13px] font-bold ${isActive ? "text-[#775a19]" : "text-[#4e4639]"}`} style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        {sym.lastDigit !== null ? sym.lastDigit : "—"}
                      </span>
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface LeaderboardProps {
  symbolStates: Record<string, SymbolState>;
  activeSymbol: string | null;
  inspectSymbol: string;
  setInspectSymbol: (symbol: string) => void;
  config: BotConfig;
}

export default function Leaderboard({ symbolStates, activeSymbol, inspectSymbol, setInspectSymbol, config }: LeaderboardProps) {
  const capacity = config.analysisTickCount;

  const symbolList = SYMBOLS.map(({ symbol, name }) => {
    const s = symbolStates[symbol];
    if (s) return s;
    return { symbol, displayName: name, buffer: [], underPct: 0, overPct: 0, evenPct: 0, oddPct: 0, signalStrength: "SCANNING..." as const, confirmationCounter: 0, digitFreq: {}, digitPct: {}, lastDigit: null, qualified: false, tickCount: 0, lastTickTime: 0, isClosed: false, evenOddStreakType: null, evenOddStreakCount: 0 };
  });

  const isEvenOdd = (config.strategy ?? "under") === "evenodd";

  const sorted = [...symbolList].sort((a, b) => {
    const aW = a.buffer.length >= capacity, bW = b.buffer.length >= capacity;
    const aScore = isEvenOdd ? Math.max((a as any).evenPct ?? 0, (a as any).oddPct ?? 0) : a.underPct;
    const bScore = isEvenOdd ? Math.max((b as any).evenPct ?? 0, (b as any).oddPct ?? 0) : b.underPct;
    if (aW && bW) return bScore - aScore;
    if (aW && !bW) return -1;
    if (!aW && bW) return 1;
    return b.buffer.length - a.buffer.length;
  });

  const getStrengthStyle = (strength: string) => {
    switch (strength) {
      case "VERY STRONG": return "bg-[#ffdea5] text-[#4e3700]";
      case "STRONG":      return "bg-[#d5e0f7] text-[#485e8b]";
      case "MODERATE":    return "bg-amber-100 text-amber-700";
      case "WEAK":        return "bg-[#f5ede4] text-[#7f7667]";
      default:            return "bg-[#f5ede4] text-[#7f7667]";
    }
  };

  const getUnderColor = (pct: number, warmed: boolean) => {
    if (!warmed) return "text-[#7f7667]";
    if (pct >= config.minUnderPercentage) return "text-[#775a19] font-bold";
    if (pct >= 55) return "text-amber-700";
    return "text-[#4e4639]";
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden shadow-sm animate-fade-in">
      <div className="flex justify-between items-center px-4 py-3 bg-[#f5ede4] border-b border-[#d1c5b4]">
        <h2 className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.15em]">VOLATILITY SCANNER</h2>
        <span className="text-[10px] font-bold text-[#775a19] uppercase tracking-wider">LIVE REFRESH</span>
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-[#d1c5b4]/50 bg-[#fbf2e9]">
            <th className="px-3 py-2 text-[9px] font-bold text-[#4e4639] uppercase tracking-[0.12em]">Asset</th>
            <th className="px-3 py-2 text-[9px] font-bold text-[#4e4639] uppercase tracking-[0.12em] text-right">
              {isEvenOdd ? "E/O Dom%" : "Under %"}
            </th>
            <th className="px-3 py-2 text-[9px] font-bold text-[#4e4639] uppercase tracking-[0.12em] text-center">Signal</th>
            <th className="px-3 py-2 text-[9px] font-bold text-[#4e4639] uppercase tracking-[0.12em] text-right">
              {isEvenOdd ? "Parity" : "Digit"}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#d1c5b4]/20">
          {sorted.map((sym) => {
            const isActive = activeSymbol === sym.symbol;
            const isSelected = inspectSymbol === sym.symbol;
            const isWarmed = sym.buffer.length >= capacity;

            return (
              <tr
                key={sym.symbol}
                onClick={() => setInspectSymbol(sym.symbol)}
                className={`cursor-pointer transition-colors ${
                  isActive
                    ? "bg-[#ffdea5]/40 border-l-2 border-[#c5a059]"
                    : isSelected
                    ? "bg-[#f5ede4] border-l-2 border-[#775a19]"
                    : "hover:bg-[#fbf2e9] border-l-2 border-transparent"
                } ${sym.isClosed ? "opacity-50" : ""}`}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#c5a059] pulsing-dot shrink-0" />}
                    <span
                      className={`text-[13px] font-bold ${isActive ? "text-[#775a19]" : "text-[#1e1b16]"}`}
                      style={{ fontFamily: "IBM Plex Mono, monospace" }}
                    >
                      {sym.displayName.replace("Volatility ", "V").replace(" (1s)", "(1S)")}
                    </span>
                    {sym.isClosed && (
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#ffdad6] text-error uppercase">CLOSED</span>
                    )}
                  </div>
                  {!isWarmed && sym.buffer.length > 0 && (
                    <div className="text-[9px] text-[#7f7667] mt-0.5">
                      {sym.buffer.length}/{capacity} ticks
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {(() => {
                    const displayPct = isEvenOdd
                      ? Math.max((sym as any).evenPct ?? 0, (sym as any).oddPct ?? 0)
                      : sym.underPct;
                    const threshold = isEvenOdd ? (config.evenOddDominance ?? 55) : config.minUnderPercentage;
                    const color = !isWarmed ? "text-[#7f7667]"
                      : displayPct >= threshold ? "text-[#775a19] font-bold"
                      : displayPct >= threshold - 5 ? "text-amber-600"
                      : "text-[#7f7667]";
                    return (
                      <span className={`text-[13px] ${color}`} style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        {isWarmed ? `${displayPct.toFixed(1)}%` : "—"}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {(() => {
                    if (!isWarmed) return (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide text-[#7f7667] bg-[#f0e8df] border border-[#d1c5b4]">
                        LOADING
                      </span>
                    );
                    if (isEvenOdd) {
                      const dom = Math.max((sym as any).evenPct ?? 0, (sym as any).oddPct ?? 0);
                      const eoStrength = dom >= 65 ? "STRONG" : dom >= 60 ? "MODERATE" : dom >= 55 ? "WEAK" : "SCANNING...";
                      return (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${getStrengthStyle(eoStrength as any)}`}>
                          {eoStrength}
                        </span>
                      );
                    }
                    return (
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${getStrengthStyle(sym.signalStrength)}`}>
                        {sym.signalStrength}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {isEvenOdd ? (
                    sym.lastDigit !== null ? (
                      <span
                        className={`text-[13px] font-black ${sym.lastDigit % 2 === 0 ? "text-[#775a19]" : "text-[#7f7667]"}`}
                        style={{ fontFamily: "IBM Plex Mono, monospace" }}
                      >
                        {sym.lastDigit % 2 === 0 ? "E" : "O"}
                      </span>
                    ) : <span className="text-[13px] text-[#7f7667]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>—</span>
                  ) : (
                    <span
                      className={`text-[15px] font-bold ${isActive ? "text-[#775a19]" : "text-[#4e4639]"}`}
                      style={{ fontFamily: "IBM Plex Mono, monospace" }}
                    >
                      {sym.lastDigit !== null ? sym.lastDigit : "—"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
