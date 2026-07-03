import { BotState, BotConfig, SymbolState, TradeLog } from "../types";

interface StatsBarProps {
  config: BotConfig;
  botState: BotState;
  activeSymbol: string | null;
  activeSymbolState: SymbolState | undefined;
  sessionProfit: number;
  dailyTradesCount: number;
  consecutiveLosses: number;
  multiplier: number;
  evenOddCooldownSkipsRemaining?: number;
  tradeLogs?: TradeLog[];
}

export default function StatsBar({
  config,
  activeSymbolState,
  sessionProfit,
  dailyTradesCount,
  consecutiveLosses,
  multiplier,
  evenOddCooldownSkipsRemaining = 0,
  tradeLogs = [],
}: StatsBarProps) {
  const underPct = activeSymbolState?.underPct ?? 0;
  const evenPct = activeSymbolState?.evenPct ?? 0;
  const oddPct = activeSymbolState?.oddPct ?? 0;
  const isEvenOdd = (config.strategy ?? "under") === "evenodd";
  const dominantPct = isEvenOdd ? Math.max(evenPct, oddPct) : underPct;
  const dominantLabel = isEvenOdd
    ? (evenPct >= oddPct ? `EVEN ${evenPct.toFixed(1)}% · ODD ${oddPct.toFixed(1)}%` : `ODD ${oddPct.toFixed(1)}% · EVEN ${evenPct.toFixed(1)}%`)
    : `Target ≥ ${config.minUnderPercentage}% to qualify · Under ${config.referenceDigit}`;
  const signalStrength = activeSymbolState?.signalStrength ?? "SCANNING...";
  const confirmationCounter = activeSymbolState?.confirmationCounter ?? 0;

  // Parity performance — computed from session trade logs
  const evenTrades = tradeLogs.filter(l => l.direction === "EVEN");
  const oddTrades = tradeLogs.filter(l => l.direction === "ODD");
  const evenWins = evenTrades.filter(l => l.outcome === "WIN").length;
  const oddWins = oddTrades.filter(l => l.outcome === "WIN").length;
  const evenWinRate = evenTrades.length > 0 ? Math.round((evenWins / evenTrades.length) * 100) : null;
  const oddWinRate = oddTrades.length > 0 ? Math.round((oddWins / oddTrades.length) * 100) : null;
  const betterSide = evenWinRate !== null && oddWinRate !== null
    ? evenWinRate > oddWinRate ? "EVEN" : oddWinRate > evenWinRate ? "ODD" : null
    : null;
  const currentStake = config.stakeAmount * multiplier;

  const strengthColor = () => {
    switch (signalStrength) {
      case "VERY STRONG": return { badge: "bg-[#ffdea5] text-[#4e3700] border-[#c5a059]", val: "text-[#775a19]" };
      case "STRONG":      return { badge: "bg-[#ffebc8] text-[#5d4201] border-[#d1a84a]", val: "text-[#775a19]" };
      case "MODERATE":    return { badge: "bg-amber-100 text-amber-800 border-amber-300",   val: "text-amber-700" };
      case "WEAK":        return { badge: "bg-[#f5ede4] text-[#7f7667] border-[#d1c5b4]", val: "text-[#4e4639]" };
      default:            return { badge: "bg-[#f5ede4] text-[#7f7667] border-[#d1c5b4]", val: "text-[#4e4639]" };
    }
  };
  const sc = strengthColor();

  return (
    <div className="grid grid-cols-2 gap-3 animate-fade-in">
      {/* Under % / Even-Odd dominance — full width */}
      <div className="glass-card rounded-xl p-4 flex flex-col gap-1 col-span-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.15em]">
            {isEvenOdd ? "EVEN / ODD DOMINANCE" : "UNDER DIGIT %"}
          </span>
          <div className="flex items-center gap-2">
            {activeSymbolState && (
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${sc.badge}`}>
                {signalStrength}
              </span>
            )}
            <span className="material-symbols-outlined text-[#775a19] text-sm">
              {isEvenOdd ? "swap_horiz" : "trending_down"}
            </span>
          </div>
        </div>
        <div className={`text-[48px] leading-tight font-bold tracking-tighter ${sc.val}`} style={{ fontFamily: "IBM Plex Mono, monospace" }}>
          {activeSymbolState ? `${dominantPct.toFixed(1)}%` : "—"}
        </div>
        <p className="text-[11px] text-[#4e4639]/70 leading-snug">
          {activeSymbolState ? dominantLabel : "Awaiting active scanning data…"}
        </p>
      </div>

      {/* Confirmations (Under) / Streak Tracker (Even/Odd) */}
      <div className="glass-card rounded-xl p-3 flex flex-col gap-2">
        {isEvenOdd ? (
          <>
            <span className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.15em]">STREAK TRACKER</span>
            <div className="flex items-baseline gap-1" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
              <span className="text-xl font-bold text-[#1e1b16]">
                {activeSymbolState?.evenOddStreakCount ?? 0}
              </span>
              <span className="text-[#7f7667] text-base">/</span>
              <span className="text-[#7f7667] font-bold">3</span>
            </div>
            <div className="w-full h-1 bg-[#e9e1d8] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#c5a059] transition-all duration-300"
                style={{ width: `${Math.min(((activeSymbolState?.evenOddStreakCount ?? 0) / 3) * 100, 100)}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <span className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.15em]">CONFIRMATIONS</span>
            <div className="flex items-baseline gap-1" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
              <span className="text-xl font-bold text-[#1e1b16]">{confirmationCounter}</span>
              <span className="text-[#7f7667] text-base">/</span>
              <span className="text-[#7f7667] font-bold">{config.confirmationRequired}</span>
            </div>
            <div className="w-full h-1 bg-[#e9e1d8] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#c5a059] transition-all duration-300"
                style={{ width: `${(confirmationCounter / config.confirmationRequired) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Running P&L */}
      <div className="glass-card rounded-xl p-3 flex flex-col gap-2">
        <span className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.15em]">RUNNING P&L</span>
        <div
          className={`text-xl font-bold ${sessionProfit > 0 ? "text-success" : sessionProfit < 0 ? "text-error" : "text-[#1e1b16]"}`}
          style={{ fontFamily: "IBM Plex Mono, monospace" }}
        >
          {sessionProfit >= 0 ? `+$${sessionProfit.toFixed(2)}` : `-$${Math.abs(sessionProfit).toFixed(2)}`}
        </div>
        <div className="flex justify-between text-[10px] font-bold" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
          <span className="text-[#7f7667]">TP: <span className="text-success">${config.takeProfit.toFixed(2)}</span></span>
          <span className="text-[#7f7667]">SL: <span className="text-error">4L</span></span>
        </div>
      </div>

      {/* Active Stake (Under) / Stake + Cooldown (Even/Odd) */}
      <div className="glass-card rounded-xl p-3 flex flex-col gap-2">
        {isEvenOdd ? (
          <>
            <span className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.15em]">ACTIVE STAKE</span>
            <div className="text-xl font-bold text-[#1e1b16]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
              ${currentStake.toFixed(2)}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-[#7f7667] uppercase tracking-wider">
                {evenOddCooldownSkipsRemaining > 0 ? `Cooldown: ${evenOddCooldownSkipsRemaining} skip${evenOddCooldownSkipsRemaining > 1 ? "s" : ""} left` : "Multiplier"}
              </span>
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${evenOddCooldownSkipsRemaining > 0 ? "bg-amber-100 text-amber-700" : multiplier > 1 ? "bg-[#ffdad6] text-error" : "bg-[#f5ede4] text-[#4e4639]"}`} style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                {evenOddCooldownSkipsRemaining > 0 ? "⏸" : `×${multiplier}`}
              </span>
            </div>
          </>
        ) : (
          <>
            <span className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.15em]">ACTIVE STAKE</span>
            <div className="text-xl font-bold text-[#1e1b16]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
              ${currentStake.toFixed(2)}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-[#7f7667] uppercase tracking-wider">Multiplier</span>
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${multiplier > 1 ? "bg-[#ffdad6] text-error" : "bg-[#f5ede4] text-[#4e4639]"}`} style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                ×{multiplier}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Sessions / Bias */}
      <div className="glass-card rounded-xl p-3 flex flex-col gap-2">
        <span className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.15em]">SESSIONS / BIAS</span>
        <div className="flex flex-col gap-1" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
          <div className="flex justify-between text-[11px]">
            <span className="text-[#7f7667] uppercase text-[9px]">Trades</span>
            <span className="font-bold text-[#1e1b16]">{dailyTradesCount}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[#7f7667] uppercase text-[9px]">Loss Streak</span>
            <span className={`font-bold ${consecutiveLosses > 0 ? "text-error" : "text-[#4e4639]"}`}>
              {consecutiveLosses} / {isEvenOdd ? config.stopLoss : "5"}
            </span>
          </div>
        </div>
        <div className="w-full h-1 bg-[#e9e1d8] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${consecutiveLosses >= (config.stopLoss - 1) ? "bg-error" : "bg-amber-500"}`}
            style={{ width: `${(consecutiveLosses / config.stopLoss) * 100}%` }}
          />
        </div>
      </div>

      {/* Parity Performance — Even/Odd only */}
      {isEvenOdd && (
        <div className="glass-card rounded-xl p-4 flex flex-col gap-3 col-span-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.15em]">PARITY PERFORMANCE</span>
            {betterSide && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#ffdea5] text-[#775a19] border border-[#c5a059] uppercase tracking-wider">
                {betterSide} leading
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* EVEN */}
            <div className={`rounded-xl p-3 flex flex-col gap-2 border ${betterSide === "EVEN" ? "border-[#c5a059] bg-[#ffdea5]/40" : "border-[#d1c5b4] bg-[#f5ede4]"}`}>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-black text-[#4e4639] uppercase tracking-wider">EVEN</span>
                <span className="text-[9px] text-[#7f7667]">{evenTrades.length}T / {evenWins}W</span>
              </div>
              <div className="text-[28px] font-bold leading-none" style={{ fontFamily: "IBM Plex Mono, monospace", color: evenWinRate === null ? "#7f7667" : evenWinRate >= 60 ? "#2d7a3a" : evenWinRate >= 45 ? "#775a19" : "#c0392b" }}>
                {evenWinRate !== null ? `${evenWinRate}%` : "—"}
              </div>
              <div className="w-full h-1.5 bg-[#e9e1d8] rounded-full overflow-hidden">
                <div className="h-full bg-[#c5a059] transition-all" style={{ width: `${evenWinRate ?? 0}%` }} />
              </div>
            </div>
            {/* ODD */}
            <div className={`rounded-xl p-3 flex flex-col gap-2 border ${betterSide === "ODD" ? "border-[#c5a059] bg-[#ffdea5]/40" : "border-[#d1c5b4] bg-[#f5ede4]"}`}>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-black text-[#4e4639] uppercase tracking-wider">ODD</span>
                <span className="text-[9px] text-[#7f7667]">{oddTrades.length}T / {oddWins}W</span>
              </div>
              <div className="text-[28px] font-bold leading-none" style={{ fontFamily: "IBM Plex Mono, monospace", color: oddWinRate === null ? "#7f7667" : oddWinRate >= 60 ? "#2d7a3a" : oddWinRate >= 45 ? "#775a19" : "#c0392b" }}>
                {oddWinRate !== null ? `${oddWinRate}%` : "—"}
              </div>
              <div className="w-full h-1.5 bg-[#e9e1d8] rounded-full overflow-hidden">
                <div className="h-full bg-[#c5a059] transition-all" style={{ width: `${oddWinRate ?? 0}%` }} />
              </div>
            </div>
          </div>
          <p className="text-[9px] text-[#7f7667] text-center">Based on current session trades. Use Direction filter in Settings to lock to the better side.</p>
        </div>
      )}
    </div>
  );
}
