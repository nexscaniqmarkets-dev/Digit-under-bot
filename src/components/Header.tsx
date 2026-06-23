import { BotState } from "../types";

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
  telegramUser,
}: HeaderProps) {
  const connColor =
    connectionStatus === "connected"
      ? "text-success"
      : connectionStatus === "connecting"
      ? "text-amber-600"
      : "text-error";
  const connDot =
    connectionStatus === "connected"
      ? "bg-success"
      : connectionStatus === "connecting"
      ? "bg-amber-500"
      : "bg-error";
  const connLabel =
    connectionStatus === "connected"
      ? "CONNECTED"
      : connectionStatus === "connecting"
      ? "CONNECTING..."
      : "DISCONNECTED";

  return (
    <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 h-14 bg-[#fff8f3]/90 backdrop-blur-md border-b border-[#d1c5b4]">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[#775a19] text-[22px]">token</span>
        <span className="text-[15px] font-black text-[#775a19] tracking-[0.05em] uppercase" style={{ fontFamily: "Geist, sans-serif" }}>
          DIGIT UNDER BOT
        </span>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-2">
        {/* Balance chip */}
        {balance !== null && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f5ede4] border border-[#d1c5b4]">
            <span className="text-[9px] font-bold text-[#4e4639] uppercase tracking-widest">
              {isRealAccount ? "REAL" : "DEMO"}
            </span>
            <span className="text-[11px] font-bold text-[#1e1b16]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
              ${parseFloat(balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {!isRealAccount && resetDemoBalance && (
              <button
                type="button"
                onClick={resetDemoBalance}
                className="text-[9px] text-[#775a19] underline font-bold uppercase cursor-pointer ml-0.5"
              >
                Reset
              </button>
            )}
          </div>
        )}

        {/* Telegram user */}
        {telegramUser && (
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-[#e8f0fe] border border-[#b8ccf8]">
            <span className="text-[9px] font-bold text-[#485e8b] uppercase">
              @{telegramUser.username || telegramUser.first_name}
            </span>
          </div>
        )}

        {/* Connection pill */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f5ede4] border border-[#d1c5b4] ${connColor}`}>
          <div className={`w-1.5 h-1.5 rounded-full pulsing-dot ${connDot}`} />
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase">{connLabel}</span>
        </div>

        {/* Logout */}
        {currentUserEmail && onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider text-error bg-[#ffdad6] border border-[#f5c5c2] hover:bg-error hover:text-white transition-all cursor-pointer"
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}
