import { SessionStats } from "../types";

interface SessionSummaryModalProps {
  stats: SessionStats | null;
  onClose: () => void;
}

export default function SessionSummaryModal({ stats, onClose }: SessionSummaryModalProps) {
  if (!stats) return null;
  const isProfitable = stats.netProfit >= 0;
  const winRateDeg = (stats.winRate / 100) * 283; // circumference ~283 for r=45

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
      <div className="w-full max-w-sm bg-[#fff8f3] border border-[#d1c5b4] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-in-up">

        {/* Header */}
        <div className={`p-5 flex items-center justify-between border-b border-[#d1c5b4] ${isProfitable ? "bg-[#f0fdf4]" : "bg-[#ffdad6]/30"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isProfitable ? "bg-[#dcfce7] text-success" : "bg-[#ffdad6] text-error"}`}>
              <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isProfitable ? "emoji_events" : "flag"}
              </span>
            </div>
            <div>
              <h2 className="text-[13px] font-black text-[#1e1b16] uppercase tracking-[0.06em]">Session Summary</h2>
              <p className="text-[9px] text-[#4e4639] uppercase tracking-widest mt-0.5">Automation Stopped</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full border border-[#d1c5b4] flex items-center justify-center text-[#4e4639] hover:bg-[#f5ede4] transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">

          {/* Stop reason */}
          <div className="bg-[#fbf2e9] border border-[#d1c5b4]/50 rounded-xl p-3 flex gap-3">
            <span className="material-symbols-outlined text-[#775a19] text-[20px] shrink-0 mt-0.5">info</span>
            <div>
              <div className="text-[9px] font-bold text-[#4e4639] uppercase tracking-widest mb-1">Stop Trigger</div>
              <p className="text-[12px] text-[#1e1b16] font-medium leading-snug">{stats.stopReason}</p>
            </div>
          </div>

          {/* Win rate ring + profit */}
          <div className="grid grid-cols-2 gap-3">
            {/* Win Rate Radial */}
            <div className="glass-card rounded-xl p-4 flex flex-col items-center gap-2">
              <span className="text-[9px] font-bold text-[#4e4639] uppercase tracking-widest self-start">WIN RATE</span>
              <div className="relative w-20 h-20">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#e9e1d8" strokeWidth="10" />
                  <circle
                    cx="50" cy="50" r="38" fill="none"
                    stroke={isProfitable ? "#10b981" : "#ba1a1a"}
                    strokeWidth="10"
                    strokeDasharray={`${(stats.winRate / 100) * 238.76} 238.76`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 0.6s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-[18px] font-bold ${isProfitable ? "text-success" : "text-error"}`} style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                    {stats.winRate.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Net P&L */}
            <div className="glass-card rounded-xl p-4 flex flex-col gap-1">
              <span className="text-[9px] font-bold text-[#4e4639] uppercase tracking-widest">NET P&L</span>
              <div className={`text-[22px] font-black mt-auto ${isProfitable ? "text-[#485e8b]" : "text-error"}`} style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                {isProfitable ? `+$${stats.netProfit.toFixed(2)}` : `-$${Math.abs(stats.netProfit).toFixed(2)}`}
              </div>
              <span className="text-[9px] text-[#7f7667] uppercase">USD</span>
            </div>
          </div>

          {/* Detail grid */}
          <div className="glass-card rounded-xl divide-y divide-[#d1c5b4]/30">
            {[
              { label: "Total Runs", value: `${stats.totalTrades}`, color: "text-[#1e1b16]" },
              {
                label: "Wins / Losses",
                value: null,
                custom: (
                  <span style={{ fontFamily: "IBM Plex Mono, monospace" }} className="font-bold text-[13px]">
                    <span className="text-success">{stats.wins}W</span>
                    <span className="text-[#d1c5b4]"> / </span>
                    <span className="text-error">{stats.losses}L</span>
                  </span>
                ),
              },
              { label: "Best Streak", value: `${stats.bestStreak} consecutive`, color: "text-success" },
              { label: "Worst Drawdown", value: `-$${stats.worstDrawdown.toFixed(2)}`, color: "text-error" },
            ].map(({ label, value, custom, color }, i) => (
              <div key={i} className="flex justify-between items-center px-4 py-3">
                <span className="text-[10px] font-bold text-[#4e4639] uppercase tracking-wider">{label}</span>
                {custom ?? (
                  <span className={`text-[13px] font-bold ${color}`} style={{ fontFamily: "IBM Plex Mono, monospace" }}>{value}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 gold-gradient rounded-xl text-white font-black text-[11px] uppercase tracking-[0.1em] active:scale-[0.98] transition-all cursor-pointer"
          >
            CLOSE REPORT
          </button>
        </div>
      </div>
    </div>
  );
}
