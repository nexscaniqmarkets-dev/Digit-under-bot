import { SymbolState, SYMBOLS, BotConfig } from "../types";
import { Star, Zap, Award, Target, HelpCircle } from "lucide-react";

interface LeaderboardProps {
  symbolStates: Record<string, SymbolState>;
  activeSymbol: string | null;
  inspectSymbol: string;
  setInspectSymbol: (symbol: string) => void;
  config: BotConfig;
}

export default function Leaderboard({
  symbolStates,
  activeSymbol,
  inspectSymbol,
  setInspectSymbol,
  config
}: LeaderboardProps) {
  // Map index states array
  const symbolList = SYMBOLS.map(({ symbol, name }) => {
    // Return either our tracked state or a blank mockup placeholder
    const sState = symbolStates[symbol];
    if (sState) return sState;
    
    return {
      symbol,
      displayName: name,
      buffer: [],
      underPct: 0.0,
      overPct: 0.0,
      signalStrength: "SCANNING..." as const,
      confirmationCounter: 0,
      digitFreq: {},
      digitPct: {},
      lastDigit: null,
      qualified: false,
      tickCount: 0,
      lastTickTime: 0,
      isClosed: false
    };
  });

  const capacity = config.analysisTickCount;

  // Find best qualifying asset (must exceed min threshold & have fully populated buffers)
  const qualifiedList = symbolList.filter(
    s => s.underPct >= config.minUnderPercentage && s.buffer.length >= capacity && !s.isClosed
  );

  const bestSymbol = qualifiedList.length > 0 
    ? [...qualifiedList].sort((a, b) => b.underPct - a.underPct)[0]
    : null;

  // Sorting priorities for leaderboard:
  // 1. Fully warmed-up qualified symbols (highest Under% to lowest)
  // 2. Fully warmed-up non-qualified symbols (highest Under% to lowest)
  // 3. Warming-up symbols (highest buffer length / ticks collected to lowest)
  const sortedSymbols = [...symbolList].sort((a, b) => {
    const aWarmed = a.buffer.length >= capacity;
    const bWarmed = b.buffer.length >= capacity;

    if (aWarmed && bWarmed) {
      // Both warmed: sort by Under% descending
      return b.underPct - a.underPct;
    }
    if (aWarmed && !bWarmed) return -1; // Warmed above non-warmed
    if (!aWarmed && bWarmed) return 1;

    // Both warming: sort by ticks count in buffer
    return b.buffer.length - a.buffer.length;
  });

  // Calculate stats summary displayed below leaderboard
  const qualifyingCount = qualifiedList.length;

  // Determine card styles and glow effects based on state
  const getCardStyle = (
    symbol: string,
    underPct: number,
    bufferLength: number,
    isClosed: boolean
  ) => {
    const isWarmed = bufferLength >= capacity;
    const isActive = activeSymbol === symbol;
    const isInspecting = inspectSymbol === symbol;

    if (isClosed) {
      return {
        border: isInspecting ? "border-gold-500/60" : "border-white/[0.06]",
        bg: "bg-[#16161a]/30 opacity-60",
        glow: "none",
        badgeColor: "text-neutral-500 bg-neutral-800/25"
      };
    }

    if (isActive) {
      return {
        border: "border-gold-500 shadow-[0_0_12px_rgba(197,160,89,0.12)] ring-1 ring-gold-500/10",
        bg: "bg-[#1a1a22]",
        glow: "glow-gold",
        badgeColor: "text-gold-400 bg-gold-500/10"
      };
    }

    if (!isWarmed) {
      return {
        border: isInspecting ? "border-gold-500" : "border-white/[0.06]",
        bg: "bg-white/[0.01] opacity-75",
        glow: "none",
        badgeColor: "text-neutral-500 bg-neutral-800"
      };
    }

    // High contras colors based on score
    if (underPct >= 80) {
      return {
        border: isInspecting ? "border-gold-500" : "border-gold-500/40 focus:border-gold-500 shadow-[0_0_8px_rgba(197,160,89,0.05)]",
        bg: "bg-[#17171e]",
        glow: "glow-gold-strong",
        badgeColor: "text-gold-400 bg-gold-500/10"
      };
    } else if (underPct >= 75) {
      return {
        border: isInspecting ? "border-gold-500" : "border-gold-500/30",
        bg: "bg-[#15151b]",
        glow: "glow-gold-medium",
        badgeColor: "text-gold-400 bg-gold-500/5"
      };
    } else if (underPct >= 70) {
      return {
        border: isInspecting ? "border-gold-500" : "border-white/[0.06]",
        bg: "bg-[#131317]",
        glow: "glow-amber",
        badgeColor: "text-amber-500 bg-amber-500/15"
      };
    } else if (underPct >= 65) {
      return {
        border: isInspecting ? "border-gold-500" : "border-white/[0.06]",
        bg: "bg-[#131317]",
        glow: "none",
        badgeColor: "text-neutral-400 bg-white/5"
      };
    } else {
      return {
        border: isInspecting ? "border-gold-500" : "border-white/[0.06]",
        bg: "bg-white/[0.01] opacity-65",
        glow: "none",
        badgeColor: "text-neutral-500 bg-neutral-800"
      };
    }
  };

  return (
    <div className="bg-bg-card border border-white/[0.08] rounded-xl p-5 shadow-md flex flex-col justify-between h-full animate-fade-in">
      <div>
        {/* Title block */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Award className="h-5 w-5 text-gold-500" />
            <h2 className="text-[11px] font-bold text-white tracking-widest uppercase font-sans">
              SCANNER LEADERBOARD
            </h2>
          </div>
          <span className="text-[8px] font-bold tracking-widest text-gold-500 bg-gold-500/10 px-2.5 py-1 rounded-full border border-gold-500/20 uppercase font-sans">
            LIVE SCANS
          </span>
        </div>

        {/* 2-Column Grid Leaderboard Lists */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
          {sortedSymbols.map((item) => {
            const isWarmed = item.buffer.length >= capacity;
            const isBest = bestSymbol && bestSymbol.symbol === item.symbol;
            const isActive = activeSymbol === item.symbol;
            const isInspecting = inspectSymbol === item.symbol;
            const styles = getCardStyle(item.symbol, item.underPct, item.buffer.length, item.isClosed);

            return (
              <div
                key={item.symbol}
                onClick={() => setInspectSymbol(item.symbol)}
                className={`relative p-3.5 rounded-xl border cursor-pointer hover:-translate-y-0.5 hover:bg-[#181820] transition-all text-left flex flex-col justify-between h-[120px] ${styles.border} ${styles.bg}`}
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-white truncate max-w-[130px]" title={item.displayName}>
                        {item.displayName}
                      </span>
                      {item.isClosed && (
                        <span className="text-[7.5px] font-black px-1.5 py-0.2 rounded bg-red-500/25 text-red-400 border border-red-500/30 font-sans tracking-wide">
                          CLOSED
                        </span>
                      )}
                    </div>
                    <span className="text-[8.5px] font-bold bg-[#0d0d0f] px-1.5 py-0.5 rounded border border-white/[0.06] text-neutral-400 leading-none uppercase font-mono tracking-wider mt-1.5 inline-block">
                      {item.symbol}
                    </span>
                  </div>

                  {/* Indicators/Badges on right */}
                  <div className="flex flex-col items-end gap-1 shrink-0 font-sans">
                    {/* BEST label */}
                    {isBest && !item.isClosed && (
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-gold-500/15 text-gold-500 border border-gold-500/25 flex items-center gap-0.5 shadow-sm leading-none tracking-wider">
                        <Star className="h-2.5 w-2.5 fill-current" /> BEST
                      </span>
                    )}
                    {/* ACTIVE label */}
                    {isActive && (
                      <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1 shadow-sm leading-none tracking-wider">
                        <Zap className="h-2.5 w-2.5 fill-current animate-pulse" /> ACTIVE
                      </span>
                    )}
                    {/* INSPECTING outline */}
                    {isInspecting && !isActive && !isBest && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-gold-500/10 text-gold-400 border border-gold-500/20 leading-none tracking-wider">
                        VIEWING
                    </span>
                    )}
                  </div>
                </div>

                {/* Body stats or progress bar */}
                <div className="mt-2.5">
                  {!isWarmed && !item.isClosed ? (
                    <div>
                      <div className="flex justify-between items-center text-[9px] text-neutral-500 mb-1.5 font-bold font-mono">
                        <span>COLLECTING TICKS:</span>
                        <span>
                          {item.buffer.length} <span className="opacity-60">/ {capacity}</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#0d0d0f] rounded-full overflow-hidden border border-white/[0.06]">
                        <div
                          className="h-full bg-gradient-to-r from-gold-600 to-gold-400 transition-all"
                          style={{ width: `${(item.buffer.length / capacity) * 100}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 text-[10px] text-neutral-400">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold uppercase tracking-wider text-[9px] font-sans">UNDER {config.referenceDigit}:</span>
                        <span className={`font-mono font-bold text-sm ${item.isClosed ? "text-neutral-500" : styles.badgeColor.split(" ")[0]}`}>
                          {item.underPct.toFixed(1)}%{" "}
                          {!item.isClosed && (
                            <span className="text-[8.5px] font-extrabold opacity-85 uppercase font-sans tracking-wide">
                              [{item.signalStrength}]
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-medium font-mono text-neutral-500">
                        <span>Analyzed: {item.buffer.length}t</span>
                        {isActive && (
                          <span>Conf: {item.confirmationCounter}/{config.confirmationRequired}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leaderboard stats summary section displayed below cards */}
      <div className="mt-5 pt-4 border-t border-white/[0.08] grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#131317]/50 p-4 rounded-xl border border-white/[0.06]">
        <div>
          <div className="text-[9px] font-black tracking-widest text-neutral-500 uppercase font-sans">QUALIFYING SYMBOLS</div>
          <div className="text-sm font-bold text-white mt-0.5">
            {qualifyingCount} <span className="text-[10px] text-neutral-500 font-medium font-sans">/ 13 markets</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] font-black tracking-widest text-neutral-500 uppercase font-sans">BEST SCAN SIGNAL</div>
          <div className="text-[11px] font-bold text-gold-500 mt-1 uppercase flex items-center gap-1 font-sans">
            <Star className="h-3 w-3 text-gold-500 fill-current shrink-0" />
            <span className="truncate">
              {bestSymbol ? `${bestSymbol.symbol} (${bestSymbol.underPct}%)` : "No qualifying signal"}
            </span>
          </div>
        </div>
        <div>
          <div className="text-[9px] font-black tracking-widest text-neutral-500 uppercase font-sans">ACTIVE TRADING TARGET</div>
          <div className="text-[11px] font-bold mt-1 uppercase flex items-center gap-1 font-sans">
            <Zap className="h-3 w-3 text-emerald-500 fill-current shrink-0" />
            <span className="text-white truncate">
              {activeSymbol
                ? `${SYMBOLS.find((s) => s.symbol === activeSymbol)?.name || activeSymbol}`
                : "Awaiting matching signals..."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
