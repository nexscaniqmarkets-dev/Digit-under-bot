import { useState, useEffect, useRef } from "react";
import {
  BotConfig,
  BotState,
  SymbolState,
  TradeLog,
  ToastMessage,
  SessionStats
} from "../types";

const DEFAULT_CONFIG: BotConfig = {
  stakeAmount: 2.0,
  referenceDigit: 7,
  analysisTickCount: 120,
  minUnderPercentage: 65,
  confirmationRequired: 2,
  tradeSequenceCount: 3,
  stopLoss: 4.0,
  takeProfit: 6.0,
  maxDailyTrades: 50,
  selectedSymbol: "1HZ100V",
  mode: "Standard",
  appId: "1089",
  apiToken: "",
  demoMode: true
};

export function useBot() {
  const [config, setConfig] = useState<BotConfig>(DEFAULT_CONFIG);
  const [botState, setBotState] = useState<BotState>("STATE_IDLE");
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [isRealAccount, setIsRealAccount] = useState<boolean>(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const [sessionProfit, setSessionProfit] = useState<number>(0);
  const [dailyTradesCount, setDailyTradesCount] = useState<number>(0);
  const [consecutiveLosses, setConsecutiveLosses] = useState<number>(0);
  const [multiplier, setMultiplier] = useState<number>(1);
  const [inRecovery, setInRecovery] = useState<boolean>(false);
  const [sequenceDone, setSequenceDone] = useState<number>(0);
  const [awaitingSettlement, setAwaitingSettlement] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [reconnectCountdown, setReconnectCountdown] = useState<number | null>(null);

  const [symbolStates, setSymbolStates] = useState<Record<string, SymbolState>>({});
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [toastHistory, setToastHistory] = useState<ToastMessage[]>([]);
  const [tradeLogs, setTradeLogs] = useState<TradeLog[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [showSummary, setShowSummary] = useState<boolean>(false);

  const toastsRef = useRef<ToastMessage[]>([]);
  toastsRef.current = toasts;

  // Poll state and retrieve latest toasts
  const syncStateWithServer = async () => {
    try {
      const stateRes = await fetch("/api/bot/state");
      if (stateRes.ok) {
        const data = await stateRes.json();
        setConfig(data.config);
        setBotState(data.botState);
        setActiveSymbol(data.activeSymbol);
        setBalance(data.balance);
        setAccountEmail(data.accountEmail);
        setIsRealAccount(data.isRealAccount);
        setCurrentUserEmail(data.currentUserEmail);
        setSessionProfit(data.sessionProfit);
        setDailyTradesCount(data.dailyTradesCount);
        setConsecutiveLosses(data.consecutiveLosses);
        setMultiplier(data.multiplier);
        setInRecovery(data.inRecovery);
        setSequenceDone(data.sequenceDone);
        setAwaitingSettlement(data.awaitingSettlement);
        setConnectionStatus(data.connectionStatus);
        setReconnectCountdown(data.reconnectCountdown);
        setSymbolStates(data.symbolStates || {});
        setTradeLogs(data.tradeLogs || []);
        setSessionStats(data.sessionStats);
        setShowSummary(data.showSummary);
      }
    } catch (e) {
      console.warn("Retrying backend sync connection...", e);
    }
  };

  const getNewToastsFromServer = async () => {
    try {
      const toastsRes = await fetch("/api/bot/toasts");
      if (toastsRes.ok) {
        const freshToasts: ToastMessage[] = await toastsRes.json();
        if (freshToasts.length > 0) {
          // Keep a persistent history of all toasts for our bottom logs drawer
          setToastHistory((prev) => {
            const merged = [...prev, ...freshToasts];
            const keys = new Set();
            return merged.filter((t) => {
              if (keys.has(t.id)) return false;
              keys.add(t.id);
              return true;
            });
          });

          setToasts((prev) => {
            const merged = [...prev, ...freshToasts];
            // Filter unique ids
            const keys = new Set();
            return merged.filter((t) => {
              if (keys.has(t.id)) return false;
              keys.add(t.id);
              return true;
            });
          });

          // Auto remove standard toasts after 4 seconds
          freshToasts.forEach((toast) => {
            if (toast.dismissible) {
              setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== toast.id));
              }, 4000);
            }
          });
        }
      }
    } catch (e) {
      // Slient catch
    }
  };

  // Immediate action handles
  const startBot = async () => {
    try {
      const res = await fetch("/api/bot/start", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setBotState(data.botState);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const stopBot = async () => {
    try {
      const res = await fetch("/api/bot/stop", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setBotState(data.botState);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveConfig = async (newConfig: BotConfig) => {
    setConfig(newConfig);
    try {
      await fetch("/api/bot/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig)
      });
    } catch (e) {
      console.error(e);
    }
  };

  const clearTradeLogs = async () => {
    try {
      await fetch("/api/bot/clear-logs", { method: "POST" });
      setTradeLogs([]);
      setToastHistory([]);
    } catch (e) {
      console.error(e);
    }
  };

  const closeSummary = async () => {
    try {
      await fetch("/api/bot/dismiss-summary", { method: "POST" });
      setShowSummary(false);
    } catch (e) {
      console.error(e);
    }
  };

  const resetDemoBalance = async () => {
    try {
      const res = await fetch("/api/bot/reset-demo-balance", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
        setConfig(data.config);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const login = async (token: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUserEmail(data.state.currentUserEmail);
        localStorage.setItem("deriv_digit_bot_token", token.trim());
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (e) {
      return { success: false, error: "Network error. Failed to connect to secure server." };
    }
  };

  const signup = async (email: string, passwordRaw: string, derivToken: string) => {
    return { success: false, error: "Please use the official affiliate register link to create your account." };
  };

  const logout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setCurrentUserEmail(null);
        localStorage.removeItem("deriv_digit_bot_token");
        return { success: true };
      }
    } catch (e) {}
    localStorage.removeItem("deriv_digit_bot_token");
    setCurrentUserEmail(null);
    return { success: false };
  };

  // Main background syncing cycle
  useEffect(() => {
    // Check if there is a saved token in localStorage for automatic login
    const savedToken = localStorage.getItem("deriv_digit_bot_token");
    if (savedToken) {
      fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: savedToken })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setCurrentUserEmail(data.state.currentUserEmail);
          } else {
            // Token rejected/invalid, let's clean up
            localStorage.removeItem("deriv_digit_bot_token");
          }
        })
        .catch((err) => {
          console.warn("Failed automatic login with saved token:", err);
        });
    }

    // Sync immediately
    syncStateWithServer();
    getNewToastsFromServer();

    // Fast polling for state (including digit chart frequencies, tick events)
    const intervalFast = setInterval(() => {
      syncStateWithServer();
    }, 1000);

    // Prompt toasts retrieval
    const intervalToasts = setInterval(() => {
      getNewToastsFromServer();
    }, 500);

    return () => {
      clearInterval(intervalFast);
      clearInterval(intervalToasts);
    };
  }, []);

  return {
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
    awaitingSettlement,
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
  };
}
