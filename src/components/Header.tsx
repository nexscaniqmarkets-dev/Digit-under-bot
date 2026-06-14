import { BotState } from "../types";
import { ShieldCheck, User, Globe } from "lucide-react";

interface HeaderProps {
  connectionStatus: "disconnected" | "connecting" | "connected";
  balance: string | null;
  accountEmail: string | null;
  isRealAccount: boolean;
  botState: BotState;
  activeSymbolName: string | null;
  resetDemoBalance?: () => void;
  currentUserEmail: string | null;
  onLogout?: () => void;
  telegramUser?: any;
}

export default function Header({
  connectionStatus,
  balance,
  accountEmail,
  isRealAccount,
  botState,
  activeSymbolName,
  resetDemoBalance,
  currentUserEmail,
  onLogout,
  telegramUser
}: HeaderProps) {
  return (
    <header className="border-b border-white/[0.08] bg-bg-card px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="p-1 bg-transparent text-gold-500 flex items-center justify-center shrink-0">
          <div className="w-8 h-8 border-2 border-gold-500 rounded-full flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-gold-500 rounded-full animate-pulse" />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-wider text-white font-serif flex flex-wrap items-center gap-2">
            DIGIT UNDER BOT
            <span className="text-[9px] tracking-wider uppercase px-2 py-0.5 bg-gold-500/10 text-gold-500 rounded border border-gold-500/20 font-sans font-bold">
              Active Scanner
            </span>
          </h1>
          <p className="text-[10px] text-neutral-400 uppercase tracking-widest mt-0.5 leading-none">Automated Real-Time Digit Trading Engine</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Active Focus Display */}
        {botState !== "STATE_IDLE" && (
          <div className="flex items-center gap-2 bg-[#1c1c22] px-3.5 py-2 rounded-lg border border-white/[0.06] text-xs">
            <span className="text-neutral-500 uppercase tracking-wide text-[9px] font-bold">Focus:</span>
            <span className="font-mono text-white flex items-center gap-1.5 text-[11px] font-semibold">
              <span className="h-2 w-2 rounded-full bg-gold-500 animate-ping" />
              {activeSymbolName || "Searching..."}
            </span>
          </div>
        )}

        {/* Connection status display */}
        <div className="flex items-center gap-2 bg-[#1c1c22] px-3.5 py-2 rounded-lg border border-white/[0.06] text-xs">
          <span className="text-neutral-500 uppercase tracking-wide text-[9px] font-bold">Server:</span>
          <span className="flex items-center gap-2 font-semibold text-[11px]">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-[#10B981] shadow-sm shadow-[#10B981]/30"
                  : connectionStatus === "connecting"
                  ? "bg-[#ffaa00] animate-pulse"
                  : "bg-[#ff4444]"
              }`}
            />
            <span
              className={
                connectionStatus === "connected"
                  ? "text-[#10B981]"
                  : connectionStatus === "connecting"
                  ? "text-[#ffaa00]"
                  : "text-[#ff4444]"
              }
            >
              {connectionStatus === "connected"
                ? "CONNECTED"
                : connectionStatus === "connecting"
                ? "CONNECTING..."
                : "DISCONNECTED"}
            </span>
          </span>
        </div>

        {/* Balance Badge */}
        {balance !== null && (
          <div className="flex items-center gap-3 bg-[#1c1c22] pl-3.5 pr-4.5 py-2 rounded-lg border border-white/[0.06] text-xs shadow-md">
            <div className="flex items-center gap-1.5 font-bold">
              {isRealAccount ? (
                <ShieldCheck className="h-4 w-4 text-gold-500" />
              ) : (
                <User className="h-4 w-4 text-orange-400 animate-pulse font-bold" />
              )}
              <span
                className={`font-bold tracking-wider text-[9px] uppercase px-2 py-0.5 rounded ${
                  isRealAccount ? "bg-gold-500/10 text-gold-500" : "bg-orange-400/10 text-orange-400"
                }`}
              >
                {isRealAccount ? "REAL" : "DEMO"}
              </span>
            </div>
            <div className="h-4 w-[1px] bg-white/[0.08]" />
            <div className="flex flex-col min-w-[70px]">
              <div className="flex items-center justify-between gap-2.5">
                <span className="text-[9px] text-neutral-500 leading-3 uppercase font-bold tracking-wider">Balance</span>
                {!isRealAccount && resetDemoBalance && (
                  <button
                    type="button"
                    onClick={resetDemoBalance}
                    className="text-[8px] text-orange-400 hover:text-orange-300 uppercase tracking-widest font-black leading-3 cursor-pointer underline hover:no-underline transition-all"
                    title="Top-up/Reset Demo Balance to $10,000"
                  >
                    Reset
                  </button>
                )}
              </div>
              <span className="font-mono text-sm font-bold text-white leading-4">
                {balance && !isNaN(parseFloat(balance)) ? (
                  `$${parseFloat(balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                ) : (
                  "Loading..."
                )}
              </span>
            </div>
          </div>
        )}
        {currentUserEmail && (
          <div className="flex items-center gap-2.5 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/15 pl-3 pr-2 py-1.5 rounded-lg text-xs transition-colors duration-200">
            <span className="text-[10px] text-neutral-300 font-medium font-sans">
              Logged in: <span className="font-bold text-rose-400 font-mono text-[11px] select-all">{currentUserEmail}</span>
            </span>
            <button
              onClick={onLogout}
              className="px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white transition-all text-[8px] font-bold uppercase tracking-wider cursor-pointer"
            >
              Logout
            </button>
          </div>
        )}
        {telegramUser && (
          <div className="flex items-center gap-2 bg-[#229ED9]/10 border border-[#229ED9]/20 pl-3 pr-3.5 py-1.5 rounded-lg text-xs animate-fade-in shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#229ED9] animate-pulse" />
            <span className="text-[10.5px] text-neutral-300 font-sans font-medium flex items-center gap-1">
              Telegram: <span className="font-bold text-[#229ED9]">@{telegramUser.username || telegramUser.first_name}</span>
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
