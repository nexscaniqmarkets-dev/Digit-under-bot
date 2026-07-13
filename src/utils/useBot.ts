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

export function useBot(externalTelegramId?: string | null) {
  const [config, setConfig] = useState<BotConfig>(DEFAULT_CONFIG);
  const [botState, setBotState] = useState<BotState>("STATE_IDLE");
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [isRealAccount, setIsRealAccount] = useState<boolean>(false);
  const [hasRealDerivAccount, setHasRealDerivAccount] = useState<boolean>(false);
  const [hasDemoDerivAccount, setHasDemoDerivAccount] = useState<boolean>(false);
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
  const [evenOddCooldownSkipsRemaining, setEvenOddCooldownSkipsRemaining] = useState<number>(0);

  const [symbolStates, setSymbolStates] = useState<Record<string, SymbolState>>({});
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [toastHistory, setToastHistory] = useState<ToastMessage[]>([]);
  const [tradeLogs, setTradeLogs] = useState<TradeLog[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [showSummary, setShowSummary] = useState<boolean>(false);

  const toastsRef = useRef<ToastMessage[]>([]);
  toastsRef.current = toasts;

  // Cache the resolved user ID once it's confirmed, so a transient blip in
  // window.Telegram.WebApp.initDataUnsafe.user (e.g. on backgrounding/WebView
  // reload) can never cause a mid-session call to silently fall back to a
  // different (always-sandbox) bot instance keyed on a fresh web UUID.
  const resolvedTelegramIdRef = useRef<string | null>(null);

  // Get user ID — Telegram ID for Telegram users, or a persistent UUID for web users
  const getTelegramId = (): string => {
    // Always prefer the id resolved by App.tsx's reliable retry-based detection.
    // This function used to independently re-check window.Telegram.WebApp on every
    // call with no wait, which raced App.tsx's detection loop: if this fired first
    // (very common — this hook's polling effect used to start on mount, before
    // Telegram's WebView finished populating initDataUnsafe.user), it would lock
    // onto a throwaway web UUID forever, permanently routing every request to a
    // different, always-sandbox bot instance instead of the user's real one.
    if (externalTelegramId) {
      resolvedTelegramIdRef.current = externalTelegramId;
      return externalTelegramId;
    }
    if (resolvedTelegramIdRef.current) return resolvedTelegramIdRef.current;

    try {
      const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      if (tgId) {
        resolvedTelegramIdRef.current = String(tgId);
        return resolvedTelegramIdRef.current;
      }
    } catch {}

    // Web user — use a persistent UUID stored in localStorage
    let webId = localStorage.getItem("digit_bot_web_uid");
    if (!webId) {
      webId = "web_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("digit_bot_web_uid", webId);
    }
    // NOTE: intentionally NOT cached into resolvedTelegramIdRef here — if the real
    // id genuinely isn't available yet, we want the NEXT call to check again
    // rather than permanently locking in the web fallback.
    return webId;
  };

  const postJSON = (url: string, body: Record<string, any> = {}) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, telegramId: getTelegramId() }),
    });

  // Poll state and retrieve latest toasts
  const syncStateWithServer = async () => {
    try {
      const stateRes = await fetch(`/api/bot/state?telegramId=${getTelegramId()}`);
      if (stateRes.ok) {
        const data = await stateRes.json();
        setConfig(data.config);
        setBotState(data.botState);
        setActiveSymbol(data.activeSymbol);
        if (data.balance !== undefined) setBalance(data.balance);
        setAccountEmail(data.accountEmail);
        setIsRealAccount(data.isRealAccount);
        setHasRealDerivAccount(!!data.hasRealDerivAccount);
        setHasDemoDerivAccount(!!data.hasDemoDerivAccount);
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
        if (data.evenOddCooldownSkipsRemaining !== undefined) setEvenOddCooldownSkipsRemaining(data.evenOddCooldownSkipsRemaining);
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
      const toastsRes = await fetch(`/api/bot/toasts?telegramId=${getTelegramId()}`);
      if (toastsRes.ok) {
        const freshToasts: ToastMessage[] = await toastsRes.json();
        if (freshToasts.length > 0) {
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
            const keys = new Set();
            return merged.filter((t) => {
              if (keys.has(t.id)) return false;
              keys.add(t.id);
              return true;
            });
          });

          freshToasts.forEach((toast) => {
            if (toast.dismissible) {
              setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== toast.id));
              }, 4000);
            }
          });
        }
      }
    } catch (e) {}
  };

  // Immediate action handles
  const startBot = async () => {
    try {
      const res = await postJSON("/api/bot/start");
      if (res.ok) {
        const data = await res.json();
        setBotState(data.botState);
      }
    } catch (e) { console.error(e); }
  };

  const stopBot = async () => {
    try {
      const res = await postJSON("/api/bot/stop");
      if (res.ok) {
        const data = await res.json();
        setBotState(data.botState);
      }
    } catch (e) { console.error(e); }
  };

  const saveConfig = async (newConfig: BotConfig) => {
    setConfig(newConfig);
    try {
      await postJSON("/api/bot/config", newConfig as any);
    } catch (e) { console.error(e); }
  };

  const clearTradeLogs = async () => {
    try {
      await postJSON("/api/bot/clear-logs");
      setTradeLogs([]);
      setToastHistory([]);
    } catch (e) { console.error(e); }
  };

  const closeSummary = async () => {
    try {
      await postJSON("/api/bot/dismiss-summary");
      setShowSummary(false);
    } catch (e) { console.error(e); }
  };

  const resetDemoBalance = async () => {
    try {
      const res = await postJSON("/api/bot/reset-demo-balance", { telegramId: getTelegramId() });
      if (res.ok) {
        const data = await res.json();
        if (data.balance !== undefined) setBalance(data.balance);
        setConfig(data.config);
      }
    } catch (e) { console.error(e); }
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const login = async (token: string) => {
    try {
      const res = await postJSON("/api/auth/login", { token });
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

  // Switch to sandbox demo mode (disconnect from Deriv, keep token saved)
  const switchToDemo = async () => {
    try {
      const res = await postJSON("/api/auth/switch-to-demo");
      const data = await res.json();
      if (data.success) {
        setCurrentUserEmail(null);
        setBalance(data.balance ?? "10000.00");
        setIsRealAccount(false);
        setAccountEmail("demo.testing@deriv.com");
      }
      return data;
    } catch (e) {
      return { success: false, error: "Switch failed." };
    }
  };

  // Switch back to Deriv account (manual toggle — always uses saved token)
  const switchToDeriv = async () => {
    try {
      const res = await postJSON("/api/auth/switch-to-deriv");
      const data = await res.json();
      if (data.success) {
        setCurrentUserEmail(data.state?.currentUserEmail ?? null);
      }
      return data;
    } catch (e) {
      return { success: false, error: "Switch failed." };
    }
  };

  // Switch between the real and demo Deriv account linked to the same token
  // (does not require re-entering the API token)
  const switchDerivAccountType = async (accountType: "real" | "demo") => {
    try {
      const res = await postJSON("/api/auth/switch-deriv-account-type", { accountType });
      const data = await res.json();
      if (data.success) {
        setIsRealAccount(data.state?.isRealAccount ?? (accountType === "real"));
        if (data.state?.balance !== undefined) setBalance(data.state.balance);
      }
      return data;
    } catch (e) {
      return { success: false, error: "Switch failed." };
    }
  };

  const logout = async (telegramId?: string) => {
    try {
      const res = await postJSON("/api/auth/logout", { telegramId: telegramId ?? getTelegramId() });
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
    // Don't start polling until App.tsx's reliable Telegram-id detection has
    // resolved (or explicitly fallen back to a web id). Starting earlier is
    // exactly what caused requests to race ahead of detection and lock onto
    // the wrong bot instance.
    if (!externalTelegramId) return;

    // Note: session/balance restoration is handled sequentially in App.tsx
    // to avoid race conditions between auto-login and sandbox restore

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
  }, [externalTelegramId]);

  return {
    config,
    saveConfig,
    botState,
    activeSymbol,
    balance,
    accountEmail,
    isRealAccount,
    hasRealDerivAccount,
    hasDemoDerivAccount,
    sessionProfit,
    dailyTradesCount,
    consecutiveLosses,
    multiplier,
    inRecovery,
    sequenceDone,
    awaitingSettlement,
    connectionStatus,
    reconnectCountdown,
    evenOddCooldownSkipsRemaining,
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
    logout,
    switchToDemo,
    switchToDeriv,
    switchDerivAccountType
  };
}
