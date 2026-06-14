import { SessionStats } from "../types";
import { X, Award, AlertCircle, Percent, TrendingUp } from "lucide-react";

interface SessionSummaryModalProps {
  stats: SessionStats | null;
  onClose: () => void;
}

export default function SessionSummaryModal({ stats, onClose }: SessionSummaryModalProps) {
  if (!stats) return null;

  const isProfitable = stats.netProfit >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in font-sans">
      <div className="relative bg-bg-card border border-white/[0.08] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header decoration */}
        <div className={`p-5 flex items-center justify-between border-b border-white/[0.08] ${
          isProfitable 
            ? "bg-gradient-to-r from-emerald-500/10 to-transparent" 
            : "bg-gradient-to-r from-rose-500/10 to-transparent"
        }`}>
          <div className="flex items-center gap-2.5">
            <Award className={`h-6 w-6 ${isProfitable ? "text-gold-500" : "text-neutral-500"}`} />
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-widest font-sans">Trading Session Summary</h2>
              <p className="text-[9px] text-neutral-500 font-bold uppercase font-mono mt-0.5">AUTOMATION STOPPED</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg border border-white/[0.06] bg-[#1a1a22] text-neutral-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 flex flex-col gap-5">
          {/* STOP REASON BLOCK */}
          <div className="bg-[#131317]/50 border border-white/[0.06] rounded-xl p-4 flex gap-3 text-left">
            <AlertCircle className="h-5 w-5 text-gold-500 shrink-0" />
            <div>
              <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest font-sans leading-none">STOP ACTION TRIGGER</div>
              <p className="text-xs text-white font-medium mt-1.5 leading-relaxed">{stats.stopReason}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* NET PROFIT */}
            <div className="bg-[#131317]/50 border border-white/[0.06] rounded-xl p-4 flex flex-col justify-between">
              <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1 font-sans">
                <TrendingUp className="h-3 w-3 text-emerald-450" /> NET PROFIT
              </span>
              <span className={`text-2xl font-black font-mono tracking-tight mt-2 ${
                isProfitable ? "text-emerald-400" : "text-rose-500"
              }`}>
                {isProfitable ? `+$${stats.netProfit.toFixed(2)}` : `-$${Math.abs(stats.netProfit).toFixed(2)}`}
              </span>
            </div>

            {/* WIN RATE */}
            <div className="bg-[#131317]/50 border border-white/[0.06] rounded-xl p-4 flex flex-col justify-between">
              <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1 font-sans">
                <Percent className="h-3 w-3 text-gold-500" /> WIN RATIO
              </span>
              <span className="text-2xl font-black font-mono tracking-tight text-white mt-2">
                {stats.winRate.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* SESSIONS STATS DETAIL */}
          <div className="bg-[#131317]/30 border border-white/[0.06] rounded-xl p-4 divide-y divide-white/[0.04] flex flex-col font-mono text-[11px]">
            <div className="flex justify-between items-center pb-2.5 text-neutral-400">
              <span className="font-sans font-semibold text-[10px] tracking-wider uppercase text-neutral-500">Total Runs:</span>
              <span className="font-bold text-white">{stats.totalTrades} run(s)</span>
            </div>
            <div className="flex justify-between items-center py-2.5 text-neutral-400">
              <span className="font-sans font-semibold text-[10px] tracking-wider uppercase text-neutral-500">Wins / Losses:</span>
              <span className="font-bold text-white">
                <span className="text-emerald-400">{stats.wins}W</span> / <span className="text-rose-400">{stats.losses}L</span>
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5 text-neutral-400">
              <span className="font-sans font-semibold text-[10px] tracking-wider uppercase text-neutral-500">Best Streak:</span>
              <span className="font-bold text-emerald-400">{stats.bestStreak} consecutive</span>
            </div>
            <div className="flex justify-between items-center pt-2.5 text-neutral-400">
              <span className="font-sans font-semibold text-[10px] tracking-wider uppercase text-neutral-500">Worst Drawdown:</span>
              <span className="font-bold text-rose-400">${stats.worstDrawdown.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="px-6 py-4 border-t border-white/[0.08] bg-[#131317]/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-gold-500/20 bg-gold-500/5 text-gold-500 hover:bg-gold-500 hover:text-black font-bold text-[10px] tracking-widest uppercase transition-all duration-200 outline-none"
          >
            DISMISS REPORT
          </button>
        </div>
      </div>
    </div>
  );
}
