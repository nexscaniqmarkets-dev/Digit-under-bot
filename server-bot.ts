import WebSocket from "ws";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import https from "https";
import {
  BotConfig,
  BotState,
  SymbolState,
  TradeLog,
  ToastMessage,
  SessionStats
} from "./src/types";

// ─── Telegram Notifier ────────────────────────────────────────────────────────
// Sends push messages to a Telegram chat via Bot API when key events occur.
// Set TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID in .env to activate.

class TelegramNotifier {
  private token: string | null;
  private chatId: string | null;
  private enabled: boolean;

  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN ?? null;
    this.chatId = process.env.TELEGRAM_ADMIN_CHAT_ID ?? null;
    this.enabled = !!(this.token && this.chatId);
    if (this.enabled) {
      console.log("[TG] Telegram notifications enabled");
    }
  }

  /** Send a plain Markdown message */
  send(text: string): void {
    if (!this.enabled) return;
    const body = JSON.stringify({
      chat_id: this.chatId,
      text,
      parse_mode: "Markdown",
      disable_notification: false,
    });
    const req = https.request(
      {
        hostname: "api.telegram.org",
        path: `/bot${this.token}/sendMessage`,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          console.error(`[TG] sendMessage failed: HTTP ${res.statusCode}`);
        }
      }
    );
    req.on("error", (e) => console.error("[TG] sendMessage error:", e.message));
    req.write(body);
    req.end();
  }

  notifyTradeWin(log: TradeLog) {
    this.send(
      `✅ *WIN* — ${log.symbol}\n` +
      `Profit: \`+$${log.profit.toFixed(2)}\` | Session: \`$${log.session_profit.toFixed(2)}\`\n` +
      `Trade #${log.daily_trade_no} | Mode: ${log.mode}`
    );
  }

  notifyTradeLoss(log: TradeLog) {
    this.send(
      `❌ *LOSS* — ${log.symbol}\n` +
      `Loss: \`-$${Math.abs(log.profit).toFixed(2)}\` | Session: \`$${log.session_profit.toFixed(2)}\`\n` +
      `Consecutive losses: ${log.consecutive_losses_before + 1} | Mode: ${log.mode}`
    );
  }

  notifySessionStopped(stats: SessionStats) {
    const emoji = stats.netProfit >= 0 ? "🟢" : "🔴";
    this.send(
      `🛑 *Session Ended*\n` +
      `${emoji} P&L: \`$${stats.netProfit.toFixed(2)}\`\n` +
      `Trades: ${stats.totalTrades} | W/L: ${stats.wins}/${stats.losses} | WR: ${stats.winRate}%\n` +
      `_Reason: ${stats.stopReason}_`
    );
  }

  notifyBotStarted(email: string, mode: string, stake: number) {
    this.send(
      `🚀 *Bot Started*\n` +
      `Account: \`${email}\`\n` +
      `Mode: ${mode} | Stake: \`$${stake.toFixed(2)}\``
    );
  }

  notifyConnected(email: string, isReal: boolean) {
    this.send(
      `🔗 *Deriv Connected*\n` +
      `Account: \`${email}\`\n` +
      `Type: ${isReal ? "Real 💰" : "Demo 🧪"}`
    );
  }
}

const tgNotifier = new TelegramNotifier();

const SYMBOLS = [
  { symbol: "R_10", name: "Volatility 10" },
  { symbol: "R_25", name: "Volatility 25" },
  { symbol: "R_50", name: "Volatility 50" },
  { symbol: "R_75", name: "Volatility 75" },
  { symbol: "R_100", name: "Volatility 100" },
  { symbol: "1HZ10V", name: "Volatility 10 (1s)" },
  { symbol: "1HZ15V", name: "Volatility 15 (1s)" },
  { symbol: "1HZ25V", name: "Volatility 25 (1s)" },
  { symbol: "1HZ30V", name: "Volatility 30 (1s)" },
  { symbol: "1HZ50V", name: "Volatility 50 (1s)" },
  { symbol: "1HZ75V", name: "Volatility 75 (1s)" },
  { symbol: "1HZ90V", name: "Volatility 90 (1s)" },
  { symbol: "1HZ100V", name: "Volatility 100 (1s)" }
];

const CONFIG_FILE = path.join(process.cwd(), "bot-config-store.json");
const LOGS_FILE = path.join(process.cwd(), "bot-logs-store.json");
const USERS_FILE = path.join(process.cwd(), "bot-users-store.json");

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
  mode: "GradualRecoveryProLite",
  showAllModes: false,
  appId: "1089",
  apiToken: "",
  demoMode: true,
  demoBalance: 10000.00
};

class ServerBot {
  private config: BotConfig = { ...DEFAULT_CONFIG };
  private botState: BotState = "STATE_IDLE";
  private activeSymbol: string | null = null;
  private balance: string | null = null;
  private accountEmail: string | null = null;
  private isRealAccount: boolean = false;
  private currentUserEmail: string | null = null;
  private telegramId: string;
  private accountCurrency: string = "USD";
  private bankBalance: number = 0;
  private sandboxBalance: number = 10000.00; // Isolated sandbox demo balance
  private derivBalance: string | null = null; // Isolated Deriv account balance
  // Callback to persist demoBalance to MongoDB immediately after trades (set by server.ts)
  public onBalanceChange: ((telegramId: string, balance: number) => void) | null = null;
  // Signal tightening after losses (Standard mode + Split-M Pro)
  private recoverySignalThreshold: number = 0;
  private recoveryConfirmationsRequired: number = 0;
  private consecutiveWinsInRecovery: number = 0;

  private sessionProfit: number = 0;
  private dailyTradesCount: number = 0;
  private consecutiveLosses: number = 0;
  private accumulatedLoss: number = 0;
  private multiplier: number = 1;
  private inRecovery: boolean = false;
  private sequenceDone: number = 0;
  private awaitingSettlement: boolean = false;
  private connectionStatus: "disconnected" | "connecting" | "connected" = "disconnected";
  private reconnectCountdown: number | null = null;

  private symbolStates: Record<string, SymbolState> = {};
  private tradeLogs: TradeLog[] = [];
  private sessionStats: SessionStats | null = null;
  private showSummary: boolean = false;

  // Real-time server-side toasts queue
  private toasts: ToastMessage[] = [];

  // WebSocket reference
  private ws: WebSocket | null = null;
  private derivWsUrl: string | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private silenceCheckInterval: NodeJS.Timeout | null = null;

  // Trade tracking refs equivalent
  private pendingRealContract: { id: number | string; symbol: string; stake: number; seq: number } | null = null;
  private pendingVirtualContract: { symbol: string; stake: number; barrier: number; multiplier: number; seq: number; timestamp: string } | null = null;

  // Streak/Perf Trackers
  private currentStreak: number = 0;
  private bestStreak: number = 0;
  private peakProfit: number = 0;
  private worstDrawdown: number = 0;

  constructor(telegramId: string = "default") {
    this.telegramId = telegramId;
    this.ensureUsersFileExists();
    this.loadPersistence();
    this.initializeSymbolStates();
    this.startSilenceMonitor();
    
    // Initialize sandbox balance from config persistence
    this.sandboxBalance = this.config.demoBalance ?? 10000.00;

    // Only set balance display if in sandbox mode
    if (this.config.demoMode || !this.config.apiToken) {
      if (!this.balance || this.balance === "0.00") {
        this.balance = this.sandboxBalance.toFixed(2);
      }
      this.accountEmail = "demo.testing@deriv.com";
      this.isRealAccount = false;
    }
  }

  // Clean up intervals when bot instance is destroyed
  public setBankBalance(amount: number) {
    this.bankBalance = amount;
  }

  public restoreDemoBalance(amount: number) {
    // Always restore sandbox balance regardless of current mode
    this.sandboxBalance = amount;
    this.config.demoBalance = amount;
    // Only update displayed balance if currently in sandbox mode
    if (!this.config.apiToken || this.config.demoMode) {
      this.balance = amount.toFixed(2);
    }
  }

  public destroy() {
    if (this.ws) { try { this.ws.close(); } catch (_) {} this.ws = null; }
    if (this.reconnectInterval) { clearInterval(this.reconnectInterval); this.reconnectInterval = null; }
    if (this.silenceCheckInterval) { clearInterval(this.silenceCheckInterval); this.silenceCheckInterval = null; }
  }

  private userStoragePath(filename: string): string {
    if (this.telegramId === "default") return path.join(process.cwd(), filename);
    const dir = path.join(process.cwd(), "user-data", this.telegramId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, filename);
  }

