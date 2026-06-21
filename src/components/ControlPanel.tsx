import { SYMBOLS, BotState, BotConfig } from "../types";
import { Play, Square, Layers } from "lucide-react";

interface ControlPanelProps {
  botState: BotState;
  config: BotConfig;
  onConfigChange: (newConfig: BotConfig) => void;
  startBot: () => void;
  stopBot: () => void;
  activeSymbol: string | null;
  inspectSymbol?: string;
  setInspectSymbol?: (symbol: string) => void;
  connectionStatus: "disconnected" | "connecting" | "connected";
  reconnectCountdown: number | null;
}

export default function ControlPanel({
  botState,
  config,
  onConfigChange,
  startBot,
  stopBot,
  activeSymbol,
  connectionStatus,
  reconnectCountdown
}: ControlPanelProps) {
  const isRunning = botState !== "STATE_IDLE" && botState !== "STATE_STOPPED";

  // Mode change handler
  const handleModeChange = (mode: "Standard" | "GradualRecovery" | "GradualRecoveryPro" | "GradualRecoveryLite" | "GradualRecoveryProLite") => {
    onConfigChange({ ...config, mode });
  };

  // Get status details based on current botState ref model
  const getStatusDisplay = () => {
    switch (botState) {
      case "STATE_IDLE":
        return {
          text: "READY TO START",
          sub: "Waiting for user initiation",
          color: "text-neutral-400 border-neutral-800 bg-[#121216]/20",
          dotColor: "bg-neutral-500"
        };
      case "STATE_CONNECTING":
        return {
          text: "WS CONNECTING",
          sub: reconnectCountdown !== null ? `Reconnecting in ${reconnectCountdown}s...` : "Establishing secure link to Broker Services...",
          color: "text-amber-500 border-amber-500/20 bg-amber-500/5 animate-pulse",
          dotColor: "bg-amber-500"
        };
      case "STATE_WARMING_UP":
        return {
          text: "WARMING UP CHANNELS",
          sub: "Populating tick buffers for 13 markets (min. 120 each)...",
          color: "text-gold-400 border-gold-500/20 bg-gold-500/5",
          dotColor: "bg-gold-500"
        };
      case "STATE_SCANNING":
        return {
          text: "SCANNING ACTIVE CHANNELS",
          sub: "Auto-evaluating 13 synthetic markets simultaneously...",
          color: "text-gold-500 border-gold-500/30 bg-gold-500/10",
          dotColor: "bg-gold-500"
        };
      case "STATE_CONFIRMING":
        return {
          text: "CONFIRMATION SIGNAL DETECTED",
          sub: `Matching 2-tick Under ${config.referenceDigit} qualifiers on ${
            SYMBOLS.find((s) => s.symbol === activeSymbol)?.name || activeSymbol
          }...`,
          color: "text-gold-500 border-gold-500/40 bg-gold-500/15 shadow-[0_0_15px_rgba(197,160,89,0.08)]",
          dotColor: "bg-gold-500"
        };
      case "STATE_TRADING":
        return {
          text: "CONTRACT SEQUENCE PLACED",
          sub: "Executing rapid automated Digit Under settlements on broker...",
          color: "text-emerald-500 border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.08)]",
          dotColor: "bg-emerald-500"
        };
      case "STATE_RECOVERY":
        return {
          text: "MARTINGALE RECOVERY SWEEP",
          sub: "Awaiting next confirming target on same volatility index...",
          color: "text-orange-500 border-orange-500/20 bg-orange-500/10 animate-pulse",
          dotColor: "bg-orange-500"
        };
      case "STATE_STOPPED":
        return {
          text: "SYSTEM HALTED",
          sub: "Session conditions triggered safety clamp. Reset required.",
          color: "text-rose-500 border-rose-500/30 bg-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.08)]",
          dotColor: "bg-rose-500"
        };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className="animate-fade-in">
      {/* Engine Controller Card */}
      <div className="bg-bg-card border border-white/[0.08] rounded-xl p-5 flex flex-col gap-5 shadow-md">
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[9px] font-bold text-neutral-400 tracking-widest uppercase flex items-center gap-1.5 font-sans">
              <Layers className="h-3.5 w-3.5" /> Engine Controller
            </span>
            {config.showAllModes ? (
              <div className="flex flex-wrap gap-1 p-1 bg-[#121216] rounded-lg border border-white/[0.06] select-none max-w-full">
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => handleModeChange("Standard")}
                  className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider transition-all ${
                    config.mode === "Standard"
                      ? "bg-gold-500/10 text-gold-500 border border-gold-500/20"
                      : "text-neutral-500 hover:text-white"
                  } disabled:opacity-50`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => handleModeChange("GradualRecovery")}
                  className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider transition-all ${
                    config.mode === "GradualRecovery"
                      ? "bg-gold-500/10 text-gold-500 border border-gold-500/20"
                      : "text-neutral-500 hover:text-white"
                  } disabled:opacity-50`}
                  title="Split-Martingale Classic — 50% recovery per trade"
                >
                  Split-M Classic
                </button>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => handleModeChange("GradualRecoveryPro")}
                  className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider transition-all ${
                    config.mode === "GradualRecoveryPro"
                      ? "bg-gold-500/10 text-gold-500 border border-gold-500/20"
                      : "text-neutral-500 hover:text-white"
                  } disabled:opacity-50`}
                  title="Split-Martingale Pro — pauses after 2 losses, finds 75%+ signal"
                >
                  Split-M Pro
                </button>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => handleModeChange("GradualRecoveryLite")}
                  className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider transition-all ${
                    config.mode === "GradualRecoveryLite"
                      ? "bg-gold-500/10 text-gold-500 border border-gold-500/20"
                      : "text-neutral-500 hover:text-white"
                  } disabled:opacity-50`}
                  title="Split-Martingale Lite — 25% recovery per trade, lower stakes"
                >
                  Split-M Lite
                </button>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => handleModeChange("GradualRecoveryProLite")}
                  className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider transition-all ${
                    config.mode === "GradualRecoveryProLite"
                      ? "bg-gold-500/10 text-gold-500 border border-gold-500/20"
                      : "text-neutral-500 hover:text-white"
                  } disabled:opacity-50`}
                  title="Split-Martingale Pro Lite — Pro's signal tightening + Lite's 25% recovery target"
                >
                  Split-M Pro Lite
                </button>
              </div>
            ) : (
              <div className="px-2.5 py-1 rounded-md bg-gold-500/10 border border-gold-500/20 text-[9px] font-bold uppercase tracking-wider text-gold-500">
                Split-M Pro Lite
              </div>
            )}
          </div>

          {/* Quick Stake Amount Editor */}
          <div className="flex items-center justify-between gap-3 p-3 bg-[#121216] rounded-lg border border-white/[0.06] mb-1">
            <span className="text-[9px] font-bold text-neutral-400 tracking-widest uppercase">Stake Amount</span>
            <div className="flex items-center gap-1.5">
              <span className="text-gold-500 text-sm font-bold">$</span>
              <input
                type="number"
                min="0.35"
                step="0.5"
                disabled={isRunning}
                value={config.stakeAmount === 0 ? "" : config.stakeAmount}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    onConfigChange({ ...config, stakeAmount: 0 });
                    return;
                  }
                  const val = parseFloat(raw);
                  if (!isNaN(val) && val >= 0) {
                    onConfigChange({ ...config, stakeAmount: val });
                  }
                }}
                onBlur={(e) => {
                  if (e.target.value === "" || parseFloat(e.target.value) <= 0) {
                    onConfigChange({ ...config, stakeAmount: 0.35 });
                  }
                }}
                className="w-20 bg-[#0d0d0f] border border-white/[0.1] rounded-md px-2 py-1 text-sm text-white font-bold text-right focus:outline-none focus:border-gold-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Large START/STOP Trigger Button */}
          {!isRunning ? (
            <button
              onClick={startBot}
              disabled={connectionStatus === "connecting"}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-black bg-gradient-to-r from-gold-600 to-gold-400 hover:from-gold-500 hover:to-gold-300 shadow-md shadow-gold-500/10 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <Play className="h-5 w-5 fill-current" />
              START TRADING BOT
            </button>
          ) : (
            <button
              onClick={stopBot}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-rose-600 to-rose-800 hover:from-rose-500 hover:to-rose-700 shadow-md shadow-rose-600/10 active:scale-[0.98] transition-all"
            >
              <Square className="h-5 w-5 fill-current" />
              STOP AUTOMATION
            </button>
          )}
        </div>

        {/* Current status display text bar */}
        <div className={`p-4 rounded-lg border flex items-start gap-3 transition-all ${status.color}`}>
          <div className="flex h-5 items-center">
            <span className={`h-2.5 w-2.5 rounded-full ${status.dotColor}`} />
          </div>
          <div>
            <div className="font-bold text-[10px] uppercase tracking-wider leading-5 text-white">{status.text}</div>
            <div className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed font-medium">{status.sub}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
