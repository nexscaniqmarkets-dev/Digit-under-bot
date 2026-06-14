import { BotState, BotConfig, SymbolState } from "../types";
import { TrendingUp, Percent, Layers, ShieldAlert, Target } from "lucide-react";

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
  botState,
  activeSymbolState,
  sessionProfit,
  dailyTradesCount,
  consecutiveLosses,
  multiplier
}: StatsBarProps) {
  // Current active asset under percentage
  const underPct = activeSymbolState ? activeSymbolState.underPct : 0.0;
  const signalStrength = activeSymbolState ? activeSymbolState.signalStrength : "SCANNING...";
  const confirmationCounter = activeSymbolState ? activeSymbolState.confirmationCounter : 0;

  // Colors based on signal strengths of Sophisticated Dark
  const getSignalColors = (strength: string) => {
    switch (strength) {
      case "VERY STRONG":
        return { text: "text-gold-500", bg: "bg-gold-500/10", border: "border-gold-500/30", glow: "shadow-gold-500/5" };
      case "STRONG":
        return { text: "text-gold-400", bg: "bg-gold-500/5", border: "border-gold-500/20", glow: "shadow-gold-500/5" };
      case "MODERATE":
        return { text: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", glow: "shadow-amber-500/5" };
      case "WEAK":
        return { text: "text-neutral-500", bg: "bg-neutral-800/20", border: "border-neutral-800", glow: "shadow-none" };
      default:
        return { text: "text-neutral-500", bg: "bg-[#1a1a20]", border: "border-white/[0.06]", glow: "shadow-none" };
    }
  };

  const colors = getSignalColors(signalStrength);
  const currentStake = config.stakeAmount * multiplier;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-fade-in">
      {/* 1. Large UNDER % Card */}
      <div className={`col-span-2 bg-bg-card border border-white/[0.08] rounded-xl p-5 flex flex-col justify-between shadow-md transition-all ${activeSymbolState ? colors.border : ""}`}>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold text-neutral-400 tracking-widest uppercase flex items-center gap-1.5 font-sans">
            <Percent className="h-3.5 w-3.5 text-gold-500" /> UNDER DIGIT %
          </span>
          {activeSymbolState && (
            <span className={`text-[8px] font-bold tracking-wider px-2 py-0.5 rounded border uppercase font-sans ${colors.text} ${colors.bg} ${colors.border}`}>
              {signalStrength}
            </span>
          )}
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className={`text-4xl font-black font-mono tracking-tight ${activeSymbolState ? colors.text : "text-neutral-500"}`}>
            {activeSymbolState ? `${underPct}%` : "0.0%"}
          </span>
          <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">Under {config.referenceDigit}</span>
        </div>
        <p className="text-[10px] text-neutral-400 mt-3 leading-relaxed">
          {activeSymbolState
            ? `Target percentage of >= ${config.minUnderPercentage}% to qualify trade execution signals`
            : "Awaiting matching synthetic volatility channel data..."}
        </p>
      </div>

      {/* 2. CONFIRMATION COUNTER */}
      <div className="bg-bg-card border border-white/[0.08] rounded-xl p-5 flex flex-col justify-between shadow-md">
        <span className="text-[9px] font-bold text-neutral-400 tracking-widest uppercase flex items-center gap-1.5 font-sans">
          <Target className="h-3.5 w-3.5 text-gold-500" /> CONFIRMATIONS
        </span>
        <div className="mt-4 flex items-baseline gap-1 font-mono">
          <span className="text-3xl font-black text-white">{confirmationCounter}</span>
          <span className="text-neutral-500 font-semibold text-lg">/</span>
          <span className="text-neutral-400 font-bold text-base">{config.confirmationRequired}</span>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <div className="flex-1 h-1.5 bg-[#121216] rounded-full overflow-hidden border border-white/[0.06]">
            <div
              className="h-full bg-gradient-to-r from-gold-600 to-gold-400 transition-all duration-300"
              style={{ width: `${(confirmationCounter / config.confirmationRequired) * 100}%` }}
            />
          </div>
          <span className="text-[9px] text-neutral-400 font-bold font-mono">
            {Math.round((confirmationCounter / config.confirmationRequired) * 100)}%
          </span>
        </div>
      </div>

      {/* 3. SESSION P&L */}
      <div className="bg-bg-card border border-white/[0.08] rounded-xl p-5 flex flex-col justify-between shadow-md">
        <span className="text-[9px] font-bold text-neutral-400 tracking-widest uppercase flex items-center gap-1.5 font-sans">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> RUNNING P&L
        </span>
        <div className="mt-4 flex flex-col">
          <span
            className={`text-3xl font-black tracking-tight font-mono ${
              sessionProfit > 0 ? "text-emerald-400" : sessionProfit < 0 ? "text-rose-500" : "text-white"
            }`}
          >
            {sessionProfit >= 0 ? `+$${sessionProfit.toFixed(2)}` : `-$${Math.abs(sessionProfit).toFixed(2)}`}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] font-bold font-mono">
          <span className="text-neutral-500">TP: <span className="text-emerald-400">${config.takeProfit.toFixed(1)}</span></span>
          <span className="text-neutral-500">SL: <span className="text-rose-400">-${config.stopLoss.toFixed(1)}</span></span>
        </div>
      </div>

      {/* 4. CURRENT STAKE */}
      <div className="bg-bg-card border border-white/[0.08] rounded-xl p-5 flex flex-col justify-between shadow-md">
        <span className="text-[9px] font-bold text-neutral-400 tracking-widest uppercase flex items-center gap-1.5 font-sans">
          <Layers className="h-3.5 w-3.5 text-gold-500" /> ACTIVE STAKE
        </span>
        <div className="mt-4 flex items-baseline gap-1 font-mono">
          <span className="text-3xl font-black text-white">${currentStake.toFixed(2)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-[9px] font-bold uppercase font-sans">
          <span className="text-neutral-500">Multiplier:</span>
          <span className={`px-2 py-0.5 rounded text-[10px] ${multiplier > 1 ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "bg-white/5 text-neutral-400"}`}>
            x{multiplier}
          </span>
        </div>
      </div>

      {/* 5. RISK HEALTH (DAILY TRADES + CONSECUTIVE LOSSES) */}
      <div className="bg-bg-card border border-white/[0.08] rounded-xl p-5 flex flex-col justify-between shadow-md">
        <span className="text-[9px] font-bold text-neutral-400 tracking-widest uppercase flex items-center gap-1.5 font-sans">
          <ShieldAlert className="h-3.5 w-3.5 text-rose-500" /> SESSIONS / BIAS
        </span>
        <div className="mt-4 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-neutral-500 font-bold uppercase font-mono">Trades:</span>
            <span className="text-xs font-bold font-mono text-white">
              {dailyTradesCount} <span className="text-neutral-500 font-medium text-[10px]">/ ∞</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-neutral-400 font-bold uppercase font-mono">Loss Streak:</span>
            <span className={`text-xs font-bold font-mono ${consecutiveLosses > 0 ? "text-rose-500" : "text-neutral-500"}`}>
              {consecutiveLosses} <span className="text-neutral-500 font-medium text-[10px]">/ 5</span>
            </span>
          </div>
        </div>
        <div className="h-1 bg-[#121216] rounded-full overflow-hidden mt-3 border border-white/[0.06]">
          <div
            className={`h-full ${consecutiveLosses >= 4 ? "bg-rose-500" : "bg-amber-500"}`}
            style={{ width: `${(consecutiveLosses / 5) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