  private loadPersistence() {
    if (this.currentUserEmail) {
      const users = this.loadUsers();
      const emailKey = this.currentUserEmail.toLowerCase();
      const user = users[emailKey];
      if (user) {
        this.config = { ...DEFAULT_CONFIG, ...user.config };
        this.tradeLogs = user.tradeLogs || [];
      }
      return;
    }

    try {
      const configFile = this.userStoragePath("bot-config-store.json");
      if (fs.existsSync(configFile)) {
        const raw = fs.readFileSync(configFile, "utf-8").trim();
        if (raw) {
          this.config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
        } else {
          this.saveConfigPersistence();
        }
      }
    } catch (e) {
      console.error("Error loading bot-config-store", e);
      try { this.saveConfigPersistence(); } catch (err) {}
    }

    try {
      const logsFile = this.userStoragePath("bot-logs-store.json");
      if (fs.existsSync(logsFile)) {
        const raw = fs.readFileSync(logsFile, "utf-8").trim();
        if (raw) {
          this.tradeLogs = JSON.parse(raw).slice(0, 200);
        } else {
          this.saveLogsPersistence();
        }
      }
    } catch (e) {
      console.error("Error loading bot-logs-store", e);
      try { this.saveLogsPersistence(); } catch (err) {}
    }
  }

  private saveConfigPersistence() {
    if (this.currentUserEmail) {
      const users = this.loadUsers();
      const emailKey = this.currentUserEmail.toLowerCase();
      if (users[emailKey]) {
        users[emailKey].config = this.config;
        this.saveUsers(users);
      }
      return;
    }

    try {
      fs.writeFileSync(this.userStoragePath("bot-config-store.json"), JSON.stringify(this.config, null, 2), "utf-8");
    } catch (e) {
      console.error("Error saving config persistence", e);
    }
  }

  private saveLogsPersistence() {
    if (this.currentUserEmail) {
      const users = this.loadUsers();
      const emailKey = this.currentUserEmail.toLowerCase();
      if (users[emailKey]) {
        users[emailKey].tradeLogs = this.tradeLogs;
        this.saveUsers(users);
      }
      return;
    }

    try {
      fs.writeFileSync(this.userStoragePath("bot-logs-store.json"), JSON.stringify(this.tradeLogs, null, 2), "utf-8");
    } catch (e) {
      console.error("Error saving trade logs persistence", e);
    }
  }

  private ensureUsersFileExists() {
    const usersFile = this.userStoragePath("bot-users-store.json");
    let existsAndNotEmpty = false;
    try {
      if (fs.existsSync(usersFile)) {
        const stats = fs.statSync(usersFile);
        if (stats.size > 0) existsAndNotEmpty = true;
      }
    } catch (e) {}

    if (!existsAndNotEmpty) {
      try {
        fs.writeFileSync(usersFile, JSON.stringify({ users: {} }, null, 2), "utf-8");
      } catch (e) {
        console.error("Error generating initial users file", e);
      }
    }
  }

  private loadUsers(): Record<string, any> {
    this.ensureUsersFileExists();
    try {
      const data = fs.readFileSync(this.userStoragePath("bot-users-store.json"), "utf-8").trim();
      if (!data) return {};
      return JSON.parse(data).users || {};
    } catch (e) {
      console.error("Error reading users database", e);
      try { this.saveUsers({}); } catch (err) {}
      return {};
    }
  }

  private saveUsers(users: Record<string, any>) {
    try {
      fs.writeFileSync(this.userStoragePath("bot-users-store.json"), JSON.stringify({ users }, null, 2), "utf-8");
    } catch (e) {
      console.error("Error writing users database", e);
    }
  }

