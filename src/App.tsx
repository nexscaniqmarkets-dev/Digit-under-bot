import { useState, useEffect, useRef } from "react";
import { useBot } from "./utils/useBot";
import { SYMBOLS } from "./types";
import Header from "./components/Header";
import ControlPanel from "./components/ControlPanel";
import StatsBar from "./components/StatsBar";
import AnalysisPanel from "./components/AnalysisPanel";
import Leaderboard from "./components/Leaderboard";
import SettingsPanel from "./components/SettingsPanel";
import TradeLogTable from "./components/TradeLogTable";
import SessionSummaryModal from "./components/SessionSummaryModal";
import AuthPanel from "./components/AuthPanel";
import FundsPanel from "./components/FundsPanel";
import { PORTABLE_HTML_TEMPLATE } from "./utils/portableTemplate";

type Tab = "dashboard" | "scanner" | "history" | "settings" | "funds";

const NAV_TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "scanner",   label: "Markets",  icon: "candlestick_chart" },
  { id: "funds",     label: "Funds",    icon: "account_balance_wallet" },
  { id: "dashboard", label: "Trade",    icon: "smart_toy" },
  { id: "history",   label: "History",  icon: "receipt_long" },
  { id: "settings",  label: "Settings", icon: "tune" },
];

export default function App() {
  const {
    config, saveConfig, botState, activeSymbol,
    balance, accountEmail, isRealAccount,
    hasRealDerivAccount, hasDemoDerivAccount,
    sessionProfit, dailyTradesCount, consecutiveLosses, multiplier,
    connectionStatus, reconnectCountdown, evenOddCooldownSkipsRemaining,
    symbolStates, toastHistory,
    tradeLogs, clearTradeLogs, sessionStats, showSummary, closeSummary,
    startBot, stopBot, resetDemoBalance,
    currentUserEmail, login, logout, switchToDemo, switchToDeriv, switchDerivAccountType,
  } = useBot();

  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [bypassAuth, setBypassAuth] = useState(false);
  const [telegramUser, setTelegramUser] = useState<any>(null);
  const [bankBalance, setBankBalance] = useState(0);
  const [hasSavedDerivSession, setHasSavedDerivSession] = useState(false);
  const [showLogsDrawer, setShowLogsDrawer] = useState(false);
  const [lastOpenedLength, setLastOpenedLength] = useState(0);
  const [inspectSymbol, setInspectSymbol] = useState("1HZ100V");

  const telegramId = telegramUser?.id ? String(telegramUser.id) : "default";
  const actualBalance = balance ? parseFloat(balance) : null;
  const availableBalance =
    actualBalance !== null
      ? (!currentUserEmail ? Math.max(0, actualBalance - bankBalance).toFixed(2) : actualBalance.toFixed(2))
      : null;

  const unreadCount = toastHistory.length > lastOpenedLength ? toastHistory.length - lastOpenedLength : 0;
  const isRunning = botState !== "STATE_IDLE" && botState !== "STATE_STOPPED";

  const activeSymbolName = SYMBOLS.find((s) => s.symbol === activeSymbol)?.name || activeSymbol;
  const inspectSymbolState = symbolStates[inspectSymbol];
  const activeSymbolState = activeSymbol ? symbolStates[activeSymbol] : undefined;

  // Sync inspect to active bot symbol
  useEffect(() => { if (activeSymbol) setInspectSymbol(activeSymbol); }, [activeSymbol]);

  // Load bank balance in sandbox mode
  useEffect(() => {
    if (!currentUserEmail && bypassAuth && telegramId) {
      fetch(`/api/bank/balance?telegramId=${telegramId}`)
        .then((r) => r.json())
        .then((d) => setBankBalance(d.balance ?? 0))
        .catch(() => {});
    } else if (currentUserEmail) {
      setBankBalance(0);
    }
  }, [currentUserEmail, bypassAuth, telegramId]);

  // Telegram WebApp init + sequential session restore
  useEffect(() => {
    const runRestore = (uid: string, retries = 3) => {
      fetch("/api/auth/auto-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId: uid }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success || data.reason === "last_mode_was_demo") {
            setHasSavedDerivSession(true);
          }
          if (data.reason === "last_mode_was_demo" || !data.success) {
            fetch("/api/auth/restore-sandbox", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ telegramId: uid }),
            }).catch(() => {});
          }
        })
        .catch(() => { if (retries > 0) setTimeout(() => runRestore(uid, retries - 1), 3000); });
    };

    const detectTg = (attempts: number) => {
      if (typeof window !== "undefined" && window.Telegram?.WebApp) {
        const wa = window.Telegram.WebApp;
        wa.ready(); wa.expand();
        try {
          if (wa.setHeaderColor) wa.setHeaderColor("#fff8f3");
          if (wa.setBackgroundColor) wa.setBackgroundColor("#fff8f3");
        } catch {}
        if (wa.initDataUnsafe?.user) {
          const u = wa.initDataUnsafe.user;
          setTelegramUser(u); setBypassAuth(true); runRestore(String(u.id)); return;
        }
        if (attempts > 0) { setTimeout(() => detectTg(attempts - 1), 150); return; }
      }
      let webId = localStorage.getItem("digit_bot_web_uid");
      if (!webId) { webId = "web_" + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("digit_bot_web_uid", webId); }
      setBypassAuth(true); runRestore(webId);
    };
    detectTg(10);
  }, []);

  // Haptic on trade outcome
  const prevLogsRef = useRef(0);
  useEffect(() => {
    if (tradeLogs.length > prevLogsRef.current && prevLogsRef.current > 0) {
      const latest = tradeLogs[0];
      if (latest && window.Telegram?.WebApp?.HapticFeedback) {
        try {
          latest.outcome === "WIN"
            ? window.Telegram.WebApp.HapticFeedback.notificationOccurred("success")
            : window.Telegram.WebApp.HapticFeedback.notificationOccurred("error");
        } catch {}
      }
    }
    prevLogsRef.current = tradeLogs.length;
  }, [tradeLogs]);

  const hapticLight = () => {
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light"); } catch {}
  };

  const handleLogout = async () => {
    await logout(telegramUser?.id ? String(telegramUser.id) : undefined);
    setBypassAuth(false);
  };

  const handleTabChange = (tab: Tab) => { setActiveTab(tab); hapticLight(); };

  const downloadStandalone = () => {
    try {
      const blob = new Blob([PORTABLE_HTML_TEMPLATE], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "deriv_digit_bot_standalone.html";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#fff8f3] text-[#1e1b16] font-sans antialiased selection:bg-[#ffdea5] selection:text-[#4e3700]">

      {/* ── HEADER ── */}
      <Header
        connectionStatus={connectionStatus}
        balance={availableBalance}
        accountEmail={accountEmail}
        isRealAccount={isRealAccount}
        botState={botState}
        activeSymbolName={activeSymbolName}
        resetDemoBalance={resetDemoBalance}
        currentUserEmail={currentUserEmail}
        onLogout={handleLogout}
        telegramUser={telegramUser}
      />

      {/* ── MAIN CONTENT ── */}
      <main className="pt-16 pb-28 px-4 max-w-lg mx-auto w-full">
        {!currentUserEmail && !bypassAuth ? (
          /* Auth Gate */
          <AuthPanel
            onLogin={async (token) => {
              const res = await login(token);
              if (res.success && telegramUser?.id) {
                setHasSavedDerivSession(true);
                fetch("/api/auth/save-session", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ telegramId: telegramUser.id, derivToken: token }),
                }).catch(() => {});
              }
              return res;
            }}
            onBypass={() => setBypassAuth(true)}
            telegramUser={telegramUser}
          />
        ) : (
          <div className="flex flex-col gap-4 mt-3">
            {/* Guest Mode Banners */}
            {!currentUserEmail && bypassAuth && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0 mt-0.5">warning</span>
                  <p className="text-[11px] text-[#4e4639] leading-snug">
                    <span className="font-black text-[#1e1b16] uppercase">{hasSavedDerivSession ? "Sandbox Demo Mode:" : "Trial Guest Mode:"} </span>
                    {hasSavedDerivSession
                      ? "You have a saved Deriv account. Use Funds tab to switch, or re-login if your token changed."
                      : "Real-time indicators are active but trades are virtual. Login to trade real accounts."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBypassAuth(false)}
                  className="shrink-0 px-2.5 py-1 bg-[#ffdea5] text-[#4e3700] border border-[#c5a059] rounded-lg text-[9px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
                >
                  {hasSavedDerivSession ? "Re-login" : "Login"}
                </button>
              </div>
            )}

            {/* Tab: Trade (Dashboard) */}
            {activeTab === "dashboard" && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <ControlPanel
                  botState={botState} config={config} onConfigChange={saveConfig}
                  startBot={startBot} stopBot={stopBot} activeSymbol={activeSymbol}
                  inspectSymbol={inspectSymbol} setInspectSymbol={setInspectSymbol}
                  connectionStatus={connectionStatus} reconnectCountdown={reconnectCountdown}
                  evenOddCooldownSkipsRemaining={evenOddCooldownSkipsRemaining}
                  symbolStates={symbolStates}
                />
                <StatsBar
                  config={config} botState={botState} activeSymbol={activeSymbol}
                  activeSymbolState={activeSymbolState} sessionProfit={sessionProfit}
                  dailyTradesCount={dailyTradesCount} consecutiveLosses={consecutiveLosses}
                  multiplier={multiplier} evenOddCooldownSkipsRemaining={evenOddCooldownSkipsRemaining}
                />
              </div>
            )}

            {/* Tab: Markets */}
            {activeTab === "scanner" && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <Leaderboard
                  symbolStates={symbolStates} activeSymbol={activeSymbol}
                  inspectSymbol={inspectSymbol} setInspectSymbol={setInspectSymbol}
                  config={config}
                />
                <AnalysisPanel inspectSymbolState={inspectSymbolState} referenceDigit={config.referenceDigit} />
              </div>
            )}

            {/* Tab: History */}
            {activeTab === "history" && (
              <div className="animate-fade-in">
                <TradeLogTable logs={tradeLogs} onClearLogs={clearTradeLogs} />
              </div>
            )}

            {/* Tab: Settings */}
            {activeTab === "settings" && (
              <div className="animate-fade-in">
                <SettingsPanel config={config} saveConfig={saveConfig} isRunning={isRunning} />
              </div>
            )}

            {/* Tab: Funds */}
            {activeTab === "funds" && (
              <div className="animate-fade-in">
                <FundsPanel
                  balance={balance} isRealAccount={isRealAccount} accountEmail={accountEmail}
                  apiToken={config.apiToken} telegramId={telegramId}
                  currentUserEmail={currentUserEmail}
                  hasRealDerivAccount={hasRealDerivAccount} hasDemoDerivAccount={hasDemoDerivAccount}
                  onSwitchToDemo={switchToDemo} onSwitchToDeriv={switchToDeriv}
                  onSwitchDerivAccountType={switchDerivAccountType}
                  onBalanceRefresh={() => {
                    fetch(`/api/bank/balance?telegramId=${telegramId}`)
                      .then((r) => r.json())
                      .then((d) => setBankBalance(d.balance ?? 0))
                      .catch(() => {});
                  }}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── BOTTOM NAV ── */}
      {(currentUserEmail || bypassAuth) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-2 bg-gradient-to-t from-[#fff8f3] via-[#fff8f3]/90 to-transparent">
          <nav className="max-w-lg mx-auto bg-white/95 backdrop-blur-xl border border-[#d1c5b4] shadow-[0_-4px_24px_rgba(0,0,0,0.06)] rounded-2xl p-1.5 flex justify-around items-center">
            {NAV_TABS.map(({ id, label, icon }) => {
              const isActive = activeTab === id;
              const isCenter = id === "dashboard";
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleTabChange(id)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all duration-200 cursor-pointer flex-1 relative ${
                    isCenter
                      ? isActive
                        ? "bg-[#775a19] text-white shadow-md"
                        : "bg-[#ffdea5] text-[#775a19]"
                      : isActive
                      ? "bg-[#f5ede4] text-[#775a19]"
                      : "text-[#7f7667] hover:text-[#4e4639]"
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    {icon}
                  </span>
                  <span className={`text-[9px] uppercase tracking-[0.1em] font-bold ${isActive ? "opacity-100" : "opacity-70"}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* ── FLOATING LOG BUTTON ── */}
      {(currentUserEmail || bypassAuth) && (
        <div className="fixed bottom-24 right-4 z-40">
          <button
            type="button"
            onClick={() => {
              if (!showLogsDrawer) setLastOpenedLength(toastHistory.length);
              setShowLogsDrawer(!showLogsDrawer);
              hapticLight();
            }}
            className="relative w-12 h-12 rounded-full bg-white border border-[#d1c5b4] shadow-lg flex items-center justify-center text-[#775a19] hover:bg-[#ffdea5] active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">terminal</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-orange-500 text-[9px] text-white font-black flex items-center justify-center border-2 border-[#fff8f3] animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ── LOG DRAWER ── */}
      {showLogsDrawer && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => { setLastOpenedLength(toastHistory.length); setShowLogsDrawer(false); }}
        >
          <div
            className="w-full max-w-lg bg-[#fff8f3] border border-[#d1c5b4] border-b-0 rounded-t-2xl shadow-2xl flex flex-col max-h-[70vh] animate-slide-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="p-4 bg-[#f5ede4] border-b border-[#d1c5b4] flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#775a19] text-[18px]">terminal</span>
                <span className="text-[11px] font-bold text-[#1e1b16] uppercase tracking-wider">Live System Logs</span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#e9e1d8] text-[#4e4639]">{toastHistory.length}</span>
              </div>
              <div className="flex items-center gap-2">
                {toastHistory.length > 0 && (
                  <button type="button" onClick={clearTradeLogs} className="text-[9px] font-bold text-error uppercase tracking-wider cursor-pointer">
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setLastOpenedLength(toastHistory.length); setShowLogsDrawer(false); }}
                  className="w-7 h-7 rounded-full border border-[#d1c5b4] flex items-center justify-center text-[#4e4639] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-[200px]">
              {toastHistory.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10">
                  <span className="material-symbols-outlined text-[#d1c5b4] text-4xl">terminal</span>
                  <p className="text-[11px] text-[#7f7667] font-bold uppercase tracking-wider">No System Alerts Yet</p>
                  <p className="text-[10px] text-[#7f7667]/60 text-center max-w-[220px]">Operational records will appear once the bot begins diagnostic cycles.</p>
                </div>
              ) : (
                toastHistory.slice().reverse().map((t) => {
                  const styles: Record<string, string> = {
                    green: "border-success/30 bg-[#f0fdf4] text-success",
                    red: "border-error/30 bg-[#ffdad6]/50 text-error",
                    blue: "border-[#c5a059]/30 bg-[#ffdea5]/30 text-[#775a19]",
                    orange: "border-orange-200 bg-orange-50 text-orange-700",
                  };
                  return (
                    <div key={t.id} className={`p-3 rounded-xl border flex flex-col gap-1 ${styles[t.type] || styles.blue}`}>
                      <p className="text-[12px] font-medium text-[#1e1b16] leading-snug">{t.message}</p>
                      <span className="text-[8px] font-bold uppercase tracking-widest opacity-50">SYSTEM LOG ENTRY</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer footer */}
            <div className="p-3 border-t border-[#d1c5b4]">
              <button
                type="button"
                onClick={() => { setLastOpenedLength(toastHistory.length); setShowLogsDrawer(false); }}
                className="w-full h-11 gold-gradient rounded-xl text-white text-[10px] font-bold uppercase tracking-wider cursor-pointer"
              >
                Close Audit Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SESSION SUMMARY MODAL ── */}
      {showSummary && <SessionSummaryModal stats={sessionStats} onClose={closeSummary} />}
    </div>
  );
}
