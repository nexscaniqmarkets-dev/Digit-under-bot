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
  const isEvenOddStrategy = (config.strategy ?? "under") === "evenodd";
  const isDigitMatch = (config.strategy ?? "under") === "digitmatch";
  const qualifyingTicks = (isEvenOddStrategy || isDigitMatch) ? 120 : capacity;

  const symbolList = SYMBOLS.map(({ symbol, name }) => {
    const s = symbolStates[symbol];
    if (s) return s;
    return { symbol, displayName: name, buffer: [], underPct: 0, overPct: 0, evenPct: 0, oddPct: 0, signalStrength: "SCANNING..." as const, confirmationCounter: 0, digitFreq: {}, digitPct: {}, lastDigit: null, qualified: false, tickCount: 0, lastTickTime: 0, isClosed: false, evenOddStreakType: null, evenOddStreakCount: 0, parityPatternEven: 0, parityPatternOdd: 0, dmDominantDigit: null, dmTriggerDigit: null, dmConfidence: 0, dmTradeQualityScore: 0, dmSignalReady: false, dmTieDetected: false, dmMarketStability: null, dmRiskLevel: null, dmDominantHistory: [] };
  });

  const isEvenOdd = isEvenOddStrategy;

  const sorted = [...symbolList].sort((a, b) => {
    const aW = a.buffer.length >= qualifyingTicks, bW = b.buffer.length >= qualifyingTicks;
    const aScore = isDigitMatch ? ((a as any).dmTradeQualityScore ?? 0) : isEvenOdd ? Math.max((a as any).evenPct ?? 0, (a as any).oddPct ?? 0) : a.underPct;
    const bScore = isDigitMatch ? ((b as any).dmTradeQualityScore ?? 0) : isEvenOdd ? Math.max((b as any).evenPct ?? 0, (b as any).oddPct ?? 0) : b.underPct;
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
              {isDigitMatch ? "Quality" : isEvenOdd ? "Dom%" : "Under%"}
            </th>
            {isDigitMatch ? (
              <>
                <th className="px-1 py-2 text-[9px] font-bold text-[#4e4639] uppercase tracking-[0.08em] text-center">Sig</th>
                <th className="px-1 py-2 text-[9px] font-bold text-[#775a19] uppercase tracking-[0.08em] text-right">Digit</th>
                <th className="px-1 py-2 text-[9px] font-bold text-[#7f7667] uppercase tracking-[0.08em] text-right">Conf%</th>
              </>
            ) : isEvenOdd ? (
              <>
                <th className="px-1 py-2 text-[9px] font-bold text-[#4e4639] uppercase tracking-[0.08em] text-center">Sig</th>
                <th className="px-1 py-2 text-[9px] font-bold text-[#775a19] uppercase tracking-[0.08em] text-right">E-Pat</th>
                <th className="px-1 py-2 text-[9px] font-bold text-[#7f7667] uppercase tracking-[0.08em] text-right">O-Pat</th>
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
            const isWarmed = sym.buffer.length >= qualifyingTicks;
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
                    <div className="text-[8px] text-[#7f7667]">{sym.buffer.length}/{qualifyingTicks}</div>
                  )}
                </td>

                {/* Dom% / Quality */}
                <td className="px-1 py-2 text-right">
                  {(() => {
                    const displayPct = isDigitMatch
                      ? ((sym as any).dmTradeQualityScore ?? 0)
                      : isEvenOdd
                      ? Math.max((sym as any).evenPct ?? 0, (sym as any).oddPct ?? 0)
                      : sym.underPct;
                    const threshold = isDigitMatch ? 50 : isEvenOdd ? (config.evenOddDominance ?? 55) : config.minUnderPercentage;
                    const color = !isWarmed ? "text-[#7f7667]"
                      : displayPct >= threshold ? "text-[#775a19] font-bold"
                      : displayPct >= threshold - 5 ? "text-amber-600"
                      : "text-[#7f7667]";
                    return (
                      <span className={`text-[11px] ${color}`} style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        {isWarmed && displayPct > 0 ? `${displayPct.toFixed(isDigitMatch ? 0 : 1)}%` : "—"}
                      </span>
                    );
                  })()}
                </td>

                {isDigitMatch ? (
                  <>
                    {/* Quality score */}
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[11px] ${!isWarmed ? "text-[#7f7667]" : (sym as any).dmTradeQualityScore >= 70 ? "text-[#2d7a3a] font-bold" : (sym as any).dmTradeQualityScore >= 50 ? "text-[#775a19] font-bold" : "text-[#7f7667]"}`} style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        {isWarmed && (sym as any).dmTradeQualityScore > 0 ? `${(sym as any).dmTradeQualityScore}%` : "—"}
                      </span>
                    </td>
                    {/* Signal */}
                    <td className="px-1 py-2 text-center">
                      {(() => {
                        if (!isWarmed) return <span className="text-[8px] text-[#7f7667]">…</span>;
                        if ((sym as any).dmTieDetected) return <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700">TIE</span>;
                        if ((sym as any).dmSignalReady) return <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#d5e0f7] text-[#485e8b]">RDY</span>;
                        const ms = (sym as any).dmMarketStability;
                        const sc = ms === "TRENDING" ? "text-[#775a19] bg-[#ffdea5]" : ms === "VOLATILE" ? "text-error bg-[#ffdad6]" : "text-[#7f7667] bg-[#f5ede4]";
                        return <span className={`text-[8px] font-bold px-1 py-0.5 rounded uppercase ${sc}`}>{ms?.slice(0,3) ?? "—"}</span>;
                      })()}
                    </td>
                    {/* Dominant digit */}
                    <td className="px-1 py-2 text-right">
                      <span className="text-[15px] font-black text-[#775a19]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        {isWarmed && (sym as any).dmDominantDigit !== null ? (sym as any).dmDominantDigit : "—"}
                      </span>
                    </td>
                    {/* Confidence */}
                    <td className="px-1 py-2 text-right">
                      <span className={`text-[11px] ${!isWarmed ? "text-[#7f7667]" : (sym as any).dmConfidence >= 70 ? "text-[#2d7a3a] font-bold" : "text-[#7f7667]"}`} style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        {isWarmed && (sym as any).dmConfidence > 0 ? `${(sym as any).dmConfidence.toFixed(0)}%` : "—"}
                      </span>
                    </td>
                  </>
                ) : isEvenOdd ? (
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