  public async loginWithToken(token: string): Promise<{ success: boolean; error?: string; email?: string }> {
    if (!token || token.trim() === "") {
      return { success: false, error: "Please enter a valid Deriv API Token." };
    }

    const clientId = process.env.DERIV_CLIENT_ID || "33yYUuxyhTQPYawa2VVdV";

    try {
      // Step 1: Get accounts list using REST API
      const accountsRes = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token.trim()}`,
          "Deriv-App-ID": clientId,
        },
      });

      if (!accountsRes.ok) {
        const err = await accountsRes.json().catch(() => ({}));
        return { success: false, error: err?.message || "Invalid token. Please generate a new PAT from Deriv." };
      }

      const accountsData = await accountsRes.json();
      const accounts = accountsData?.data ?? [];

      if (!accounts.length) {
        return { success: false, error: "No accounts found for this token." };
      }

      // Use first account (demo preferred, else real)
      const demoAccount = accounts.find((a: any) => a.account_type === "demo") ?? accounts[0];
      const accountId = demoAccount.account_id || demoAccount.loginid;
      const email = demoAccount.email || accounts[0].email || "user@deriv.com";
      const isVirtual = demoAccount.account_type === "demo" || demoAccount.is_virtual;

      // Step 2: Get OTP WebSocket URL
      const otpRes = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token.trim()}`,
          "Deriv-App-ID": clientId,
        },
      });

      if (!otpRes.ok) {
        // Fallback to old WebSocket method if OTP fails
        return this.loginWithTokenLegacy(token);
      }

      const otpData = await otpRes.json();
      const wsUrl = otpData?.data?.url;

      if (!wsUrl) {
        return this.loginWithTokenLegacy(token);
      }

      // Store the WS URL and account info for connectWebSocket
      this.derivWsUrl = wsUrl;
      this.accountCurrency = demoAccount.currency || "USD";
      this.completeTokenLogin(email, token.trim(), !isVirtual);

      return { success: true, email };

    } catch (e: any) {
      console.error("[loginWithToken] REST API failed, trying legacy:", e.message);
      return this.loginWithTokenLegacy(token);
    }
  }

  // Legacy login using old binaryws WebSocket (fallback)
  private async loginWithTokenLegacy(token: string): Promise<{ success: boolean; error?: string; email?: string }> {
    return new Promise((resolve) => {
      const url = `wss://ws.binaryws.com/websockets/v3?app_id=${this.config.appId || 1089}`;
      const tempWs = new WebSocket(url);
      let resolved = false;

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { tempWs.removeAllListeners(); tempWs.on("error", () => {}); tempWs.close(); } catch (e) {}
          resolve({ success: false, error: "Authentication timed out. Please verify your connection and token." });
        }
      }, 8000);

      tempWs.on("open", () => {
        try { tempWs.send(JSON.stringify({ authorize: token.trim() })); } catch (e) {}
      });

      tempWs.on("message", (raw: string) => {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.msg_type === "authorize") {
            if (parsed.error) {
              resolved = true;
              clearTimeout(timeoutId);
              try { tempWs.removeAllListeners(); tempWs.on("error", () => {}); tempWs.close(); } catch (e) {}
              resolve({ success: false, error: parsed.error.message || "Invalid API token. Try again." });
            } else {
              resolved = true;
              clearTimeout(timeoutId);
              try { tempWs.removeAllListeners(); tempWs.on("error", () => {}); tempWs.close(); } catch (e) {}
              const auth = parsed.authorize;
              this.completeTokenLogin(auth.email, token.trim(), !auth.is_virtual);
              resolve({ success: true, email: auth.email });
            }
          }
        } catch (e) {}
      });

      tempWs.on("error", (err: any) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          try { tempWs.removeAllListeners(); tempWs.close(); } catch (e) {}
          resolve({ success: false, error: "Connection error. Please check your internet and try again." });
        }
      });
    });
  }

  private completeTokenLogin(email: string, apiToken: string, isReal: boolean = false) {
    if (this.botState !== "STATE_IDLE" && this.botState !== "STATE_STOPPED") {
      this.haltBot("User context switched via Token Login");
    }

    // Save sandbox balance BEFORE overwriting config
    const savedSandboxBalance = this.sandboxBalance;

    const emailKey = email.toLowerCase().trim();
    const users = this.loadUsers();
    
    let user = users[emailKey];
    if (!user) {
      user = {
        email: emailKey,
        derivToken: apiToken,
        config: {
          ...DEFAULT_CONFIG,
          apiToken: apiToken,
          demoMode: false
        },
        tradeLogs: []
      };
      users[emailKey] = user;
    } else {
      user.derivToken = apiToken;
      user.config = {
        ...DEFAULT_CONFIG,
        ...user.config,
        apiToken: apiToken,
        demoMode: false
      };
    }
    this.saveUsers(users);

    this.currentUserEmail = user.email;
    this.config = user.config;
    this.tradeLogs = user.tradeLogs || [];
    this.isRealAccount = isReal;

    // Restore sandbox balance — never overwrite it with Deriv data
    this.sandboxBalance = savedSandboxBalance;

    // Reset session aggregates
    this.sessionProfit = 0;
    this.dailyTradesCount = 0;
    this.consecutiveLosses = 0;
    this.accumulatedLoss = 0;
    this.multiplier = 1;
    this.inRecovery = false;
    this.sequenceDone = 0;
    this.awaitingSettlement = false;
    this.currentStreak = 0;
    this.bestStreak = 0;
    this.peakProfit = 0;
    this.worstDrawdown = 0;
    this.pendingRealContract = null;
    this.pendingVirtualContract = null;
    this.showSummary = false;
    this.sessionStats = null;

    // Set balance to null — will be populated from Deriv WebSocket authorize response
    this.balance = null;
    this.accountEmail = null;
    this.isRealAccount = false;

    this.showToast(`Logged in successfully: ${email}`, "green");
    this.connectWebSocket();
  }

  public switchToDemo() {
    if (this.botState !== "STATE_IDLE" && this.botState !== "STATE_STOPPED") {
      this.haltBot("Switched to sandbox demo mode.");
    }
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
      this.ws = null;
    }
    // Save current Deriv balance before switching
    if (this.currentUserEmail) {
      this.derivBalance = this.balance;
    }
    this.currentUserEmail = null;
    this.accountEmail = "demo.testing@deriv.com";
    this.isRealAccount = false;
    this.connectionStatus = "disconnected";
    this.derivWsUrl = null;
    // Restore sandbox balance — completely isolated from Deriv balance
    this.balance = this.sandboxBalance.toFixed(2);
    this.config = { ...this.config, apiToken: "", demoMode: true };
    this.showToast("Switched to Sandbox Demo mode.", "blue");
    return { success: true, balance: this.balance };
  }

  public logout() {
    if (this.botState !== "STATE_IDLE" && this.botState !== "STATE_STOPPED") {
      this.haltBot("Active trading stopped due to user logout.");
    }
    this.derivWsUrl = null;
    this.currentUserEmail = null;
    // Preserve sandboxBalance — never let it reset via DEFAULT_CONFIG
    const preservedSandboxBalance = this.sandboxBalance;
    this.config = { ...DEFAULT_CONFIG, demoBalance: preservedSandboxBalance };
    this.tradeLogs = [];

    this.sessionProfit = 0;
    this.dailyTradesCount = 0;
    this.consecutiveLosses = 0;
    this.accumulatedLoss = 0;
    this.multiplier = 1;
    this.inRecovery = false;
    this.sequenceDone = 0;
    this.awaitingSettlement = false;
    this.currentStreak = 0;
    this.bestStreak = 0;
    this.peakProfit = 0;
    this.worstDrawdown = 0;
    this.pendingRealContract = null;
    this.pendingVirtualContract = null;
    this.showSummary = false;
    this.sessionStats = null;

    this.sandboxBalance = preservedSandboxBalance;
    this.balance = preservedSandboxBalance.toFixed(2);
    this.accountEmail = "demo.testing@deriv.com";
    this.isRealAccount = false;

    this.showToast("Logged out of the account successfully", "grey");
    this.connectWebSocket();
    return { success: true };
  }

  private initializeSymbolStates() {
    const initialStates: Record<string, SymbolState> = {};
    SYMBOLS.forEach(({ symbol, name }) => {
      initialStates[symbol] = {
        symbol,
        displayName: name,
        buffer: [],
        underPct: 0,
        overPct: 0,
        signalStrength: "SCANNING...",
        confirmationCounter: 0,
        digitFreq: Array.from({ length: 10 }, (_, i) => i).reduce((acc, d) => ({ ...acc, [d]: 0 }), {}),
        digitPct: Array.from({ length: 10 }, (_, i) => i).reduce((acc, d) => ({ ...acc, [d]: 0 }), {}),
        lastDigit: null,
        qualified: false,
        tickCount: 0,
        lastTickTime: 0,
        isClosed: false
      };
    });
    this.symbolStates = initialStates;
  }

  public getFullState() {
    const availableBalance = Math.max(0, (Number(this.balance) || 0) - this.bankBalance);
    return {
      config: this.config,
      botState: this.botState,
      activeSymbol: this.activeSymbol,
      balance: this.balance,
      availableBalance: availableBalance.toFixed(2),
      bankBalance: this.bankBalance,
      accountEmail: this.accountEmail,
      isRealAccount: this.isRealAccount,
      sessionProfit: this.sessionProfit,
      dailyTradesCount: this.dailyTradesCount,
      consecutiveLosses: this.consecutiveLosses,
      multiplier: this.multiplier,
      inRecovery: this.inRecovery,
      sequenceDone: this.sequenceDone,
      awaitingSettlement: this.awaitingSettlement,
      connectionStatus: this.connectionStatus,
      reconnectCountdown: this.reconnectCountdown,
      symbolStates: this.symbolStates,
      tradeLogs: this.tradeLogs,
      sessionStats: this.sessionStats,
      showSummary: this.showSummary,
      currentUserEmail: this.currentUserEmail
    };
  }

  // Get and consumption of toasts (once fetched, server clears to avoid duplicates)
  public flushToasts(): ToastMessage[] {
    const current = [...this.toasts];
    this.toasts = [];
    return current;
  }

  private showToast(message: string, type: ToastMessage["type"], dismissible = true) {
    const id = Math.random().toString(36).substring(2, 9);
    console.log(`[BOT TOAST - ${type.toUpperCase()}]: ${message}`);
    this.toasts.push({
      id,
      type,
      message,
      dismissible,
      timestamp: Date.now()
    });
  }

  public updateConfig(newConfig: Partial<BotConfig>) {
    this.config = { ...this.config, ...newConfig };
    // Enforce single-mode lock: when showAllModes is off, always force Split-M Pro Lite
    if (!this.config.showAllModes) {
      this.config.mode = "GradualRecoveryProLite";
    }
    this.saveConfigPersistence();
    this.showToast("Configuration parameters updated.", "blue");
  }

  public clearLogs() {
    this.tradeLogs = [];
    this.saveLogsPersistence();
    this.showToast("Local transaction logs cleared.", "grey");
  }

  public dismissSummary() {
    this.showSummary = false;
  }

  public startBot() {
    if (this.config.stakeAmount <= 0) {
      this.showToast("Stake amount must be greater than 0.", "red");
      return;
    }

    // Reset session parameters
    this.sessionProfit = 0;
    this.dailyTradesCount = 0;
    this.consecutiveLosses = 0;
    this.accumulatedLoss = 0;
    this.multiplier = 1;
    this.inRecovery = false;
    this.sequenceDone = 0;
    this.awaitingSettlement = false;
    this.currentStreak = 0;
    this.bestStreak = 0;
    this.peakProfit = 0;
    this.worstDrawdown = 0;
    this.pendingRealContract = null;
    this.pendingVirtualContract = null;
    this.showSummary = false;
    this.sessionStats = null;

    this.showToast("Starting Automated Trading Session...", "green");
    tgNotifier.notifyBotStarted(
      this.accountEmail ?? "unknown",
      this.config.mode,
      this.config.stakeAmount
    );
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connectWebSocket();
    } else {
      // If we are already connected, we can instantly switch to STATE_SCANNING since history has already loaded
      this.botState = "STATE_SCANNING";
      this.checkAndSwitchSymbol();
    }
  }

  public stopBot() {
    this.haltBot("Manually deactivated by user");
  }

  private connectWebSocket() {
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.on("error", () => {});
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    this.connectionStatus = "connecting";
    if (this.botState !== "STATE_IDLE" && this.botState !== "STATE_STOPPED") {
      this.botState = "STATE_CONNECTING";
    }
    this.reconnectCountdown = null;

    // Use OTP-authenticated URL if available, otherwise fall back to legacy
    const url = this.derivWsUrl || `wss://ws.binaryws.com/websockets/v3?app_id=${this.config.appId || 1089}`;
    console.log(`Bot connecting to: ${this.derivWsUrl ? "OTP WebSocket" : "Legacy WebSocket"}`);
    
    const wsClient = new WebSocket(url);
    this.ws = wsClient;

    wsClient.on("open", () => {
      this.connectionStatus = "connected";
      this.initializeSymbolStates();
      this.showToast("WebSocket Connection Opened", "blue");

      const token = this.config.apiToken;
      const isDemo = this.config.demoMode || !token || token.trim() === "";

      // Only send authorize if using legacy connection (OTP URL is pre-authenticated)
      if (!this.derivWsUrl && !isDemo) {
        console.log("Sending authorization...");
        wsClient.send(JSON.stringify({ authorize: token.trim() }));
      } else if (this.derivWsUrl) {
        // OTP URL is already authenticated — go straight to subscriptions
        this.subscribeToSymbols();
        if (token) {
          wsClient.send(JSON.stringify({ balance: 1, subscribe: 1 }));
        }
      } else {
        // Sandbox demo mode — no auth needed
        this.isRealAccount = false;
        this.balance = this.sandboxBalance.toFixed(2);
        this.accountEmail = "demo.testing@deriv.com";
        this.subscribeToSymbols();
      }
    });

    wsClient.on("message", (raw: string) => {
      try {
        const parsed = JSON.parse(raw);
        this.handleWsMessage(parsed);
      } catch (e) {
        console.error("Error parsing WS packet", e);
      }
    });

    wsClient.on("error", (err: any) => {
      const errMsg = err?.message || String(err);
      if (
        errMsg.includes("closed before the connection") ||
        errMsg.includes("ECONNRESET") ||
        errMsg.includes("aborted")
      ) {
        console.log(`Websocket idle/close message ignored: ${errMsg}`);
        return;
      }
      console.error("Broker WebSocket Error:", err);
      this.connectionStatus = "disconnected";
      this.showToast("Websocket communication link error", "red");
    });

    wsClient.on("close", () => {
      this.connectionStatus = "disconnected";
      
      const isStillActive = this.botState !== "STATE_IDLE" && this.botState !== "STATE_STOPPED";
      if (isStillActive) {
        this.botState = "STATE_CONNECTING";
        let count = 5;
        this.reconnectCountdown = count;

        if (this.reconnectInterval) clearInterval(this.reconnectInterval);
        this.reconnectInterval = setInterval(() => {
          count -= 1;
          this.reconnectCountdown = count;
          if (count <= 0) {
            if (this.reconnectInterval) clearInterval(this.reconnectInterval);
            this.reconnectCountdown = null;
            this.connectWebSocket();
          }
        }, 1000);
      } else {
        // Keep reconnect active so that background tick scan remains alive even spent or idle!
        let count = 10;
        this.reconnectCountdown = count;

        if (this.reconnectInterval) clearInterval(this.reconnectInterval);
        this.reconnectInterval = setInterval(() => {
          count -= 1;
          this.reconnectCountdown = count;
          if (count <= 0) {
            if (this.reconnectInterval) clearInterval(this.reconnectInterval);
            this.reconnectCountdown = null;
            this.connectWebSocket();
          }
        }, 1000);
      }
    });
  }

  private subscribeToSymbols() {
    this.showToast("Initiating rapid historical scans...", "blue");

    SYMBOLS.forEach(({ symbol }) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          ticks_history: symbol,
          adjust_start_time: 1,
          count: this.config.analysisTickCount,
          end: "latest",
          style: "ticks",
          subscribe: 1
        }));
      }
    });
  }

  private handleWsMessage(data: any) {
    if (data.msg_type === "authorize") {
      if (data.error) {
        this.showToast(`Auth Failed: ${data.error.message}`, "red");
        this.haltBot(`Authorization Error: ${data.error.message}`);
        return;
      }
      const auth = data.authorize;
      this.isRealAccount = !auth.is_virtual;
      this.accountCurrency = auth.currency || "USD";
      if (auth.balance !== undefined && auth.balance !== null) {
        const parsedBal = Number(auth.balance);
        if (!isNaN(parsedBal)) {
          this.balance = parsedBal.toFixed(2);
        } else {
          this.balance = this.balance || "10000.00";
        }
      } else {
        this.balance = this.balance || "10000.00";
      }
      this.accountEmail = auth.email;
      this.showToast(`User Authorized: ${auth.email} (${auth.is_virtual ? "Demo Sandbox" : "Real Account"})`, "green");
      tgNotifier.notifyConnected(auth.email, !auth.is_virtual);
      if (this.ws && this.ws.readyState === 1) { // 1 is OPEN
        try {
          this.ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
        } catch (e) {}
      }
      this.subscribeToSymbols();
    }

    else if (data.msg_type === "balance" && data.balance) {
      if (data.balance.balance !== undefined && data.balance.balance !== null) {
        const parsedBal = Number(data.balance.balance);
        if (!isNaN(parsedBal)) {
          this.balance = parsedBal.toFixed(2);
        }
      }
    }

    else if (data.msg_type === "tick" && data.tick) {
      this.handleIncomingTick(data.tick);
    }

    else if (data.msg_type === "history" && data.history) {
      this.handleHistoryResponse(data);
    }

    else if (data.msg_type === "proposal") {
      if (data.error) {
        this.showToast(`Proposal Error: ${data.error.message}. Retrying...`, "red");
        this.pendingRealContract = null;
        this.awaitingSettlement = false;
        return;
      }
      // Execute buy using proposal ID
      const proposalId = data.proposal?.id;
      const price = data.proposal?.ask_price ?? this.pendingRealContract?.stake ?? 0;
      if (proposalId && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          buy: proposalId,
          price: price,
        }));
      }
    }

    else if (data.msg_type === "buy") {
      if (data.error) {
        this.showToast(`Trade Blocked: ${data.error.message}. Restarting state...`, "red");
        this.pendingRealContract = null;
        this.awaitingSettlement = false;
        return;
      }
      const buy = data.buy;
      if (buy && buy.balance_after !== undefined && buy.balance_after !== null) {
        const parsedBal = Number(buy.balance_after);
        if (!isNaN(parsedBal)) {
          this.balance = parsedBal.toFixed(2);
        }
      }
      
      if (this.pendingRealContract) {
        this.pendingRealContract.id = buy.contract_id;
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ proposal_open_contract: 1, contract_id: buy.contract_id, subscribe: 1 }));
        }
      }
    }

    else if (data.msg_type === "proposal_open_contract" && data.proposal_open_contract) {
      const poc = data.proposal_open_contract;
      if (poc.is_sold) {
        this.handleRealContractSettled(poc);
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN && poc.subscription) {
          this.ws.send(JSON.stringify({ forget: poc.subscription.id }));
        }
      }
    }

    else if (data.error) {
      console.warn("Client WS Error payload returned: ", data.error);
    }
  }

  private handleHistoryResponse(data: any) {
    const symbol = data.echo_req?.ticks_history;
    if (!symbol) return;

    const sState = this.symbolStates[symbol];
    if (!sState) return;

    const prices = data.history?.prices;
    if (!prices || !Array.isArray(prices)) return;

    const digitsBuf: number[] = [];
    prices.forEach((price: any) => {
      const priceStr = String(price);
      const lastDigit = parseInt(priceStr.charAt(priceStr.length - 1));
      if (!isNaN(lastDigit)) {
        digitsBuf.push(lastDigit);
      }
    });

    const maxCapacity = this.config.analysisTickCount;
    const finalBuffer = digitsBuf.slice(-maxCapacity);
    const bufferLength = finalBuffer.length;
    const underBarrier = this.config.referenceDigit;

    // Freq
    const digitCounts: Record<number, number> = Array.from({ length: 10 }, (_, i) => i).reduce((acc, d) => ({ ...acc, [d]: 0 }), {});
    finalBuffer.forEach(d => {
      digitCounts[d] = (digitCounts[d] || 0) + 1;
    });

    const digitPercentages: Record<number, number> = {};
    for (let d = 0; d < 10; d++) {
      digitPercentages[d] = bufferLength > 0 ? Number(((digitCounts[d] / bufferLength) * 100).toFixed(1)) : 0;
    }

    const underCount = finalBuffer.filter(d => d < underBarrier).length;
    const overCount = finalBuffer.filter(d => d > underBarrier).length;
    const underPct = bufferLength > 0 ? Number(((underCount / bufferLength) * 100).toFixed(1)) : 0;
    const overPct = bufferLength > 0 ? Number(((overCount / bufferLength) * 100).toFixed(1)) : 0;

    let strength: SymbolState["signalStrength"] = "SCANNING...";
    if (underPct >= 80) strength = "VERY STRONG";
    else if (underPct >= 75) strength = "STRONG";
    else if (underPct >= 70) strength = "MODERATE";
    else if (underPct >= 65) strength = "WEAK";

    const isQualified = underPct >= this.config.minUnderPercentage && bufferLength >= maxCapacity;

    this.symbolStates[symbol] = {
      ...sState,
      buffer: finalBuffer,
      underPct,
      overPct,
      signalStrength: strength,
      digitFreq: digitCounts,
      digitPct: digitPercentages,
      lastDigit: finalBuffer.length > 0 ? finalBuffer[finalBuffer.length - 1] : null,
      qualified: isQualified,
      tickCount: finalBuffer.length,
      lastTickTime: Date.now(),
      isClosed: false
    };

    // If warming up or connecting, check if we preloaded enough so we can activate immediately
    if (this.botState === "STATE_WARMING_UP" || this.botState === "STATE_CONNECTING") {
      const readyMarkets = Object.values(this.symbolStates).filter(
        s => s.buffer.length >= this.config.analysisTickCount
      ).length;
      
      if (readyMarkets >= 5) {
        this.botState = "STATE_SCANNING";
        this.showToast("Historical scanners preloaded. Broker signal lines open.", "green");
        this.checkAndSwitchSymbol();
      }
    }
  }

  private handleIncomingTick(tick: any) {
    const symbol = tick.symbol;
    const sState = this.symbolStates[symbol];
    if (!sState) return;

    const quoteStr = String(tick.quote);
    const lastDigit = parseInt(quoteStr.charAt(quoteStr.length - 1));
    if (isNaN(lastDigit)) return;

    const updatedBuffer = [...sState.buffer, lastDigit];
    const maxCapacity = this.config.analysisTickCount;
    if (updatedBuffer.length > maxCapacity) {
      updatedBuffer.shift();
    }

    const bufferLength = updatedBuffer.length;
    const underBarrier = this.config.referenceDigit;

    // Freq
    const digitCounts: Record<number, number> = Array.from({ length: 10 }, (_, i) => i).reduce((acc, d) => ({ ...acc, [d]: 0 }), {});
    updatedBuffer.forEach(d => {
      digitCounts[d] = (digitCounts[d] || 0) + 1;
    });

    const digitPercentages: Record<number, number> = {};
    for (let d = 0; d < 10; d++) {
      digitPercentages[d] = bufferLength > 0 ? Number(((digitCounts[d] / bufferLength) * 100).toFixed(1)) : 0;
    }

    const underCount = updatedBuffer.filter(d => d < underBarrier).length;
    const overCount = updatedBuffer.filter(d => d > underBarrier).length;
    const underPct = bufferLength > 0 ? Number(((underCount / bufferLength) * 100).toFixed(1)) : 0;
    const overPct = bufferLength > 0 ? Number(((overCount / bufferLength) * 100).toFixed(1)) : 0;

    let strength: SymbolState["signalStrength"] = "SCANNING...";
    if (underPct >= 80) strength = "VERY STRONG";
    else if (underPct >= 75) strength = "STRONG";
    else if (underPct >= 70) strength = "MODERATE";
    else if (underPct >= 65) strength = "WEAK";

    const isQualified = underPct >= this.config.minUnderPercentage && bufferLength >= maxCapacity;

    const updatedState: SymbolState = {
      ...sState,
      buffer: updatedBuffer,
      underPct,
      overPct,
      signalStrength: strength,
      digitFreq: digitCounts,
      digitPct: digitPercentages,
      lastDigit,
      qualified: isQualified,
      tickCount: sState.tickCount + 1,
      lastTickTime: Date.now(),
      isClosed: false
    };

    this.symbolStates[symbol] = updatedState;

    this.processTradingMachine(symbol, updatedState);
  }

  private processTradingMachine(symbol: string, symbolStateData: SymbolState) {
    if (this.botState === "STATE_WARMING_UP") {
      const readyMarkets = Object.values(this.symbolStates).filter(
        s => s.buffer.length >= this.config.analysisTickCount
      ).length;
      
      if (readyMarkets >= 5) {
        this.botState = "STATE_SCANNING";
        this.showToast("Scanning warmups ended. Broker signal lines open.", "blue");
        this.checkAndSwitchSymbol();
      }
      return;
    }

    if (this.botState === "STATE_IDLE" || this.botState === "STATE_STOPPED") return;

    if (this.awaitingSettlement && this.pendingVirtualContract && this.pendingVirtualContract.symbol === symbol) {
      this.handleVirtualContractSettled(symbolStateData.lastDigit!);
      return;
    }

    if (this.botState === "STATE_SCANNING") {
      this.checkAndSwitchSymbol();
      return;
    }

    // Pro scan mode: when activeSymbol is null, process all ticks to find best market
    if ((this.config.mode === "GradualRecoveryPro" || this.config.mode === "GradualRecoveryProLite") && this.recoverySignalThreshold > 0 && !this.activeSymbol) {
      this.checkAndSwitchSymbol();
      return;
    }

    // STATE_CONFIRMING falls through to confirmation tracking below

    // Confirmation tracking state
    if (this.activeSymbol === symbol) {
      const currentActive = this.symbolStates[symbol];
      if (!currentActive) return;

      if (this.botState === "STATE_CONFIRMING") {
        // Use tightened threshold if in recovery (Standard after loss, Split-M Pro after 2 losses)
        const activeThreshold = this.recoverySignalThreshold > 0
          ? this.recoverySignalThreshold
          : this.config.minUnderPercentage;
        const activeConfirmationsRequired = this.recoveryConfirmationsRequired > 0
          ? this.recoveryConfirmationsRequired
          : this.config.confirmationRequired;

        if (currentActive.underPct >= activeThreshold) {
          const digit = currentActive.lastDigit;
          if (digit !== null) {
            if (digit >= this.config.referenceDigit) {
              const prevConf = currentActive.confirmationCounter;
              const nextConf = prevConf + 1;
              
              currentActive.confirmationCounter = nextConf;
              this.showToast(`Confirmation key ${digit} received (${nextConf}/${activeConfirmationsRequired})${this.recoverySignalThreshold > 0 ? ` [Recovery: ${activeThreshold}% threshold]` : ""}`, "orange");

              if (nextConf >= activeConfirmationsRequired) {
                currentActive.confirmationCounter = 0;
                this.botState = "STATE_TRADING";
                this.sequenceDone = 0;
                
                this.showToast("Signal Confirmation approved. Executing target sequence.", "green");
                this.executeTradeSequence();
              }
            } else {
              if (currentActive.confirmationCounter > 0) {
                currentActive.confirmationCounter = 0;
                this.showToast("Confirmation tick degraded: resetting counts.", "grey");
              }
            }
          }
        } else {
          if (currentActive.confirmationCounter > 0) {
            currentActive.confirmationCounter = 0;
            this.showToast(`Signal dropped (${currentActive.underPct}% < ${activeThreshold}% required) — scanning for better pair.`, "grey");
          }
          // Force immediate symbol switch — don't wait for next tick
          // This applies to ALL modes including Classic/Lite during recovery
          // The only exception is when we're already trading or awaiting settlement
          if (!this.awaitingSettlement && this.botState !== "STATE_TRADING") {
            // Temporarily allow switching even in Classic/Lite recovery
            const savedInRecovery = this.inRecovery;
            const savedConsecutiveLosses = this.consecutiveLosses;
            this.inRecovery = false;
            this.consecutiveLosses = 0;
            this.checkAndSwitchSymbol();
            // Restore recovery state after switch check
            this.inRecovery = savedInRecovery;
            this.consecutiveLosses = savedConsecutiveLosses;
          }
        }
      }
    }
  }

  private checkAndSwitchSymbol() {
    if (this.botState === "STATE_TRADING" || this.awaitingSettlement) {
      return;
    }

    // In GradualRecoveryPro/ProLite after 2+ losses — allow scanning all markets for 75%+ signal
    // Once a symbol is selected (activeSymbol set), lock onto it for confirmation
    // Only scan freely when activeSymbol is null
    const isProScanMode = (this.config.mode === "GradualRecoveryPro" || this.config.mode === "GradualRecoveryProLite")
      && this.recoverySignalThreshold > 0
      && this.activeSymbol === null;

    // Standard mode after loss — allow symbol switching (signal tightening handles entry quality)
    const isStandardRecovery = this.config.mode === "Standard" && this.inRecovery;

    // Pro/ProLite mode after any loss — allow scanning with tightened threshold
    const isProRecovery = (this.config.mode === "GradualRecoveryPro" || this.config.mode === "GradualRecoveryProLite") && this.inRecovery;

    // For Split-M Classic and Lite — stay locked on current symbol during recovery
    if ((this.consecutiveLosses > 0 || this.inRecovery) && !isProScanMode && !isStandardRecovery && !isProRecovery) {
      return;
    }

    const bestSymbol = this.getBestQualifiedSymbol();
    
    if (bestSymbol === null) {
      if (this.activeSymbol !== null) {
        this.activeSymbol = null;
        this.botState = "STATE_SCANNING";
        this.showToast("No active triggers: searching indices.", "grey");
      }
      return;
    }

    if (bestSymbol.symbol !== this.activeSymbol) {
      const prevSymbol = this.activeSymbol;
      if (prevSymbol && this.symbolStates[prevSymbol]) {
        this.symbolStates[prevSymbol].confirmationCounter = 0;
      }

      this.activeSymbol = bestSymbol.symbol;
      this.botState = "STATE_CONFIRMING";
      this.showToast(`Focus index switched to ${bestSymbol.displayName} (Under: ${bestSymbol.underPct}%)`, "blue");
    }
  }

  private getBestQualifiedSymbol(): SymbolState | null {
    const list = Object.values(this.symbolStates);
    const activeThreshold = this.recoverySignalThreshold > 0
      ? this.recoverySignalThreshold
      : this.config.minUnderPercentage;

    const qualified = list.filter(
      s => s.underPct >= activeThreshold &&
           s.buffer.length >= this.config.analysisTickCount &&
           !s.isClosed
    );

    if (qualified.length === 0) return null;

    qualified.sort((a, b) => b.underPct - a.underPct);
    const candidate = qualified[0];

    // Only prefer current symbol if it STILL meets the threshold
    // If it dropped below threshold, always switch to the best qualified symbol
    if (this.activeSymbol && this.symbolStates[this.activeSymbol]) {
      const currentObj = this.symbolStates[this.activeSymbol];
      const currentStillQualifies = currentObj.underPct >= activeThreshold && !currentObj.isClosed;
      if (currentStillQualifies && candidate.underPct <= currentObj.underPct) {
        return currentObj; // current symbol is still best — no need to switch
      }
    }

    return candidate; // switch to better symbol
  }

  private getPayoutFactor(): number {
    const barrier = this.config.referenceDigit;
    const payoutFactor = barrier === 7 ? 0.34 : (0.95 / (barrier / 10)) - 1;
    return Number(Math.max(0.05, payoutFactor).toFixed(2));
  }

  private executeTradeSequence() {
    if (this.botState === "STATE_STOPPED") return;
    
    const symbol = this.activeSymbol;
    if (!symbol) return;

    const currentActiveObj = this.symbolStates[symbol];
    if (!currentActiveObj) return;

    const baseStake = this.config.stakeAmount;
    let computedStake = baseStake;

    if (this.consecutiveLosses > 0 || this.inRecovery) {
      if (this.config.mode === "Martingale") {
        computedStake = Number((baseStake * this.multiplier).toFixed(2));
      } else if (this.config.mode === "PayoutAdaptive") {
        const pFactor = this.getPayoutFactor();
        computedStake = Number(((this.accumulatedLoss + baseStake) / pFactor).toFixed(2));
      } else if (this.config.mode === "DAlembert") {
        const steps = this.consecutiveLosses;
        computedStake = Number((baseStake * (steps + 1)).toFixed(2));
      } else if (this.config.mode === "GradualRecovery") {
        // Classic: recover 50% of accumulated loss per trade
        const pFactor = this.getPayoutFactor();
        const targetRecovery = this.accumulatedLoss / 2;
        computedStake = Number(((targetRecovery + baseStake) / pFactor).toFixed(2));
      } else if (this.config.mode === "GradualRecoveryPro") {
        // Pro: same 50% recovery but pauses after 2 losses for better signal
        const pFactor = this.getPayoutFactor();
        const targetRecovery = this.accumulatedLoss / 2;
        computedStake = Number(((targetRecovery + baseStake) / pFactor).toFixed(2));
      } else if (this.config.mode === "GradualRecoveryLite") {
        // Lite: recover only 25% of accumulated loss per trade — much lower stakes
        const pFactor = this.getPayoutFactor();
        const targetRecovery = this.accumulatedLoss / 4;
        computedStake = Number(((targetRecovery + baseStake) / pFactor).toFixed(2));
      } else if (this.config.mode === "GradualRecoveryProLite") {
        // Pro Lite: Pro's signal tightening + Lite's 25% recovery target
        const pFactor = this.getPayoutFactor();
        const targetRecovery = this.accumulatedLoss / 4;
        computedStake = Number(((targetRecovery + baseStake) / pFactor).toFixed(2));
      } else if (this.config.mode === "Standard") {
        // Standard: stake never changes
        computedStake = baseStake;
      }
    }

    // Safety balance check — use available balance (total minus reserved bank)
    const currentBalance = Math.max(0, (Number(this.balance) || 10000) - this.bankBalance);
    if (computedStake > currentBalance) {
      this.showToast(`Insufficient balance. Required: $${computedStake}, Available: $${currentBalance.toFixed(2)} (Bank: $${this.bankBalance.toFixed(2)}). Halting bot.`, "red");
      this.haltBot(`Insufficient balance for stake: $${computedStake} vs $${currentBalance}`);
      return;
    }

    const currentMultiplier = Number((computedStake / baseStake).toFixed(2));
    const token = this.config.apiToken;

    this.awaitingSettlement = true;

    this.showToast(`Order logged: [UNDER] Trade #${this.sequenceDone + 1} on ${currentActiveObj.displayName} ($${computedStake})`, "blue");

    if (this.config.demoMode || !token || token.trim() === "") {
      this.pendingVirtualContract = {
        symbol,
        stake: computedStake,
        barrier: this.config.referenceDigit,
        multiplier: currentMultiplier,
        seq: this.sequenceDone,
        timestamp: new Date().toISOString()
      };
    } else {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // New Deriv API: first get proposal, then buy using proposal ID
        // Send proposal request — the response handler will execute the buy
        this.pendingRealContract = {
          id: "",
          symbol,
          stake: computedStake,
          seq: this.sequenceDone
        };

        const proposalPayload = {
          proposal: 1,
          amount: computedStake,
          basis: "stake",
          contract_type: "DIGITUNDER",
          currency: this.accountCurrency || "USD",
          duration: 1,
          duration_unit: "t",
          barrier: String(this.config.referenceDigit),
          underlying_symbol: symbol,
        };

        this.ws.send(JSON.stringify(proposalPayload));
      }
    }
  }

  private handleVirtualContractSettled(settledDigit: number) {
    const contract = this.pendingVirtualContract;
    if (!contract) return;

    this.pendingVirtualContract = null;
    this.awaitingSettlement = false;

    const currentActive = this.symbolStates[contract.symbol];
    const signalStr = currentActive ? currentActive.signalStrength : "STRONG";
    const under_pct = currentActive ? currentActive.underPct : 0;
    
    const isWin = settledDigit < contract.barrier;
    const payoutFactor = contract.barrier === 7 ? 0.34 : (0.95 / (contract.barrier / 10)) - 1;
    const cleanPayoutFactor = Number(Math.max(0.05, payoutFactor).toFixed(2));
    const profitAmount = isWin ? Number((contract.stake * cleanPayoutFactor).toFixed(2)) : -contract.stake;

    this.processContractOutcome(isWin ? "WIN" : "LOSS", contract.symbol, contract.stake, profitAmount, under_pct, signalStr);
  }

  private handleRealContractSettled(poc: any) {
    const isWin = Number(poc.profit) > 0;
    const profitAmount = Number(poc.profit);
    const stakeAmount = Number(poc.buy_price);
    const symbol = poc.symbol;
    
    if (poc && poc.balance_after !== undefined && poc.balance_after !== null) {
      const parsedBal = Number(poc.balance_after);
      if (!isNaN(parsedBal)) {
        this.balance = parsedBal.toFixed(2);
      }
    }
    this.pendingRealContract = null;
    this.awaitingSettlement = false;

    const currentActive = this.symbolStates[symbol];
    const signalStr = currentActive ? currentActive.signalStrength : "STRONG";
    const under_pct = currentActive ? currentActive.underPct : 0;

    this.processContractOutcome(isWin ? "WIN" : "LOSS", symbol, stakeAmount, profitAmount, under_pct, signalStr);
  }

  private processContractOutcome(
    outcome: "WIN" | "LOSS",
    symbol: string,
    stake: number,
    profit: number,
    under_pct: number,
    signal_strength: string
  ) {
    const nextSessionProfit = Number((this.sessionProfit + profit).toFixed(2));
    this.sessionProfit = nextSessionProfit;
    const nextDailyTrades = this.dailyTradesCount + 1;
    this.dailyTradesCount = nextDailyTrades;

    // Update balance for demo/simulated modes — only updates sandboxBalance, never Deriv balance
    if (this.config.demoMode || !this.config.apiToken) {
      this.sandboxBalance = Number((this.sandboxBalance + profit).toFixed(2));
      this.config.demoBalance = this.sandboxBalance;
      this.balance = this.sandboxBalance.toFixed(2);
      this.saveConfigPersistence();
      // Immediately persist to MongoDB so no trade result is ever lost, even if app closes instantly
      if (this.onBalanceChange) {
        this.onBalanceChange(this.telegramId, this.sandboxBalance);
      }
    }

    // Save Logs
    const nextId = this.tradeLogs.length > 0 ? Math.max(...this.tradeLogs.map(l => l.id)) + 1 : 1;
    
    if (outcome === "WIN") {
      this.currentStreak += 1;
      if (this.currentStreak > this.bestStreak) {
        this.bestStreak = this.currentStreak;
      }
    } else {
      this.currentStreak = 0;
    }

    if (nextSessionProfit > this.peakProfit) {
      this.peakProfit = nextSessionProfit;
    }
    const currentDrawdown = this.peakProfit - nextSessionProfit;
    if (currentDrawdown > this.worstDrawdown) {
      this.worstDrawdown = currentDrawdown;
    }

    const newLog: TradeLog = {
      id: nextId,
      timestamp: new Date().toISOString(),
      symbol,
      mode: this.config.mode,
      under_pct,
      signal_strength,
      barrier: this.config.referenceDigit,
      stake,
      multiplier: this.multiplier,
      outcome,
      profit,
      session_profit: nextSessionProfit,
      daily_trade_no: nextDailyTrades,
      consecutive_losses_before: this.consecutiveLosses,
      in_recovery: this.inRecovery
    };

    this.tradeLogs = [newLog, ...this.tradeLogs].slice(0, 200);
    this.saveLogsPersistence();

    // Send Telegram push notification for every trade result
    if (outcome === "WIN") {
      tgNotifier.notifyTradeWin(newLog);
    } else {
      tgNotifier.notifyTradeLoss(newLog);
    }

    // Evaluate and track consecutive losses across all operational modes
    if (outcome === "WIN") {
      if (this.config.mode === "DAlembert") {
        this.consecutiveLosses = Math.max(0, this.consecutiveLosses - 1);
        this.accumulatedLoss = Math.max(0, this.accumulatedLoss - profit);
        if (this.consecutiveLosses === 0) {
          this.accumulatedLoss = 0;
          this.multiplier = 1;
          this.inRecovery = false;
          this.showToast(`WIN EXECUTION! Payout: +$${profit.toFixed(2)}. (Trade #${this.sequenceDone + 1}). D'Alembert fully recovered, back to base stake.`, "green");
        } else {
          this.multiplier = this.consecutiveLosses + 1;
          this.inRecovery = true;
          this.showToast(`WIN EXECUTION! Payout: +$${profit.toFixed(2)}. (Trade #${this.sequenceDone + 1}). D'Alembert step decreased to ${this.consecutiveLosses}.`, "green");
        }
      } else if (this.config.mode === "GradualRecovery" || this.config.mode === "GradualRecoveryPro" || this.config.mode === "GradualRecoveryLite" || this.config.mode === "GradualRecoveryProLite") {
        this.consecutiveLosses = 0;
        this.accumulatedLoss = Math.max(0, this.accumulatedLoss - profit);
        this.consecutiveWinsInRecovery += 1;
        if (this.accumulatedLoss <= 0.01) {
          // Full recovery achieved
          this.accumulatedLoss = 0;
          this.multiplier = 1;
          this.inRecovery = false;
          this.consecutiveWinsInRecovery = 0;
          this.recoverySignalThreshold = 0;
          this.recoveryConfirmationsRequired = 0;
          const modeLabel = this.config.mode === "GradualRecoveryPro" ? "Pro" : this.config.mode === "GradualRecoveryLite" ? "Lite" : this.config.mode === "GradualRecoveryProLite" ? "Pro Lite" : "Classic";
          this.showToast(`WIN! +$${profit.toFixed(2)}. Split-M ${modeLabel} — Full recovery achieved! Back to base stake.`, "green");
        } else {
          // Partial recovery — WIN resets threshold back to normal (65%)
          // Only raise threshold again if we get more consecutive losses
          this.inRecovery = true;
          this.recoverySignalThreshold = 0;
          this.recoveryConfirmationsRequired = 0;
          this.consecutiveLosses = 0;
          const pFactor = this.getPayoutFactor();
          const splitRatio = (this.config.mode === "GradualRecoveryLite" || this.config.mode === "GradualRecoveryProLite") ? 4 : 2;
          const nextStake = ((this.accumulatedLoss / splitRatio + this.config.stakeAmount) / pFactor);
          this.multiplier = Number((nextStake / this.config.stakeAmount).toFixed(2));
          this.showToast(`WIN! +$${profit.toFixed(2)}. Remaining to recover: -$${this.accumulatedLoss.toFixed(2)}. Next stake: $${nextStake.toFixed(2)}. Threshold reset to 65%.`, "green");
        }
      } else {
        // Standard mode — reset, stay on symbol
        this.consecutiveLosses = 0;
        this.accumulatedLoss = 0;
        this.multiplier = 1;
        this.inRecovery = false;
        this.consecutiveWinsInRecovery += 1;
        // Reset signal tightening after 3 consecutive wins
        if (this.consecutiveWinsInRecovery >= 3) {
          this.consecutiveWinsInRecovery = 0;
          this.recoverySignalThreshold = 0;
          this.recoveryConfirmationsRequired = 0;
          this.showToast(`WIN! +$${profit.toFixed(2)}. 3 consecutive wins — signal threshold reset to normal.`, "green");
        } else {
          this.showToast(`WIN! +$${profit.toFixed(2)}. (Trade #${this.sequenceDone + 1})`, "green");
        }
      }
    } else {
      this.consecutiveLosses += 1;
      this.accumulatedLoss += Math.abs(profit);

      let recoveryMsg = "";
      if (this.config.mode === "Martingale") {
        this.multiplier = this.multiplier * 2;
        this.inRecovery = true;
        const nextDouble = stake * 2;
        recoveryMsg = ` Doubling stake to $${nextDouble.toFixed(2)}.`;
      } else if (this.config.mode === "PayoutAdaptive") {
        this.inRecovery = true;
        const pFactor = this.getPayoutFactor();
        const nextSmartStake = ((this.accumulatedLoss + this.config.stakeAmount) / pFactor);
        this.multiplier = Number((nextSmartStake / this.config.stakeAmount).toFixed(2));
        recoveryMsg = ` Stake scaled to $${nextSmartStake.toFixed(2)} (Payout-Optimized) to recover -$${this.accumulatedLoss.toFixed(2)}.`;
      } else if (this.config.mode === "DAlembert") {
        this.inRecovery = true;
        const nextDAlembertStake = this.config.stakeAmount * (this.consecutiveLosses + 1);
        this.multiplier = this.consecutiveLosses + 1;
        recoveryMsg = ` D'Alembert linear scaling active. Next stake: $${nextDAlembertStake.toFixed(2)}.`;
      } else if (this.config.mode === "GradualRecovery") {
        // Classic: recover 50% of accumulated loss per trade, stay on same symbol
        this.inRecovery = true;
        this.consecutiveWinsInRecovery = 0;
        const pFactor = this.getPayoutFactor();
        const targetRecovery = this.accumulatedLoss / 2;
        const nextClassicStake = ((targetRecovery + this.config.stakeAmount) / pFactor);
        this.multiplier = Number((nextClassicStake / this.config.stakeAmount).toFixed(2));
        recoveryMsg = ` Split-M Classic: Targeting 50% recovery. Next stake: $${nextClassicStake.toFixed(2)}.`;
      } else if (this.config.mode === "GradualRecoveryPro") {
        this.inRecovery = true;
        this.consecutiveWinsInRecovery = 0;
        const pFactor = this.getPayoutFactor();
        const targetRecovery = this.accumulatedLoss / 2;
        const nextGradualStake = ((targetRecovery + this.config.stakeAmount) / pFactor);
        this.multiplier = Number((nextGradualStake / this.config.stakeAmount).toFixed(2));
        // After 2 consecutive losses — tighten signal AND scan all markets for best 75%+ pair
        if (this.consecutiveLosses >= 2) {
          this.recoverySignalThreshold = 75;
          this.recoveryConfirmationsRequired = 3;
          this.activeSymbol = null;
          this.botState = "STATE_SCANNING";
          recoveryMsg = ` ⚠️ 2 losses — scanning ALL markets for best 75%+ signal with 3 confirmations. Next stake: $${nextGradualStake.toFixed(2)}.`;
        } else {
          // Loss 1 — intermediate threshold: 70%/2 confirmations (more careful than normal)
          this.recoverySignalThreshold = 70;
          this.recoveryConfirmationsRequired = 2;
          recoveryMsg = ` Split-M Pro: Loss 1 — raised to 70% threshold. Next stake: $${nextGradualStake.toFixed(2)}.`;
        }
      } else if (this.config.mode === "GradualRecoveryLite") {
        this.inRecovery = true;
        this.consecutiveWinsInRecovery = 0;
        const pFactor = this.getPayoutFactor();
        const targetRecovery = this.accumulatedLoss / 4;
        const nextLiteStake = ((targetRecovery + this.config.stakeAmount) / pFactor);
        this.multiplier = Number((nextLiteStake / this.config.stakeAmount).toFixed(2));
        recoveryMsg = ` Split-M Lite: Targeting 25% recovery. Next stake: $${nextLiteStake.toFixed(2)}.`;
      } else if (this.config.mode === "GradualRecoveryProLite") {
        // Pro Lite: Pro's signal tightening + Lite's 25% recovery target
        this.inRecovery = true;
        this.consecutiveWinsInRecovery = 0;
        const pFactor = this.getPayoutFactor();
        const targetRecovery = this.accumulatedLoss / 4;
        const nextProLiteStake = ((targetRecovery + this.config.stakeAmount) / pFactor);
        this.multiplier = Number((nextProLiteStake / this.config.stakeAmount).toFixed(2));
        // After 2 consecutive losses — tighten signal AND scan all markets for best 75%+ pair
        if (this.consecutiveLosses >= 2) {
          this.recoverySignalThreshold = 75;
          this.recoveryConfirmationsRequired = 3;
          this.activeSymbol = null;
          this.botState = "STATE_SCANNING";
          recoveryMsg = ` ⚠️ 2 losses — scanning ALL markets for best 75%+ signal with 3 confirmations. Next stake: $${nextProLiteStake.toFixed(2)}.`;
        } else {
          // Loss 1 — intermediate threshold: 70%/2 confirmations (more careful than normal)
          this.recoverySignalThreshold = 70;
          this.recoveryConfirmationsRequired = 2;
          recoveryMsg = ` Split-M Pro Lite: Loss 1 — raised to 70% threshold, targeting 25% recovery. Next stake: $${nextProLiteStake.toFixed(2)}.`;
        }
      } else {
        // Standard mode — tighten signal threshold after loss
        this.multiplier = 1;
        this.inRecovery = true;
        this.consecutiveWinsInRecovery = 0;
        this.recoverySignalThreshold = 70;
        this.recoveryConfirmationsRequired = 2;
        recoveryMsg = ` Standard: Signal threshold raised to 70% + 2 confirmations until 3 consecutive wins.`;
      }

      this.showToast(`LOSS RECORDED! Loss: -$${Math.abs(profit).toFixed(2)}.${recoveryMsg}`, "red");
    }

    const nextSeqDone = this.sequenceDone + 1;
    this.sequenceDone = nextSeqDone;

    const limitsTriggered = this.checkSessionLimits();

    if (!limitsTriggered) {
      if (this.inRecovery || this.consecutiveLosses > 0) {
        const modeLabel = this.config.mode;

        // Reset confirmation counter on current symbol
        if (symbol && this.symbolStates[symbol]) {
          this.symbolStates[symbol].confirmationCounter = 0;
        }
        if (this.activeSymbol && this.symbolStates[this.activeSymbol]) {
          this.symbolStates[this.activeSymbol].confirmationCounter = 0;
        }

        // Pro/ProLite mode after 2+ losses — scan all markets for 75%+ signal
        if ((this.config.mode === "GradualRecoveryPro" || this.config.mode === "GradualRecoveryProLite") && this.consecutiveLosses >= 2) {
          this.botState = "STATE_SCANNING";
          this.activeSymbol = null;
          this.showToast(
            `Recovery series active (Trade #${nextSeqDone + 1}) using ${modeLabel} mode. Scanning ALL markets for 75%+ signal...`,
            "blue"
          );
        } else if ((this.config.mode === "GradualRecoveryPro" || this.config.mode === "GradualRecoveryProLite") && this.consecutiveLosses === 1) {
          // Pro/ProLite mode loss 1 — scan all markets for 70%+ signal
          this.botState = "STATE_SCANNING";
          this.showToast(
            `Recovery series active (Trade #${nextSeqDone + 1}) using ${modeLabel} mode. Scanning for 70%+ signal...`,
            "blue"
          );
        } else if (this.config.mode === "GradualRecovery" || this.config.mode === "GradualRecoveryLite") {
          // Classic/Lite — stay on same symbol, go straight to CONFIRMING
          this.botState = "STATE_CONFIRMING";
          this.showToast(
            `Recovery series active (Trade #${nextSeqDone + 1}) using ${modeLabel} mode. Waiting for confirmation on ${this.activeSymbol || symbol}...`,
            "blue"
          );
        } else {
          // Standard and Pro (loss 1) — scan for next entry
          this.botState = "STATE_SCANNING";
          this.showToast(
            `Recovery series active (Trade #${nextSeqDone + 1}) using ${modeLabel} mode. Scanning for next entry...`,
            "blue"
          );
        }

        // Immediately trigger scan so bot doesn't wait for next tick
        this.checkAndSwitchSymbol();
      } else {
        // Session successfully completed! Back to baseline and scan for best available pair.
        this.sequenceDone = 0;
        if (symbol && this.symbolStates[symbol]) {
          this.symbolStates[symbol].confirmationCounter = 0;
        }
        if (this.activeSymbol && this.symbolStates[this.activeSymbol]) {
          this.symbolStates[this.activeSymbol].confirmationCounter = 0;
        }
        this.botState = "STATE_SCANNING";
        this.activeSymbol = null; // Clear so we search and reload for an even better pair!
        this.showToast("Trade session / recovery complete. Searching and reloading for better pair...", "green");
        this.checkAndSwitchSymbol();
      }
    }
  }

  private checkSessionLimits(): boolean {
    let triggered = false;
    let reason = "";

    if (this.consecutiveLosses >= this.config.stopLoss) {
      triggered = true;
      reason = `Stop Loss threshold reached: ${this.config.stopLoss} consecutive losses recorded.`;
    }
    else if (this.sessionProfit >= (3 * this.config.stakeAmount)) {
      triggered = true;
      reason = `Take Profit threshold achieved: +$${(3 * this.config.stakeAmount).toFixed(2)} (3x the stake amount of $${this.config.stakeAmount.toFixed(2)}) reached!`;
    }

    if (triggered) {
      this.haltBot(reason);
    }

    return triggered;
  }

  private haltBot(reason: string) {
    this.botState = "STATE_STOPPED";

    // Maintain WS and scanning in the background even if deactivated/halted!
    this.activeSymbol = null;
    this.awaitingSettlement = false;

    this.showToast(`Trading Halted: ${reason}`, "grey", false);

    const list = [...this.tradeLogs];
    const wins = list.filter(l => l.outcome === "WIN").length;
    const losses = list.filter(l => l.outcome === "LOSS").length;
    const total = wins + losses;
    const winRate = total > 0 ? Number(((wins / total) * 100).toFixed(1)) : 0;

    this.sessionStats = {
      totalTrades: total,
      wins,
      losses,
      winRate,
      netProfit: this.sessionProfit,
      stopReason: reason,
      bestStreak: this.bestStreak,
      worstDrawdown: Number(this.worstDrawdown.toFixed(2))
    };

    this.showSummary = true;
    this.multiplier = 1;
    this.inRecovery = false;
    this.recoverySignalThreshold = 0;
    this.recoveryConfirmationsRequired = 0;
    this.consecutiveWinsInRecovery = 0;

    // Notify via Telegram
    if (this.sessionStats) {
      tgNotifier.notifySessionStopped(this.sessionStats);
    }
  }

  private startSilenceMonitor() {
    this.silenceCheckInterval = setInterval(() => {
      if (this.botState === "STATE_IDLE" || this.botState === "STATE_STOPPED") return;
      
      const now = Date.now();
      SYMBOLS.forEach(({ symbol }) => {
        const sState = this.symbolStates[symbol];
        if (sState && !sState.isClosed && sState.lastTickTime > 0 && now - sState.lastTickTime > 30000) {
          this.symbolStates[symbol] = {
            ...sState,
            isClosed: true,
            signalStrength: "SCANNING..."
          };
          this.showToast(`${sState.displayName} tick stream went silent. Market temporarily down.`, "grey");
        }
      });
    }, 10000);
  }

  public resetDemoBalance() {
    this.sandboxBalance = 10000.00;
    this.config.demoBalance = 10000.00;
    if (!this.config.apiToken || this.config.demoMode) {
      this.balance = "10000.00";
    }
    this.saveConfigPersistence();
    this.showToast("Demo/simulated balance has been reset to $10,000.00", "blue");
  }
}

