import { useState } from "react";
import { TradeLog } from "../types";
import { Download, FileSpreadsheet, Trash2, ShieldAlert } from "lucide-react";

interface TradeLogTableProps {
  logs: TradeLog[];
  onClearLogs: () => void;
}

export default function TradeLogTable({ logs, onClearLogs }: TradeLogTableProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  // Take last 50 trades, with most recent on top (it's already sorted that way in the useBot hook)
  const displayLogs = logs.slice(0, 50);

  // Exporters for CSV formatting
  const exportToCSV = () => {
    if (logs.length === 0) return;

    const headers = [
      "Trade #",
      "Timestamp",
      "Symbol",
      "Mode",
      "Under %",
      "Signal Strength",
      "Barrier",
      "Stake",
      "Multiplier",
      "Outcome",
      "Profit",
      "Running Session Profit",
      "Daily Trade No.",
      "Consec Losses Before",
      "In Recovery"
    ];

    const rows = logs.map((log) => [
      log.id,
      log.timestamp,
      log.symbol,
      log.mode,
      `${log.under_pct}%`,
      log.signal_strength,
      log.barrier,
      `$${log.stake.toFixed(2)}`,
      `x${log.multiplier}`,
      log.outcome,
      `$${log.profit.toFixed(2)}`,
      `$${log.session_profit.toFixed(2)}`,
      log.daily_trade_no,
      log.consecutive_losses_before,
      log.in_recovery ? "True" : "False"
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.map((val) => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `deriv_digit_bot_trades_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-bg-card border border-white/[0.08] rounded-xl p-5 shadow-sm animate-fade-in font-sans">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-white/[0.08] gap-3 mb-4">
        <div>
          <h2 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2.5">
            <FileSpreadsheet className="h-5 w-5 text-gold-500" /> TRANSACTION ACTIVITY LOGS
          </h2>
          <p className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider mt-1">Showing last 50 transactions, sorted by newest first</p>
        </div>

        <div className="flex items-center gap-2">
          {logs.length > 0 && (
            <>
              <button
                type="button"
                onClick={exportToCSV}
                className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest uppercase px-3 py-2 rounded-lg border border-gold-500/25 text-gold-500 bg-gold-500/5 hover:bg-gold-500/10 active:scale-95 transition-all outline-none cursor-pointer font-sans"
              >
                <Download className="h-3.5 w-3.5" /> Export to CSV
              </button>
              {confirmClear ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-rose-500/30 bg-rose-500/5 animate-fade-in">
                  <span className="text-[9px] font-bold tracking-wider text-rose-400 uppercase">Clear logs?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClearLogs();
                      setConfirmClear(false);
                    }}
                    className="text-[9px] font-mono font-bold uppercase px-2 py-1 bg-rose-500 text-white rounded cursor-pointer hover:bg-rose-600 transition-all"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="text-[9px] font-mono font-bold uppercase px-2 py-1 bg-neutral-800 text-neutral-300 rounded cursor-pointer hover:bg-neutral-700 transition-all"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest uppercase px-3 py-2 rounded-lg border border-rose-500/25 text-rose-450 bg-rose-500/5 hover:bg-rose-500/10 active:scale-95 transition-all outline-none cursor-pointer font-sans"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear History
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="py-12 text-center text-neutral-550 flex flex-col items-center justify-center gap-3">
          <Trash2 className="h-9 w-9 text-neutral-700" />
          <p className="text-xs uppercase tracking-widest text-neutral-500 font-bold">No transactions executed in this session yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
          <table className="w-full text-left border-collapse min-w-[800px] text-[11px]">
            <thead>
              <tr className="bg-white/[0.01] border-b border-white/[0.08] text-neutral-500 font-black tracking-widest uppercase font-sans text-[8.5px]">
                <th className="py-3 px-4 text-center">#</th>
                <th className="py-3 px-4">Time Settlement</th>
                <th className="py-3 px-4 text-center">Market</th>
                <th className="py-3 px-4 text-center">Mode</th>
                <th className="py-3 px-4 text-right">Stake</th>
                <th className="py-3 px-4 text-center">Multiplier</th>
                <th className="py-3 px-4 text-center">Under %</th>
                <th className="py-3 px-4 text-center">Signal Strength</th>
                <th className="py-3 px-4 text-center">Outcome</th>
                <th className="py-3 px-4 text-right">Profit / Loss</th>
                <th className="py-3 px-4 text-right">Running P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] font-mono">
              {displayLogs.map((log) => {
                const isWin = log.outcome === "WIN";
                return (
                  <tr
                    key={log.id}
                    className={`transition-colors duration-150 hover:bg-[#181820] ${
                      isWin ? "bg-emerald-500/[0.01]" : "bg-rose-500/[0.01]"
                    }`}
                  >
                    <td className="py-3.5 px-4 font-bold text-center text-white">{log.id}</td>
                    <td className="py-3.5 px-4 text-[#e2e8f0]">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                      })}{" "}
                      <span className="text-[9.5px] text-neutral-500 ml-1 font-medium font-sans uppercase">
                        ({new Date(log.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })})
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center text-white font-bold">{log.symbol}</td>
                    <td className="py-3.5 px-4 text-center">
                      {(() => {
                        let badgeStyle = "bg-white/[0.03] text-neutral-300 border-white/[0.06]";
                        let label: string = log.mode;
                        if (log.mode === "Martingale") {
                          badgeStyle = "bg-amber-500/10 text-amber-500 border-amber-500/20";
                        } else if (log.mode === "PayoutAdaptive") {
                          badgeStyle = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                          label = "Payout-Aware";
                        } else if (log.mode === "DAlembert") {
                          badgeStyle = "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
                          label = "D'Alembert";
                        } else if (log.mode === "GradualRecovery") {
                          badgeStyle = "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20";
                          label = "Split-Martingale";
                        }
                        return (
                          <span className={`text-[8.5px] font-bold px-2 py-0.5 rounded leading-3 uppercase border font-sans tracking-wide ${badgeStyle}`}>
                            {label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3.5 px-4 text-right text-white font-bold">${log.stake.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-center text-neutral-300">x{log.multiplier}</td>
                    <td className="py-3.5 px-4 text-center text-white font-bold">{log.under_pct.toFixed(1)}%</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="text-neutral-500 font-sans font-semibold text-[9.5px] uppercase tracking-wider">
                        {log.signal_strength}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`text-[9px] font-bold px-2 py-1 rounded leading-none uppercase tracking-widest font-sans border ${
                          isWin ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {log.outcome}
                      </span>
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-black text-sm ${
                        isWin ? "text-emerald-400" : "text-rose-500"
                      }`}
                    >
                      {isWin ? `+$${log.profit.toFixed(2)}` : `-$${Math.abs(log.profit).toFixed(2)}`}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-black text-sm ${
                        log.session_profit >= 0 ? "text-emerald-400" : "text-rose-500"
                      }`}
                    >
                      {log.session_profit >= 0
                        ? `+$${log.session_profit.toFixed(2)}`
                        : `-$${Math.abs(log.session_profit).toFixed(2)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
