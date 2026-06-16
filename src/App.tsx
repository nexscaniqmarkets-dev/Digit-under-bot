import { useState, useEffect, useRef } from "react";
import { useBot } from "./utils/useBot";
import { SYMBOLS } from "./types";
import {
  Download,
  Terminal,
  X,
  AlertTriangle,
  LayoutDashboard,
  Activity,
  FileSpreadsheet,
  Settings,
  Wallet
} from "lucide-react";
import Header from "./components/Header";
import ControlPanel from "./components/ControlPanel";
import StatsBar from "./components/StatsBar";
import AnalysisPanel from "./components/AnalysisPanel";
import Leaderboard from "./components/Leaderboard";
import SettingsPanel from "./components/SettingsPanel";
import TradeLogTable from "./components/TradeLogTable";
import SessionSummaryModal from "./components/SessionSummaryModal";
import { PORTABLE_HTML_TEMPLATE } from "./utils/portableTemplate";
import AuthPanel from "./components/AuthPanel";
import FundsPanel from "./components/FundsPanel";

export default function App() {
  const {
    config,
    saveConfig,
    botState,
    activeSymbol,
    balance,
    accountEmail,
    isRealAccount,
    sessionProfit,
    dailyTradesCount,
    consecutiveLosses,
    multiplier,
    inRecovery,
    sequenceDone,
    connectionStatus,
    reconnectCountdown,
    symbolStates,
    toasts,
    toastHistory,
    removeToast,
    tradeLogs,
    clearTradeLogs,
    sessionStats,
    showSummary,
    closeSummary,
    startBot,
    stopBot,
    resetDemoBalance,
    currentUserEmail,
    login,
    signup,
    logout
  } = useBot();

  // Tab State
  const [activeTab, setActiveTab ] = useState<"dashboard" | "scanner" | "history" | "settings" | "funds">("dashboard");
  const [bypassAuth, setBypassAuth] = useState(false);
  const [telegramUser, setTelegramUser] = useState<any>(null);
  const [bankBalance, setBankBalance] = useState<number>(0);

  const telegramId = telegramUser?.id ? String(telegramUser.id) : "default";
  // Available balance = total minus what's in Reserved Bank (works for both demo and real)
  const actualBalance = balance ? parseFloat(balance) : null;
  const availableBalance = actualBalance !== null ? Math.max(0, actualBalance - bankBalance).toFixed(2) : null;

  // Load bank balance whenever user logs in
  useEffect(() => {
    if ((currentUserEmail || bypassAuth) && telegramId) {
      fetch(`/api/bank/balance?telegramId=${telegramId}`)
        .then(r => r.json())
        .then(data => setBankBalance(data.balance ?? 0))
        .catch(() => {});
    }
  }, [currentUserEmail, bypassAuth, telegramId]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp;
      webApp.ready();
      webApp.expand();
      try {
        if (webApp.setHeaderColor) webApp.setHeaderColor("#0c0c10");
        if (webApp.setBackgroundColor) webApp.setBackgroundColor("#0c0c10");
      } catch (err) {
        console.warn("Setting Telegram header/bg color warning:", err);
      }
      if (webApp.initDataUnsafe?.user) {
        const tgUser = webApp.initDataUnsafe.user;
        setTelegramUser(tgUser);
        setBypassAuth(true);

        // ── Auto-login with saved session ─────────────────────────────────────
        // Try to restore the user's Deriv session using their Telegram ID
        fetch("/api/auth/auto-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telegramId: tgUser.id }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.success) {
              console.log("[Session] Auto-login successful for", tgUser.username);
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  // Watch tradeLogs length to trigger haptic vibrations when inside Telegram WebApp
  const prevLogsCountRef = useRef(0);
  useEffect(() => {
    if (tradeLogs.length > prevLogsCountRef.current) {
      if (prevLogsCountRef.current > 0) {
        const latestLog = tradeLogs[0]; // sorted newest first
        if (latestLog && typeof window !== "undefined" && window.Telegram?.WebApp?.HapticFeedback) {
          const haptic = window.Telegram.WebApp.HapticFeedback;
          if (latestLog.outcome === "WIN") {
            try { haptic.notificationOccurred("success"); } catch (e) {}
          } else {
            try { haptic.notificationOccurred("error"); } catch (e) {}
          }
        }
      }
    }
    prevLogsCountRef.current = tradeLogs.length;
  }, [tradeLogs]);

  const triggerLightHaptic = () => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp?.HapticFeedback) {
      try {
        window.Telegram.WebApp.HapticFeedback.impactOccurred("light");
      } catch (e) {}
    }
  };

  const handleLogout = async () => {
    const tgId = telegramUser?.id;
    await logout(tgId ? String(tgId) : undefined);
    setBypassAuth(false);
  };

  // State for toggling custom notification history drawer at the bottom
  const [showLogsDrawer, setShowLogsDrawer] = useState(false);
  const [lastOpenedLength, setLastOpenedLength] = useState(0);

  const unreadCount = toastHistory.length > lastOpenedLength
    ? toastHistory.length - lastOpenedLength
    : 0;

  const toggleLogsDrawer = () => {
    if (!showLogsDrawer) {
      setLastOpenedLength(toastHistory.length);
    }
    setShowLogsDrawer(!showLogsDrawer);
  };

  // User-selected symbol for detailed inspect graphs
  const [inspectSymbol, setInspectSymbol] = useState<string>("1HZ100V");

  // Dynamically sync inspection target to current bot active target
  useEffect(() => {
    if (activeSymbol) {
      setInspectSymbol(activeSymbol);
    }
  }, [activeSymbol]);

  // Download Standalone Client HTML5 file trigger
  const downloadStandaloneClient = () => {
    try {
      const blob = new Blob([PORTABLE_HTML_TEMPLATE], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "deriv_digit_bot_standalone.html";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Export standalone files error: ", e);
    }
  };

  const isRunning = botState !== "STATE_IDLE" && botState !== "STATE_STOPPED";

  // Find info objects
  const activeSymbolName = SYMBOLS.find((s) => s.symbol === activeSymbol)?.name || activeSymbol;
  const inspectSymbolState = symbolStates[inspectSymbol];
  const activeSymbolState = activeSymbol ? symbolStates[activeSymbol] : undefined;

  return (
    <div className="min-h-screen bg-bg-main text-neutral-200 font-sans antialiased pb-32 flex flex-col justify-between selection:bg-gold-500/20 selection:text-gold-400">
      {/* Top Stack Content Wrapper */}
      <div className="flex flex-col gap-6 w-full">
        {/* Header segment */}
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

        {/* Global Warning for test accounts/Demo setup */}
        {config.demoMode && !config.apiToken && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="bg-gold-500/5 border border-gold-500/15 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-gold-500 font-sans">
              <div className="flex items-center gap-2.5 text-xs text-left">
                <AlertTriangle className="h-4 w-4 shrink-0 text-gold-500" />
                <p className="leading-snug">
                  <span className="font-bold text-white mr-1.5">SIMULATION SANDBOX ACTIVE:</span>
                  Operating in secure paper trading mode. All real-time signals, patterns, and safety indicators are live, but transactions are completely virtual.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadStandaloneClient}
                className="text-[9px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-lg border border-gold-500/25 hover:bg-gold-500/10 text-white shrink-0 flex items-center gap-1.5 outline-none transition-all duration-200 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-gold-500" /> Export Standalone App
              </button>
            </div>
          </div>
        )}

        {/* Tab-driven Content Grid */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col gap-6">
          {!currentUserEmail && !bypassAuth ? (
            <div className="py-12 w-full flex items-center justify-center">
              <AuthPanel
                onLogin={async (token: string) => {
                  const result = await login(token);
                  if (result.success && telegramUser?.id) {
                    // Save session so user stays logged in next time
                    fetch("/api/auth/save-session", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ telegramId: telegramUser.id, derivToken: token }),
                    }).catch(() => {});
                  }
                  return result;
                }}
                onBypass={() => setBypassAuth(true)}
                telegramUser={telegramUser}
              />
            </div>
          ) : (
            <>
              {/* Optional Prompt to Log In when Bypassed (Guest Trial mode) */}
              {!currentUserEmail && bypassAuth && (
                <div className="bg-white/[0.02] border border-white/[0.05] p-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-neutral-400 font-sans text-xs w-full animate-fade-in">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <p>
                      <span className="font-bold text-white mr-1.5 uppercase">Trial Guest Mode Active:</span>
                      Real-time index indicators are active but trades are strictly paper virtuals. Create a free account or login to trade on real accounts.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBypassAuth(false)}
                    className="px-3.5 py-1.5 bg-gold-500/10 hover:bg-gold-500 hover:text-black border border-gold-500/25 rounded-lg text-gold-400 text-[10px] font-bold uppercase transition-all shrink-0 cursor-pointer"
                  >
                    Login / Sign Up
                  </button>
                </div>
              )}

              {/* TAB 1: DASHBOARD (Active controllers + metrics list) */}
              {activeTab === "dashboard" && (
                <div className="flex flex-col gap-6 animate-fade-in duration-300">
                  <ControlPanel
                    botState={botState}
                    config={config}
                    onConfigChange={saveConfig}
                    startBot={startBot}
                    stopBot={stopBot}
                    activeSymbol={activeSymbol}
                    inspectSymbol={inspectSymbol}
                    setInspectSymbol={setInspectSymbol}
                    connectionStatus={connectionStatus}
                    reconnectCountdown={reconnectCountdown}
                  />

                  <StatsBar
                    config={config}
                    botState={botState}
                    activeSymbol={activeSymbol}
                    activeSymbolState={activeSymbolState}
                    sessionProfit={sessionProfit}
                    dailyTradesCount={dailyTradesCount}
                    consecutiveLosses={consecutiveLosses}
                    multiplier={multiplier}
                  />
                  
                  {/* Micro Helper Tip to point towards tabs */}
                  <div className="bg-white/[0.01] border border-white/[0.04] p-4 rounded-xl text-center">
                    <p className="text-[11px] text-neutral-400 font-medium uppercase tracking-wider">
                      💡 The Bot is operating safely in the background. Use the bottom navigation bar to audit live markets or modify parameters.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: MARKETS & SCANNER */}
              {activeTab === "scanner" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in duration-300">
                  {/* Left: Leaderboard list (13 systems) */}
                  <div className="lg:col-span-4 h-full">
                    <Leaderboard
                      symbolStates={symbolStates}
                      activeSymbol={activeSymbol}
                      inspectSymbol={inspectSymbol}
                      setInspectSymbol={setInspectSymbol}
                      config={config}
                    />
                  </div>

                  {/* Right: Detailed active inspecting visual panel graph */}
                  <div className="lg:col-span-8 h-full">
                    <AnalysisPanel
                      inspectSymbolState={inspectSymbolState}
                      referenceDigit={config.referenceDigit}
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: TRANSACTION LOGS */}
              {activeTab === "history" && (
                <div className="animate-fade-in duration-300">
                  <TradeLogTable logs={tradeLogs} onClearLogs={clearTradeLogs} />
                </div>
              )}

              {/* TAB 4: SYSTEM SETTINGS */}
              {activeTab === "settings" && (
                <div className="animate-fade-in duration-300">
                  <SettingsPanel config={config} saveConfig={saveConfig} isRunning={isRunning} />
                </div>
              )}

              {/* TAB 5: FUNDS MANAGER */}
              {activeTab === "funds" && (
                <div className="animate-fade-in duration-300">
                  <FundsPanel
                    balance={balance}
                    isRealAccount={isRealAccount}
                    accountEmail={accountEmail}
                    apiToken={config.apiToken}
                    telegramId={telegramId}
                    onBalanceRefresh={() => {
                      fetch(`/api/bank/balance?telegramId=${telegramId}`)
                        .then(r => r.json())
                        .then(data => setBankBalance(data.balance ?? 0))
                        .catch(() => {});
                    }}
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Footer Info line */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 w-full text-center text-[10px] tracking-wider uppercase text-neutral-500 border-t border-white/[0.06] pt-5 pb-10 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans font-semibold">
        <p className="flex items-center gap-1.5 font-medium leading-none">
          <Terminal className="h-3.5 w-3.5 text-gold-500" /> Server-side Bot Background Mode Active
        </p>
        <button
          type="button"
          onClick={downloadStandaloneClient}
          className="text-[10px] hover:text-gold-500 flex items-center gap-1.5 focus:outline-none transition-colors border-b border-dashed border-neutral-600 pb-0.5 font-bold cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" /> Standalone Client Export (Single Page HTML)
        </button>
      </footer>

      {/* Polished Floating Dock Navigation Bar at the Bottom */}
      {(currentUserEmail || bypassAuth) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2 bg-gradient-to-t from-bg-main via-bg-main/90 to-transparent">
          <nav className="max-w-md mx-auto bg-bg-card/95 backdrop-blur-lg border border-white/[0.08] shadow-2xl rounded-2xl p-1.5 flex justify-around items-center">
            {/* Tab 1: Dashboard Button */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("dashboard");
                triggerLightHaptic();
              }}
              className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 cursor-pointer flex-1 ${
                activeTab === "dashboard"
                  ? "bg-gold-500/10 text-gold-400 font-bold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="text-[9px] uppercase tracking-wider">Dashboard</span>
            </button>

            {/* Tab 2: Scanner Button */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("scanner");
                triggerLightHaptic();
              }}
              className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 cursor-pointer flex-1 ${
                activeTab === "scanner"
                  ? "bg-gold-500/10 text-gold-400 font-bold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Activity className="h-4 w-4" />
              <span className="text-[9px] uppercase tracking-wider">Markets</span>
            </button>

            {/* Tab 3: History Button */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("history");
                triggerLightHaptic();
              }}
              className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 cursor-pointer flex-1 ${
                activeTab === "history"
                  ? "bg-gold-500/10 text-gold-400 font-bold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="text-[9px] uppercase tracking-wider">History</span>
            </button>

            {/* Tab 4: Settings Button */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("settings");
                triggerLightHaptic();
              }}
              className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 cursor-pointer flex-1 ${
                activeTab === "settings"
                  ? "bg-gold-500/10 text-gold-400 font-bold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Settings className="h-4 w-4" />
              <span className="text-[9px] uppercase tracking-wider">Settings</span>
            </button>

            {/* Tab 5: Funds Button */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("funds");
                triggerLightHaptic();
              }}
              className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 cursor-pointer flex-1 ${
                activeTab === "funds"
                  ? "bg-gold-500/10 text-gold-400 font-bold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Wallet className="h-4 w-4" />
              <span className="text-[9px] uppercase tracking-wider">Funds</span>
            </button>
          </nav>
        </div>
      )}

      {/* Floating Action Button for Live Action Log updates */}
      {(currentUserEmail || bypassAuth) && (
        <div className="fixed bottom-24 right-5 z-40">
          <button
            type="button"
            onClick={() => {
              toggleLogsDrawer();
              triggerLightHaptic();
            }}
            className="relative group p-3.5 rounded-full border border-gold-500/30 bg-[#15151c]/95 hover:bg-gold-500 hover:text-black text-gold-400 font-bold shadow-2xl transition-all duration-300 pointer-events-auto hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center"
            title="Open Live Audit Alerts"
          >
            <Terminal className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] px-1 rounded-full bg-orange-500 text-[10px] text-white font-black flex items-center justify-center border-2 border-bg-main animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Slide-over/Bottom log activity list drawer */}
      {showLogsDrawer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in pointer-events-auto">
          <div className="bg-[#14141a] border border-white/[0.08] w-full max-w-lg rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] animate-slide-in-up">
            {/* Header */}
            <div className="p-4 bg-[#1b1b22] border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-gold-500" />
                <span className="text-[11px] font-bold text-white uppercase tracking-wider">Live System Execution Logs</span>
                <span className="text-[9px] font-mono bg-white/[0.03] text-neutral-400 px-1.5 py-0.5 rounded">
                  {toastHistory.length} entry(s)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {toastHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={clearTradeLogs}
                    className="text-[9px] font-bold text-neutral-500 hover:text-rose-400 transition-colors uppercase cursor-pointer"
                  >
                    Clear History
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setLastOpenedLength(toastHistory.length);
                    setShowLogsDrawer(false);
                  }}
                  className="p-1 rounded-lg hover:bg-white/[0.04] text-neutral-400 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* List Body */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1 min-h-[250px] bg-[#0c0c0f]">
              {toastHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-2">
                  <Terminal className="h-8 w-8 text-neutral-600 animate-pulse" />
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">No System Alerts Recorded Yet</p>
                  <p className="text-[9px] text-neutral-600 uppercase max-w-[280px]">Operational records will be logged dynamically when the bot begins diagnostic cycles.</p>
                </div>
              ) : (
                toastHistory.slice().reverse().map((toast) => {
                  let badgeColor = "border-white/[0.05] text-neutral-400 bg-white/[0.01]";
                  if (toast.type === "blue") badgeColor = "border-gold-500/20 text-gold-400 bg-gold-500/5";
                  else if (toast.type === "orange") badgeColor = "border-orange-500/20 text-orange-400 bg-orange-500/5";
                  else if (toast.type === "green") badgeColor = "border-emerald-500/20 text-emerald-400 bg-emerald-500/5";
                  else if (toast.type === "red") badgeColor = "border-rose-500/20 text-rose-450 bg-rose-500/5";

                  return (
                    <div
                      key={toast.id}
                      className={`p-3 rounded-lg border flex flex-col gap-1 text-left ${badgeColor}`}
                    >
                      <p className="text-xs font-semibold text-neutral-200 leading-snug">{toast.message}</p>
                      <span className="text-[8px] font-mono text-neutral-500 tracking-wider">SYSTEM ACTION LOG ENTRY</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-[#0c0c0f] border-t border-white/[0.04] text-center">
              <button
                type="button"
                onClick={() => {
                  setLastOpenedLength(toastHistory.length);
                  setShowLogsDrawer(false);
                }}
                className="w-full py-2 bg-[#1b1b22] border border-white/[0.06] rounded-lg text-white hover:bg-gold-500 hover:text-black hover:border-gold-500 transition-all text-[10px] font-bold tracking-wider uppercase cursor-pointer"
              >
                Close Audit Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats summary Popups Modals shown when halted */}
      {showSummary && <SessionSummaryModal stats={sessionStats} onClose={closeSummary} />}
    </div>
  );
}