// ─── Bot Manager ─────────────────────────────────────────────────────────────
// Creates and manages one ServerBot instance per Telegram user ID.
// Inactive bots are cleaned up after 30 minutes to free memory.

class BotManager {
  private bots: Map<string, { bot: ServerBot; lastActive: number }> = new Map();
  private readonly TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  private globalOnBalanceChange: ((telegramId: string, balance: number) => void) | null = null;

  constructor() {
    // Cleanup inactive bots every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  // Register a callback (e.g. MongoDB save) applied to every bot instance, present and future
  setGlobalBalanceChangeHandler(handler: (telegramId: string, balance: number) => void) {
    this.globalOnBalanceChange = handler;
    // Apply to any bots already created
    for (const entry of this.bots.values()) {
      entry.bot.onBalanceChange = handler;
    }
  }

  getBot(telegramId: string): ServerBot {
    const entry = this.bots.get(telegramId);
    if (entry) {
      entry.lastActive = Date.now();
      return entry.bot;
    }
    console.log(`[BotManager] Creating new bot instance for user ${telegramId}`);
    const bot = new ServerBot(telegramId);
    if (this.globalOnBalanceChange) {
      bot.onBalanceChange = this.globalOnBalanceChange;
    }
    this.bots.set(telegramId, { bot, lastActive: Date.now() });
    return bot;
  }

  private cleanup() {
    const now = Date.now();
    for (const [id, entry] of this.bots.entries()) {
      if (now - entry.lastActive > this.TIMEOUT_MS) {
        console.log(`[BotManager] Cleaning up inactive bot for user ${id}`);
        entry.bot.destroy();
        this.bots.delete(id);
      }
    }
  }
}

export const botManager = new BotManager();
// Keep backward compat single-user export for fallback
export const bot = botManager.getBot("default");
