import { BotState, BotConfig, SymbolState } from "../types";

interface StatsBarProps {
  config: BotConfig;
  botState: BotState;
  activeSymbol: string | null;
  activeSymbolState: SymbolState | undefined;
  sessionProfit: number;
  dailyTradesCount: number;
  consecutiveLosses: number;
  multiplier: number;
}

export default function StatsBar({
  config,
  activeSymbolState,
  sessionProfit,
  dailyTradesCount,
  consecutiveLosses,
  multiplier,
}: StatsBarProps) {
  const underPct = activeSymbolState?.underPct ?? 0;
  const signalStrength = activeSymbolState?.signalStrength ?? "SCANNING...";
  const confirmationCounter = activeSymbolState?.confirmationCounter ?? 0;
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
      {/* Under % — full width */}
      <div className="glass-card rounded-xl p-4 flex flex-col gap-1 col-span-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.15em]">UNDER DIGIT %</span>
          <div className="flex items-center gap-2">
            {activeSymbolState && (
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${sc.badge}`}>
                {signalStrength}
              </span>
            )}
            <span className="material-symbols-outlined text-[#775a19] text-sm">trending_down</span>
          </div>
        </div>
        <div className={`text-[48px] leading-tight font-bold tracking-tighter ${sc.val}`} style={{ fontFamily: "IBM Plex Mono, monospace" }}>
          {activeSymbolState ? `${underPct.toFixed(1)}%` : "—"}
        </div>
        <p className="text-[11px] text-[#4e4639]/70 leading-snug">
          {activeSymbolState
            ? `Target ≥ ${config.minUnderPercentage}% to qualify · Under ${config.referenceDigit}`
            : "Awaiting active scanning data…"}
        </p>
      </div>

      {/* Confirmations */}
      <div className="glass-card rounded-xl p-3 flex flex-col gap-2">
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

      {/* Active Stake */}
      <div className="glass-card rounded-xl p-3 flex flex-col gap-2">
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
            <span className={`font-bold ${consecutiveLosses > 0 ? "text-error" : "text-[#4e4639]"}`}>{consecutiveLosses} / 5</span>
          </div>
        </div>
        <div className="w-full h-1 bg-[#e9e1d8] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${consecutiveLosses >= 4 ? "bg-error" : "bg-amber-500"}`}
            style={{ width: `${(consecutiveLosses / 5) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
