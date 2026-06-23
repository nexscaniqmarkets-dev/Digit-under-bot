import { TradeLog } from "../types";

interface TradeLogTableProps {
  logs: TradeLog[];
  onClearLogs: () => void;
}

export default function TradeLogTable({ logs, onClearLogs }: TradeLogTableProps) {
  const totalProfit = logs.reduce((sum, l) => sum + l.profit, 0);
  const wins = logs.filter((l) => l.outcome === "WIN").length;
  const losses = logs.filter((l) => l.outcome === "LOSS").length;
  const winRate = logs.length > 0 ? ((wins / logs.length) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-4">
      {/* Header + Clear */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-xl font-black text-[#1e1b16] uppercase tracking-[0.05em]">TRADE HISTORY</h1>
          <p className="text-[11px] text-[#4e4639] mt-0.5">Real-time algorithmic execution log</p>
        </div>
        {logs.length > 0 && (
          <button
            type="button"
            onClick={() => { if (window.confirm("Clear all trade logs?")) onClearLogs(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#ffdad6] text-error border border-error/20 text-[10px] font-bold uppercase tracking-wider hover:bg-error hover:text-white transition-all active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">delete_sweep</span>
            CLEAR LOGS
          </button>
        )}
      </div>

      {/* Session overview */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card rounded-xl p-4 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.15em]">TOTAL P&L</span>
          <div className={`text-xl font-bold ${totalProfit >= 0 ? "text-[#485e8b]" : "text-error"}`} style={{ fontFamily: "IBM Plex Mono, monospace" }}>
            {totalProfit >= 0 ? `+$${totalProfit.toFixed(2)}` : `-$${Math.abs(totalProfit).toFixed(2)}`}
          </div>
          <span className="text-[9px] text-[#7f7667] uppercase">USD</span>
        </div>
        <div className="glass-card rounded-xl p-4 flex flex-col gap-1">
          <span className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.15em]">WIN RATE</span>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#775a19]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>{winRate}%</span>
            <span className="material-symbols-outlined text-[#775a19] text-sm">analytics</span>
          </div>
          <span className="text-[9px] text-[#7f7667] uppercase">{wins}W / {losses}L</span>
        </div>
      </div>

      {/* Stats strip */}
      {logs.length > 0 && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          <div className="glass-card flex-shrink-0 px-4 py-3 rounded-lg flex items-center gap-3">
            <span className="material-symbols-outlined text-[#775a19] text-[20px]">trending_up</span>
            <div>
              <div className="text-[9px] text-[#4e4639] uppercase tracking-wider font-bold">TOTAL TRADES</div>
              <div className="text-sm font-bold text-[#1e1b16]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>{logs.length}</div>
            </div>
          </div>
          <div className="glass-card flex-shrink-0 px-4 py-3 rounded-lg flex items-center gap-3">
            <span className="material-symbols-outlined text-[#4e4639] text-[20px]">bolt</span>
            <div>
              <div className="text-[9px] text-[#4e4639] uppercase tracking-wider font-bold">BEST PROFIT</div>
              <div className="text-sm font-bold text-success" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                ${Math.max(...logs.map((l) => l.profit)).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {logs.length === 0 ? (
        <div className="glass-card rounded-xl p-12 flex flex-col items-center justify-center text-center gap-3">
          <span className="material-symbols-outlined text-[#d1c5b4] text-5xl">history</span>
          <p className="text-[11px] text-[#7f7667] font-bold uppercase tracking-wider">No trades executed yet</p>
          <p className="text-[10px] text-[#7f7667]/70 max-w-[240px]">Execution records will appear here once the bot begins trading cycles.</p>
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#f5ede4]">
                <tr className="border-b border-[#d1c5b4]">
                  <th className="px-3 py-2.5 text-[9px] font-bold text-[#4e4639] uppercase tracking-[0.1em]">#</th>
                  <th className="px-3 py-2.5 text-[9px] font-bold text-[#4e4639] uppercase tracking-[0.1em]">TIME</th>
                  <th className="px-3 py-2.5 text-[9px] font-bold text-[#4e4639] uppercase tracking-[0.1em]">SYMBOL</th>
                  <th className="px-3 py-2.5 text-[9px] font-bold text-[#4e4639] uppercase tracking-[0.1em]">MODE</th>
                  <th className="px-3 py-2.5 text-[9px] font-bold text-[#4e4639] uppercase tracking-[0.1em] text-right">STAKE</th>
                  <th className="px-3 py-2.5 text-[9px] font-bold text-[#4e4639] uppercase tracking-[0.1em] text-center">STATUS</th>
                  <th className="px-3 py-2.5 text-[9px] font-bold text-[#4e4639] uppercase tracking-[0.1em] text-right">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d1c5b4]/30">
                {logs.map((log) => {
                  const t = new Date(log.timestamp);
                  const timeStr = t.toLocaleTimeString("en-US", { hour12: false });
                  const modeShort = log.mode === "GradualRecoveryProLite" ? "SPL-PRO-L" : log.mode === "GradualRecoveryPro" ? "SPL-PRO" : log.mode === "GradualRecoveryLite" ? "SPL-L" : log.mode === "GradualRecovery" ? "SPL-M" : "STD";

                  return (
                    <tr key={log.id} className="hover:bg-[#fbf2e9] transition-colors">
                      <td className="px-3 py-2.5 text-[12px] text-[#7f7667]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>{log.daily_trade_no}</td>
                      <td className="px-3 py-2.5 text-[12px] text-[#1e1b16]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>{timeStr}</td>
                      <td className="px-3 py-2.5 text-[12px] font-bold text-[#775a19]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        {log.symbol.replace("1HZ", "V").replace("V", "V").replace("R_", "V")}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-[#4e4639]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        U-{log.barrier}
                        {log.multiplier > 1 && <span className="text-[9px] opacity-60 ml-1">M{log.multiplier}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-right text-[#1e1b16]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>${log.stake.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-center">
                        {log.outcome === "WIN" ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-[#d5e0f7] text-[#485e8b] text-[9px] font-black uppercase tracking-wider">WIN</span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded bg-[#ffdad6] text-error text-[9px] font-black uppercase tracking-wider">LOSS</span>
                        )}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-[12px] font-bold text-right ${log.outcome === "WIN" ? "text-[#485e8b]" : "text-error"}`}
                        style={{ fontFamily: "IBM Plex Mono, monospace" }}
                      >
                        {log.profit >= 0 ? `+$${log.profit.toFixed(2)}` : `-$${Math.abs(log.profit).toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
