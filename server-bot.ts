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
  analysisTickCount: 300,
  minUnderPercentage: 65,
  confirmationRequired: 2,
  tradeSequenceCount: 3,
  stopLoss: 4.0,
  takeProfit: 6.0,
  maxDailyTrades: 50,
  selectedSymbol: "1HZ100V",
  mode: "GradualRecoveryProLite",
  showAllModes: false,
  strategy: "under",
  evenOddMode: "Standard",
  evenOddDominance: 55,
  evenOddMartingale: 2,
  evenOddCooldownDominance: 60,
  evenOddDirection: "BOTH",
  evenOddMinPatternRate: 55,
  digitMatchMartingale: false,
  digitMatchMartingaleMultiplier: 1.5,
  digitMatchMartingaleMaxSteps: 5,
  digitMatchConsecLossLimit: 4, // minimum pattern win rate % required before locking on a pair
  appId: "1089",
  apiToken: "",
  demoMode: true,
  demoBalance: 10000.00
};

// Even/Odd: minimum ticks before a pair qualifies for selection.
// Separate from analysisTickCount (300 buffer) so trading starts after ~2 min
// while pattern analysis improves as the full 300-tick buffer fills up.
const EVENODD_MIN_QUALIFYING_TICKS = 120;

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
  // Even/Odd cooldown: after 2 consecutive losses, skip the next 2 qualifying signals
  private evenOddCooldownSkipsRemaining: number = 0;
  // Digit Match: martingale step tracking
  private dmMartingaleStep: number = 0;
  private dmConsecLosses: number = 0;
  private dmPendingSignal: { symbol: string; dominantDigit: number; triggerDigit: number; confidence: number; qualityScore: number } | null = null;

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
  private pendingRealContract: { id: number | string; symbol: string; stake: number; seq: number; under_pct?: number; signal_strength?: string; direction?: "EVEN" | "ODD" } | null = null;
  private pendingVirtualContract: { symbol: string; stake: number; barrier: number; multiplier: number; seq: number; timestamp: string; under_pct?: number; signal_strength?: string; direction?: "EVEN" | "ODD" } | null = null;
  // Even/Odd strategy: holds a fired pattern signal until processEvenOddMachine consumes it
  private pendingEvenOddSignal: { symbol: string; direction: "EVEN" | "ODD" } | null = null;

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
    this.evenOddCooldownSkipsRemaining = 0;
    this.sequenceDone = 0;
    this.awaitingSettlement = false;
    this.currentStreak = 0;
    this.bestStreak = 0;
    this.peakProfit = 0;
    this.worstDrawdown = 0;
    this.pendingRealContract = null;
    this.pendingVirtualContract = null;
    this.pendingEvenOddSignal = null;
    this.dmPendingSignal = null;
    this.dmMartingaleStep = 0;
    this.dmConsecLosses = 0;
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
    // Preserve sandboxBalance and full user config — never wipe strategy/settings on demo connect
    const preservedSandboxBalance = this.sandboxBalance;
    const preservedConfig = this.config;
    this.config = { ...DEFAULT_CONFIG, ...preservedConfig, demoBalance: preservedSandboxBalance };
    this.tradeLogs = [];

    this.sessionProfit = 0;
    this.dailyTradesCount = 0;
    this.consecutiveLosses = 0;
    this.accumulatedLoss = 0;
    this.multiplier = 1;
    this.inRecovery = false;
    this.evenOddCooldownSkipsRemaining = 0;
    this.sequenceDone = 0;
    this.awaitingSettlement = false;
    this.currentStreak = 0;
    this.bestStreak = 0;
    this.peakProfit = 0;
    this.worstDrawdown = 0;
    this.pendingRealContract = null;
    this.pendingVirtualContract = null;
    this.pendingEvenOddSignal = null;
    this.dmPendingSignal = null;
    this.dmMartingaleStep = 0;
    this.dmConsecLosses = 0;
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
        evenPct: 0,
        oddPct: 0,
        signalStrength: "SCANNING...",
        confirmationCounter: 0,
        digitFreq: Array.from({ length: 10 }, (_, i) => i).reduce((acc, d) => ({ ...acc, [d]: 0 }), {}),
        digitPct: Array.from({ length: 10 }, (_, i) => i).reduce((acc, d) => ({ ...acc, [d]: 0 }), {}),
        lastDigit: null,
        qualified: false,
        tickCount: 0,
        lastTickTime: 0,
        isClosed: false,
        evenOddStreakType: null,
        evenOddStreakCount: 0,
        parityPatternEven: 0,
        parityPatternOdd: 0,
        evenPatternWinRate: null,
        oddPatternWinRate: null,
        evenPatternCount: 0,
        oddPatternCount: 0,
        dmDominantDigit: null,
        dmTriggerDigit: null,
        dmConfidence: 0,
        dmTradeQualityScore: 0,
        dmSignalReady: false,
        dmTieDetected: false,
        dmMarketStability: null,
        dmRiskLevel: null,
        dmDominantHistory: []
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
      evenOddCooldownSkipsRemaining: this.evenOddCooldownSkipsRemaining,
      dmMartingaleStep: this.dmMartingaleStep,
      dmConsecLosses: this.dmConsecLosses,
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
    console.log(`[updateConfig] strategy=${this.config.strategy} evenOddMode=${this.config.evenOddMode}`);
    // Enforce default-mode lock: when showAllModes is off, only Split-M Pro Lite and Split-M Pro are allowed
    if (!this.config.showAllModes) {
      const allowedDefaultModes = ["GradualRecoveryProLite", "GradualRecoveryPro"];
      if (!allowedDefaultModes.includes(this.config.mode)) {
        this.config.mode = "GradualRecoveryProLite";
      }
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
    this.evenOddCooldownSkipsRemaining = 0;
    this.sequenceDone = 0;
    this.awaitingSettlement = false;
    this.currentStreak = 0;
    this.bestStreak = 0;
    this.peakProfit = 0;
    this.worstDrawdown = 0;
    this.pendingRealContract = null;
    this.pendingVirtualContract = null;
    this.pendingEvenOddSignal = null;
    this.dmPendingSignal = null;
    this.dmMartingaleStep = 0;
    this.dmConsecLosses = 0;
    this.showSummary = false;
    this.sessionStats = null;

    this.showToast(`Starting Automated Trading Session... Strategy: ${(this.config.strategy ?? "under").toUpperCase()}`, "green");
    tgNotifier.notifyBotStarted(
      this.accountEmail ?? "unknown",
      this.config.mode,
      this.config.stakeAmount
    );
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connectWebSocket();
    } else {
      // Already connected — jump straight to scanning using the correct strategy engine
      this.botState = "STATE_SCANNING";
      if (this.config.strategy === "evenodd") {
        this.selectEvenOddSymbol();
      } else if (this.config.strategy === "digitmatch") {
        this.selectDigitMatchSymbol();
      } else {
        this.checkAndSwitchSymbol();
      }
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

    const evenCount = finalBuffer.filter(d => d % 2 === 0).length;
    const oddCount = bufferLength - evenCount;
    const evenPct = bufferLength > 0 ? Number(((evenCount / bufferLength) * 100).toFixed(1)) : 0;
    const oddPct = bufferLength > 0 ? Number(((oddCount / bufferLength) * 100).toFixed(1)) : 0;

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
      evenPct,
      oddPct,
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
        if (this.config.strategy === "evenodd") {
          this.selectEvenOddSymbol();
        } else if (this.config.strategy === "digitmatch") {
          this.selectDigitMatchSymbol();
        } else {
          this.checkAndSwitchSymbol();
        }
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

    const evenCount = updatedBuffer.filter(d => d % 2 === 0).length;
    const oddCount = bufferLength - evenCount;
    const evenPct = bufferLength > 0 ? Number(((evenCount / bufferLength) * 100).toFixed(1)) : 0;
    const oddPct = bufferLength > 0 ? Number(((oddCount / bufferLength) * 100).toFixed(1)) : 0;

    // Even/Odd strategy: track the live run of consecutive same-parity digits and detect
    // the "3 same-parity then a flip" reversal pattern that fires a trade signal.
    let nextStreakType = sState.evenOddStreakType;
    let nextStreakCount = sState.evenOddStreakCount;
    if (this.config.strategy === "evenodd") {
      const parity: "EVEN" | "ODD" = lastDigit % 2 === 0 ? "EVEN" : "ODD";
      const prevType = sState.evenOddStreakType;
      const prevCount = sState.evenOddStreakCount;

      if (prevType !== null && prevType !== parity && prevCount === 3 && this.activeSymbol === symbol) {
        // Pattern fired: 3+ consecutive prevType digits, now broken by the opposite parity.
        // Trade in the direction of the digit that just broke the streak.
        this.pendingEvenOddSignal = { symbol, direction: parity };
      }

      if (prevType === parity) {
        nextStreakCount = prevCount + 1;
      } else {
        nextStreakType = parity;
        nextStreakCount = 1;
      }
    }

    let strength: SymbolState["signalStrength"] = "SCANNING...";
    if (underPct >= 80) strength = "VERY STRONG";
    else if (underPct >= 75) strength = "STRONG";
    else if (underPct >= 70) strength = "MODERATE";
    else if (underPct >= 65) strength = "WEAK";

    const isQualified = underPct >= this.config.minUnderPercentage && bufferLength >= maxCapacity;

    // Live parity backtest — only computed for even/odd strategy to avoid unnecessary work
    const parityBacktest = this.config.strategy === "evenodd"
      ? this.computeParityBacktest(updatedBuffer)
      : { even: 0, odd: 0 };

    // Digit Match: compute smart analysis every tick for all symbols
    let dmFields: Pick<SymbolState, "dmDominantDigit" | "dmTriggerDigit" | "dmConfidence" | "dmTradeQualityScore" | "dmSignalReady" | "dmTieDetected" | "dmMarketStability" | "dmRiskLevel" | "dmDominantHistory"> = {
      dmDominantDigit: sState.dmDominantDigit,
      dmTriggerDigit: sState.dmTriggerDigit,
      dmConfidence: sState.dmConfidence,
      dmTradeQualityScore: sState.dmTradeQualityScore,
      dmSignalReady: false,
      dmTieDetected: sState.dmTieDetected,
      dmMarketStability: sState.dmMarketStability,
      dmRiskLevel: sState.dmRiskLevel,
      dmDominantHistory: sState.dmDominantHistory ?? []
    };

    if (updatedBuffer.length >= 15 && this.config.strategy === "digitmatch") {
      const dmAnalysis = this.calculateDigitMatchAnalysis(updatedBuffer);
      const prevHistory = (sState.dmDominantHistory ?? []).slice(-4);
      const newHistory = [...prevHistory, dmAnalysis.dominantDigit];

      // Signal rules: confidence ≥22%, stable dominant for last 3 cycles, no conflict in last 5, not uniform
      const last3 = newHistory.slice(-3);
      const last5 = newHistory.slice(-5);
      const ruleConfidence = dmAnalysis.confidence >= 22;
      const ruleStable3 = last3.length >= 3 && last3.every(d => d === dmAnalysis.dominantDigit);
      const ruleNotUniform = dmAnalysis.tradeQualityScore > 10;
      const ruleNoConflict5 = last5.every(d => d === dmAnalysis.dominantDigit || d === null);
      const signalReady = ruleConfidence && ruleStable3 && ruleNotUniform && ruleNoConflict5;

      // Tie detection
      const tieDetected = this.checkDigitTie(updatedBuffer);

      dmFields = {
        dmDominantDigit: dmAnalysis.dominantDigit,
        dmTriggerDigit: dmAnalysis.triggerDigit,
        dmConfidence: dmAnalysis.confidence,
        dmTradeQualityScore: dmAnalysis.tradeQualityScore,
        dmSignalReady: signalReady && !tieDetected,
        dmTieDetected: tieDetected,
        dmMarketStability: dmAnalysis.marketStability,
        dmRiskLevel: dmAnalysis.riskLevel,
        dmDominantHistory: newHistory
      };

      // If signal just fired on the active symbol, store it for processDigitMatchMachine
      if (signalReady && !tieDetected && this.activeSymbol === symbol && this.botState === "STATE_CONFIRMING") {
        if (!this.dmPendingSignal) {
          this.dmPendingSignal = {
            symbol,
            dominantDigit: dmAnalysis.dominantDigit,
            triggerDigit: dmAnalysis.triggerDigit,
            confidence: dmAnalysis.confidence,
            qualityScore: dmAnalysis.tradeQualityScore
          };
        }
      }
    }

    const updatedState: SymbolState = {
      ...sState,
      buffer: updatedBuffer,
      underPct,
      overPct,
      evenPct,
      oddPct,
      evenOddStreakType: nextStreakType,
      evenOddStreakCount: nextStreakCount,
      parityPatternEven: parityBacktest.even,
      parityPatternOdd: parityBacktest.odd,
      evenPatternWinRate: null,
      oddPatternWinRate: null,
      evenPatternCount: 0,
      oddPatternCount: 0,
      ...dmFields,
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

    if (this.config.strategy === "evenodd") {
      this.processEvenOddMachine(symbol, updatedState);
    } else if (this.config.strategy === "digitmatch") {
      this.processDigitMatchMachine(symbol, updatedState);
    } else {
      this.processTradingMachine(symbol, updatedState);
    }
  }

  /**
   * Scans the digit buffer for all completed "exactly 3 consecutive same-parity → flip"
   * patterns and tallies which direction (EVEN/ODD) the flip went.
   * Returns { even, odd } counts.
   */
  // ─── Digit Match Analysis Engine ──────────────────────────────────────────

  private calculateDigitMatchAnalysis(buffer: number[]): {
    dominantDigit: number; triggerDigit: number; confidence: number;
    tradeQualityScore: number; marketStability: "STABLE" | "VOLATILE" | "TRENDING";
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
  } {
    const rollingTicks = buffer.slice(-120);
    const len = rollingTicks.length || 1;

    const counts = Array(10).fill(0);
    rollingTicks.forEach(d => { if (d >= 0 && d <= 9) counts[d]++; });
    const freqs = counts.map((count, digit) => ({
      digit, count, percentage: parseFloat(((count / len) * 100).toFixed(2))
    }));

    // Stability: divide into 4 chunks, measure variance
    const chunkSize = 30;
    const chunks: number[][] = [[], [], [], []];
    for (let i = 0; i < rollingTicks.length; i++) {
      const ci = Math.min(Math.floor(i / chunkSize), 3);
      chunks[ci].push(rollingTicks[i]);
    }
    const chunkCounts = Array(10).fill(0).map(() => Array(4).fill(0));
    chunks.forEach((chunk, ci) => {
      chunk.forEach(d => { if (d >= 0 && d <= 9) chunkCounts[d][ci]++; });
    });
    const stabilities = Array(10).fill(0);
    for (let d = 0; d < 10; d++) {
      const avg = chunkCounts[d].reduce((a, b) => a + b, 0) / 4;
      const variance = chunkCounts[d].reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / 4;
      const stdDev = Math.sqrt(variance);
      stabilities[d] = Math.max(0, Math.min(100, Math.round(100 - (stdDev / Math.max(1, avg)) * 40)));
    }

    // Transition matrix
    const transitions = Array(10).fill(0).map(() => Array(10).fill(0));
    for (let i = 0; i < rollingTicks.length - 1; i++) {
      const a = rollingTicks[i], b = rollingTicks[i + 1];
      if (a >= 0 && a <= 9 && b >= 0 && b <= 9) transitions[a][b]++;
    }

    // Score all p/t combinations
    const combinations: { prediction: number; trigger: number; score: number; confidence: number; risk: "LOW" | "MEDIUM" | "HIGH" }[] = [];
    for (let p = 0; p < 10; p++) {
      for (let t = 0; t < 10; t++) {
        if (p === t) continue;
        const predFreq = freqs[p].percentage;
        const predStability = stabilities[p];
        const frequencyStrength = Math.max(0, Math.min(100, (predFreq * 5) + (predStability * 0.25)));
        const triggerFreq = freqs[t].percentage;
        const triggerRarityScore = Math.max(0, Math.min(100, 100 - Math.abs(triggerFreq - 9.5) * 15));
        const stabilityScore = Math.round((stabilities[p] * 0.6) + (stabilities[t] * 0.4));
        const separationVal = Math.abs(freqs[p].percentage - freqs[t].percentage);
        const signalSeparation = Math.min(100, separationVal * 15);
        const totalTransFromT = transitions[t].reduce((a, b) => a + b, 0);
        const transitionRate = totalTransFromT > 0 ? (transitions[t][p] / totalTransFromT) : 0;
        const correlationScore = Math.min(100, transitionRate * 300);
        const totalScore = (frequencyStrength * 0.30) + (triggerRarityScore * 0.20) + (stabilityScore * 0.20) + (signalSeparation * 0.15) + (correlationScore * 0.15);
        const confidence = Math.max(10, Math.min(99, Math.round(totalScore)));
        const risk: "LOW" | "MEDIUM" | "HIGH" = confidence >= 80 ? "LOW" : confidence < 55 ? "HIGH" : "MEDIUM";
        combinations.push({ prediction: p, trigger: t, score: totalScore, confidence, risk });
      }
    }
    combinations.sort((a, b) => b.score - a.score);
    const best = combinations[0] || { prediction: 4, trigger: 9, score: 50, confidence: 60, risk: "MEDIUM" as const };

    // Market stability from spread
    const maxPct = Math.max(...freqs.map(f => f.percentage));
    const minPct = Math.min(...freqs.map(f => f.percentage));
    const spread = maxPct - minPct;
    let marketStability: "STABLE" | "VOLATILE" | "TRENDING" = "STABLE";
    let stabilityIndex = 50;
    if (spread < 6) { marketStability = "VOLATILE"; stabilityIndex = Math.round(25 + spread * 4); }
    else if (spread > 13) { marketStability = "TRENDING"; stabilityIndex = Math.min(100, Math.round(75 + (spread - 13) * 2)); }
    else { marketStability = "STABLE"; stabilityIndex = Math.round(50 + (spread - 6) * 3.5); }

    const tradeQualityScore = Math.min(100, Math.round((best.confidence * 0.7) + (stabilityIndex * 0.3)));

    return {
      dominantDigit: best.prediction,
      triggerDigit: best.trigger,
      confidence: best.confidence,
      tradeQualityScore,
      marketStability,
      riskLevel: best.risk
    };
  }

  private checkDigitTie(buffer: number[]): boolean {
    const recent = buffer.slice(-15);
    if (recent.length === 0) return false;
    const counts = Array(10).fill(0);
    recent.forEach(d => { if (d >= 0 && d <= 9) counts[d]++; });
    const sorted = [...counts].sort((a, b) => b - a);
    return sorted[0] > 0 && sorted[0] === sorted[1];
  }

  // ─── Digit Match Strategy Engine ──────────────────────────────────────────

  private processDigitMatchMachine(symbol: string, state: SymbolState) {
    if (this.botState === "STATE_WARMING_UP") {
      const readyCount = Object.values(this.symbolStates).filter(
        s => s.buffer.length >= EVENODD_MIN_QUALIFYING_TICKS
      ).length;
      if (readyCount >= 5) {
        this.botState = "STATE_SCANNING";
        this.showToast("Digit Match engine active. Scanning for best pair…", "blue");
        this.selectDigitMatchSymbol();
      }
      return;
    }

    if (this.botState === "STATE_IDLE" || this.botState === "STATE_STOPPED") return;

    // Virtual settlement
    if (this.awaitingSettlement && this.pendingVirtualContract && this.pendingVirtualContract.symbol === symbol) {
      this.handleDigitMatchVirtualSettled(state.lastDigit!);
      return;
    }

    if (this.botState === "STATE_SCANNING") {
      this.selectDigitMatchSymbol();
      return;
    }

    // Locked on this symbol — execute when signal fires
    if (this.botState === "STATE_CONFIRMING" && this.activeSymbol === symbol) {
      if (this.dmPendingSignal && this.dmPendingSignal.symbol === symbol) {
        const sig = this.dmPendingSignal;
        this.dmPendingSignal = null;

        // Re-validate — still signal-ready and no tie?
        if (!state.dmSignalReady || state.dmTieDetected) {
          this.showToast(`Signal invalidated on ${state.displayName}. Re-scanning.`, "grey");
          this.activeSymbol = null;
          this.botState = "STATE_SCANNING";
          this.selectDigitMatchSymbol();
          return;
        }

        this.botState = "STATE_TRADING";
        this.executeDigitMatchTrade(sig.symbol, sig.dominantDigit, sig.triggerDigit, sig.confidence, sig.qualityScore, state);
      } else {
        // Continuously re-evaluate — drop pair if quality dropped or tie detected
        if (state.dmTieDetected) {
          this.showToast(`Tie detected on ${state.displayName}. Re-scanning.`, "grey");
          this.activeSymbol = null;
          this.botState = "STATE_SCANNING";
          this.dmPendingSignal = null;
          this.selectDigitMatchSymbol();
        }
      }
    }
  }

  private selectDigitMatchSymbol() {
    if (this.botState === "STATE_TRADING" || this.awaitingSettlement) return;

    const minBuffer = EVENODD_MIN_QUALIFYING_TICKS;
    const candidates = Object.values(this.symbolStates).filter(s =>
      s.buffer.length >= minBuffer && !s.isClosed && !s.dmTieDetected && s.dmTradeQualityScore > 0
    );

    if (candidates.length === 0) {
      if (this.activeSymbol !== null) {
        this.activeSymbol = null;
        this.botState = "STATE_SCANNING";
      }
      return;
    }

    // Pick pair with highest trade quality score
    candidates.sort((a, b) => b.dmTradeQualityScore - a.dmTradeQualityScore);
    const best = candidates[0];

    if (best.symbol !== this.activeSymbol) {
      this.dmPendingSignal = null;
      this.activeSymbol = best.symbol;
      this.botState = "STATE_CONFIRMING";
      this.showToast(
        `Digit Match locked on ${best.displayName} — Quality: ${best.dmTradeQualityScore}%, Digit [${best.dmDominantDigit}], Confidence: ${best.dmConfidence.toFixed(1)}%. Awaiting signal…`,
        "blue"
      );
    }
  }

  private executeDigitMatchTrade(
    symbol: string, dominantDigit: number, triggerDigit: number,
    confidence: number, qualityScore: number, state: SymbolState
  ) {
    const baseStake = this.config.stakeAmount;
    let computedStake = baseStake;

    if ((this.config.digitMatchMartingale ?? false) && this.dmMartingaleStep > 0) {
      const multiplier = this.config.digitMatchMartingaleMultiplier ?? 1.5;
      computedStake = Number((baseStake * Math.pow(multiplier, this.dmMartingaleStep)).toFixed(2));
    }

    const isSandbox = this.config.demoMode || !this.config.apiToken;
    const currentBalance = isSandbox
      ? Math.max(0, (Number(this.balance) || 10000) - this.bankBalance)
      : (Number(this.balance) || 0);

    if (computedStake > currentBalance) {
      this.showToast(`Insufficient balance for Digit Match stake: $${computedStake}. Halting.`, "red");
      this.haltBot(`Insufficient balance for DigitMatch stake`);
      return;
    }

    this.awaitingSettlement = true;
    this.showToast(
      `[DIGITMATCH] ${state.displayName} — Predict digit [${dominantDigit}] | Trigger [${triggerDigit}] | Confidence: ${confidence.toFixed(1)}% | Stake: $${computedStake.toFixed(2)}`,
      "blue"
    );

    if (isSandbox) {
      this.pendingVirtualContract = {
        symbol,
        stake: computedStake,
        barrier: dominantDigit, // reuse barrier field to store target digit
        multiplier: Number((computedStake / baseStake).toFixed(2)),
        seq: this.sequenceDone,
        timestamp: new Date().toISOString(),
        under_pct: qualityScore,
        signal_strength: `Q${qualityScore}% C${confidence.toFixed(0)}%`,
        direction: undefined
      };
    } else {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.pendingRealContract = {
          id: "",
          symbol,
          stake: computedStake,
          seq: this.sequenceDone,
          under_pct: qualityScore,
          signal_strength: `Q${qualityScore}% C${confidence.toFixed(0)}%`
        };

        this.ws.send(JSON.stringify({
          proposal: 1,
          amount: computedStake,
          basis: "stake",
          contract_type: "DIGITMATCH",
          currency: this.accountCurrency || "USD",
          duration: 1,
          duration_unit: "t",
          underlying_symbol: symbol,
          barrier: String(dominantDigit)
        }));
      }
    }
  }

  private handleDigitMatchVirtualSettled(settledDigit: number) {
    const contract = this.pendingVirtualContract;
    if (!contract) return;

    this.pendingVirtualContract = null;
    this.awaitingSettlement = false;

    const targetDigit = contract.barrier; // stored in barrier field
    const isWin = settledDigit === targetDigit;

    // DIGITMATCH payout: ~8.09× stake on win
    const DM_PAYOUT = 8.09;
    const profitAmount = isWin
      ? Number((contract.stake * DM_PAYOUT).toFixed(2))
      : -contract.stake;

    this.processDigitMatchOutcome(
      isWin ? "WIN" : "LOSS",
      contract.symbol,
      contract.stake,
      profitAmount,
      targetDigit,
      contract.under_pct ?? 0,
      contract.signal_strength ?? ""
    );
  }

  private processDigitMatchOutcome(
    outcome: "WIN" | "LOSS",
    symbol: string,
    stake: number,
    profit: number,
    targetDigit: number,
    qualityScore: number,
    signalStrength: string
  ) {
    const nextSessionProfit = Number((this.sessionProfit + profit).toFixed(2));
    this.sessionProfit = nextSessionProfit;
    const nextDailyTrades = this.dailyTradesCount + 1;
    this.dailyTradesCount = nextDailyTrades;

    // Update sandbox balance
    if (this.config.demoMode || !this.config.apiToken) {
      this.sandboxBalance = Number((this.sandboxBalance + profit).toFixed(2));
      this.config.demoBalance = this.sandboxBalance;
      this.balance = this.sandboxBalance.toFixed(2);
      this.saveConfigPersistence();
      if (this.onBalanceChange) this.onBalanceChange(this.telegramId, this.sandboxBalance);
    }

    if (outcome === "WIN") {
      this.currentStreak += 1;
      if (this.currentStreak > this.bestStreak) this.bestStreak = this.currentStreak;
    } else {
      this.currentStreak = 0;
    }
    if (nextSessionProfit > this.peakProfit) this.peakProfit = nextSessionProfit;
    const drawdown = this.peakProfit - nextSessionProfit;
    if (drawdown > this.worstDrawdown) this.worstDrawdown = drawdown;

    // Log trade
    const nextId = this.tradeLogs.length > 0 ? Math.max(...this.tradeLogs.map(l => l.id)) + 1 : 1;
    const multiplierUsed = Number((stake / this.config.stakeAmount).toFixed(2));
    const newLog: TradeLog = {
      id: nextId,
      timestamp: new Date().toISOString(),
      symbol,
      mode: `DigitMatch-${(this.config.digitMatchMartingale ?? false) ? "Martingale" : "Standard"}`,
      under_pct: qualityScore,
      signal_strength: signalStrength,
      barrier: targetDigit,
      stake,
      multiplier: multiplierUsed,
      outcome,
      profit,
      session_profit: nextSessionProfit,
      daily_trade_no: nextDailyTrades,
      consecutive_losses_before: this.dmConsecLosses,
      in_recovery: this.dmMartingaleStep > 0,
      target_digit: targetDigit
    };
    this.tradeLogs = [newLog, ...this.tradeLogs].slice(0, 200);
    this.saveLogsPersistence();

    if (outcome === "WIN") {
      tgNotifier.notifyTradeWin(newLog);
    } else {
      tgNotifier.notifyTradeLoss(newLog);
    }

    // Martingale / consecutive loss handling
    if (outcome === "WIN") {
      this.dmConsecLosses = 0;
      this.dmMartingaleStep = 0;
      this.showToast(`WIN! +$${profit.toFixed(2)} [DigitMatch] — Digit [${targetDigit}] matched! Stake reset.`, "green");
    } else {
      this.dmConsecLosses += 1;
      const maxSteps = this.config.digitMatchMartingaleMaxSteps ?? 5;
      const consecLimit = this.config.digitMatchConsecLossLimit ?? 4;

      if ((this.config.digitMatchMartingale ?? false) && this.dmMartingaleStep < maxSteps) {
        this.dmMartingaleStep += 1;
        const nextStake = Number((this.config.stakeAmount * Math.pow(this.config.digitMatchMartingaleMultiplier ?? 1.5, this.dmMartingaleStep)).toFixed(2));
        this.showToast(`LOSS -$${Math.abs(profit).toFixed(2)} [DigitMatch]. Next stake: $${nextStake.toFixed(2)} (step ${this.dmMartingaleStep}/${maxSteps}).`, "red");
      } else if ((this.config.digitMatchMartingale ?? false) && this.dmMartingaleStep >= maxSteps) {
        this.dmMartingaleStep = 0;
        this.showToast(`LOSS -$${Math.abs(profit).toFixed(2)} [DigitMatch]. Max martingale steps reached — stake reset.`, "red");
      } else {
        this.showToast(`LOSS -$${Math.abs(profit).toFixed(2)} [DigitMatch Standard]. Consecutive: ${this.dmConsecLosses}/${consecLimit}.`, "red");
      }

      if (this.dmConsecLosses >= consecLimit) {
        this.haltBot(`DigitMatch: ${consecLimit} consecutive losses reached`);
        this.showToast(`${consecLimit} consecutive losses — session halted for protection.`, "red");
        return;
      }
    }

    const nextSeqDone = this.sequenceDone + 1;
    this.sequenceDone = nextSeqDone;

    const limitsTriggered = this.checkSessionLimits();
    if (!limitsTriggered) {
      this.dmPendingSignal = null;
      this.activeSymbol = null;
      this.botState = "STATE_SCANNING";
      this.showToast("Digit Match cycle complete. Rescanning for best pair…", "blue");
      this.selectDigitMatchSymbol();
    }
  }

  private computeParityBacktest(buffer: number[]): { even: number; odd: number } {
    let even = 0, odd = 0;
    if (buffer.length < 4) return { even, odd };

    let streakType: "EVEN" | "ODD" | null = null;
    let streakCount = 0;

    for (let i = 0; i < buffer.length; i++) {
      const parity: "EVEN" | "ODD" = buffer[i] % 2 === 0 ? "EVEN" : "ODD";

      if (streakType === null) {
        streakType = parity;
        streakCount = 1;
      } else if (parity === streakType) {
        streakCount++;
      } else {
        // Streak broke — check if it was exactly 3
        if (streakCount === 3) {
          if (parity === "EVEN") even++;
          else odd++;
        }
        streakType = parity;
        streakCount = 1;
      }
    }
    return { even, odd };
  }

  // ─── Even/Odd Strategy Engine ─────────────────────────────────────────────

  private processEvenOddMachine(symbol: string, state: SymbolState) {
    // Warmup: wait until at least 5 markets have enough tick history
    if (this.botState === "STATE_WARMING_UP") {
      const readyCount = Object.values(this.symbolStates).filter(
        s => s.buffer.length >= EVENODD_MIN_QUALIFYING_TICKS
      ).length;
      if (readyCount >= 5) {
        this.botState = "STATE_SCANNING";
        this.showToast("Scanning warmup complete. Even/Odd engine active.", "blue");
        this.selectEvenOddSymbol();
      }
      return;
    }

    if (this.botState === "STATE_IDLE" || this.botState === "STATE_STOPPED") return;

    // Settlement dispatch for virtual (demo) trades
    if (this.awaitingSettlement && this.pendingVirtualContract && this.pendingVirtualContract.symbol === symbol) {
      this.handleEvenOddVirtualSettled(state.lastDigit!);
      return;
    }

    // Always try to lock onto the best pair while scanning
    if (this.botState === "STATE_SCANNING") {
      this.selectEvenOddSymbol();
      return;
    }

    // If we're locked on this symbol and a pattern signal fired, execute
    if (this.botState === "STATE_CONFIRMING" && this.activeSymbol === symbol) {
      // ── Continuous credibility monitor ─────────────────────────────────────
      const dominanceThreshold = this.evenOddCooldownSkipsRemaining > 0
        ? (this.config.evenOddCooldownDominance ?? 60)
        : (this.config.evenOddDominance ?? 55);
      const dirFilter = this.config.evenOddDirection ?? "BOTH";
      const minPatternRate = this.config.evenOddMinPatternRate ?? 55;

      const currentScore = (() => {
        if (dirFilter === "BOTH") return Math.max(state.evenPct, state.oddPct);
        const total = state.parityPatternEven + state.parityPatternOdd;
        if (total >= 5) {
          return dirFilter === "EVEN"
            ? (state.parityPatternEven / total) * 100
            : (state.parityPatternOdd / total) * 100;
        }
        return dirFilter === "EVEN" ? state.evenPct : state.oddPct;
      })();

      const totalPatterns = state.parityPatternEven + state.parityPatternOdd;
      const patternRate = totalPatterns >= 5
        ? (dirFilter === "EVEN" ? state.parityPatternEven
          : dirFilter === "ODD" ? state.parityPatternOdd
          : Math.max(state.parityPatternEven, state.parityPatternOdd)) / totalPatterns * 100
        : null;

      const dominanceFailed = currentScore < dominanceThreshold;
      const patternFailed = patternRate !== null && patternRate < minPatternRate;

      if (dominanceFailed || patternFailed) {
        const reason = dominanceFailed
          ? `dominance fell to ${currentScore.toFixed(1)}% (need ≥${dominanceThreshold}%)`
          : `pattern rate fell to ${patternRate!.toFixed(1)}% (need ≥${minPatternRate}%)`;
        this.showToast(`${state.displayName} ${reason}. Dropping — re-scanning.`, "grey");
        this.symbolStates[symbol].evenOddStreakType = null;
        this.symbolStates[symbol].evenOddStreakCount = 0;
        this.pendingEvenOddSignal = null;
        this.activeSymbol = null;
        this.botState = "STATE_SCANNING";
        this.selectEvenOddSymbol();
        return;
      }
      // ───────────────────────────────────────────────────────────────────────

      if (this.pendingEvenOddSignal && this.pendingEvenOddSignal.symbol === symbol) {
        const sig = this.pendingEvenOddSignal;
        this.pendingEvenOddSignal = null;

        // Re-validate dominance — use raised threshold if still in cooldown
        const dominanceThreshold = this.evenOddCooldownSkipsRemaining > 0
          ? (this.config.evenOddCooldownDominance ?? 60)
          : (this.config.evenOddDominance ?? 55);
        if (this.evenOddCooldownSkipsRemaining > 0) {
          this.evenOddCooldownSkipsRemaining -= 1;
          const skipsLeft = this.evenOddCooldownSkipsRemaining;
          this.showToast(
            `Cooldown active — skipping ${sig.direction} signal on ${state.displayName}. ${skipsLeft > 0 ? `${skipsLeft} skip${skipsLeft > 1 ? "s" : ""} remaining.` : "Cooldown lifted — resuming next signal."}`,
            "grey"
          );
          // Reset streak and re-scan so we catch the next fresh pattern
          this.symbolStates[symbol].evenOddStreakType = null;
          this.symbolStates[symbol].evenOddStreakCount = 0;
          this.activeSymbol = null;
          this.botState = "STATE_SCANNING";
          this.selectEvenOddSymbol();
          return;
        }

        // Direction filter: skip if signal doesn't match configured direction
        const dirFilter = this.config.evenOddDirection ?? "BOTH";
        if (dirFilter !== "BOTH" && sig.direction !== dirFilter) {
          this.showToast(
            `Signal skipped — ${sig.direction} trade filtered out (direction locked to ${dirFilter} only). Rescanning.`,
            "grey"
          );
          this.symbolStates[symbol].evenOddStreakType = null;
          this.symbolStates[symbol].evenOddStreakCount = 0;
          this.activeSymbol = null;
          this.botState = "STATE_SCANNING";
          this.selectEvenOddSymbol();
          return;
        }

        this.botState = "STATE_TRADING";
        this.executeEvenOddTrade(sig.symbol, sig.direction, state);
      }
    }
  }

  /**
   * Scan all symbols and lock onto the pair with the highest even/odd dominance ≥ threshold.
   * "Dominance" = max(evenPct, oddPct) — whichever side is stronger right now.
   */
  private selectEvenOddSymbol() {
    if (this.botState === "STATE_TRADING" || this.awaitingSettlement) return;

    const dominanceThreshold = this.evenOddCooldownSkipsRemaining > 0
      ? (this.config.evenOddCooldownDominance ?? 60)
      : (this.config.evenOddDominance ?? 55);
    const minBuffer = EVENODD_MIN_QUALIFYING_TICKS;
    const direction = this.config.evenOddDirection ?? "BOTH";
    const minPatternRate = this.config.evenOddMinPatternRate ?? 55;

    // Score each symbol based on direction filter.
    // For directional modes (EVEN/ODD), use the pattern win rate as primary score
    // since that directly measures how often reversals flip to the desired direction.
    // For BOTH mode, use raw dominance as before.
    const getScore = (s: SymbolState) => {
      if (direction === "BOTH") return Math.max(s.evenPct, s.oddPct);
      const total = s.parityPatternEven + s.parityPatternOdd;
      if (total >= 5) {
        // Use pattern win rate as primary score
        return direction === "EVEN"
          ? (s.parityPatternEven / total) * 100
          : (s.parityPatternOdd / total) * 100;
      }
      // Not enough patterns yet — fall back to raw directional pct
      return direction === "EVEN" ? s.evenPct : s.oddPct;
    };

    // Pattern win rate: how often reversal patterns flipped to the relevant direction
    const getPatternRate = (s: SymbolState) => {
      const total = s.parityPatternEven + s.parityPatternOdd;
      if (total === 0) return null;
      if (direction === "EVEN") return (s.parityPatternEven / total) * 100;
      if (direction === "ODD") return (s.parityPatternOdd / total) * 100;
      return (Math.max(s.parityPatternEven, s.parityPatternOdd) / total) * 100;
    };

    const candidates = Object.values(this.symbolStates).filter(s => {
      if (s.buffer.length < minBuffer || s.isClosed) return false;
      const total = s.parityPatternEven + s.parityPatternOdd;
      const hasPatternData = total >= 5;

      if (direction === "BOTH") {
        // BOTH: use raw dominance threshold
        if (Math.max(s.evenPct, s.oddPct) < dominanceThreshold) return false;
      } else {
        // Directional: use pattern rate if available, else raw directional pct
        const directionalPct = direction === "EVEN" ? s.evenPct : s.oddPct;
        const patternRatePct = hasPatternData
          ? (direction === "EVEN" ? s.parityPatternEven : s.parityPatternOdd) / total * 100
          : null;
        const effectiveScore = patternRatePct ?? directionalPct;
        if (effectiveScore < dominanceThreshold) return false;
      }

      // Pattern rate filter (only when enough data exists)
      const patternRate = getPatternRate(s);
      const totalPatterns = s.parityPatternEven + s.parityPatternOdd;
      if (totalPatterns >= 5 && patternRate !== null && patternRate < minPatternRate) return false;
      return true;
    });

    if (candidates.length === 0) {
      if (this.activeSymbol !== null) {
        this.activeSymbol = null;
        this.botState = "STATE_SCANNING";
        const sideLabel = direction === "BOTH" ? "even/odd" : direction.toLowerCase();
        this.showToast(`No pairs meet ≥${dominanceThreshold}% ${sideLabel} dominance + ≥${minPatternRate}% pattern rate — scanning.`, "grey");
      }
      return;
    }

    // Sort by combined score: dominance + pattern rate weighted equally
    candidates.sort((a, b) => {
      const aPattern = getPatternRate(a) ?? minPatternRate;
      const bPattern = getPatternRate(b) ?? minPatternRate;
      const aTotal = (getScore(a) + aPattern) / 2;
      const bTotal = (getScore(b) + bPattern) / 2;
      return bTotal - aTotal;
    });

    const best = candidates[0];

    if (best.symbol !== this.activeSymbol) {
      if (this.activeSymbol && this.symbolStates[this.activeSymbol]) {
        this.symbolStates[this.activeSymbol].evenOddStreakCount = 0;
        this.symbolStates[this.activeSymbol].evenOddStreakType = null;
      }
      this.pendingEvenOddSignal = null;
      this.activeSymbol = best.symbol;
      this.botState = "STATE_CONFIRMING";
      const score = getScore(best);
      const patternRate = getPatternRate(best);
      const sideLabel = direction === "BOTH"
        ? `${best.evenPct >= best.oddPct ? "EVEN" : "ODD"} dominant`
        : `${direction} dominance`;
      this.showToast(
        `Locked on ${best.displayName} — ${sideLabel}: ${score.toFixed(1)}%${patternRate !== null ? `, pattern rate: ${patternRate.toFixed(1)}%` : ""}. Watching for 3-digit pattern…`,
        "blue"
      );
    }
  }

  /**
   * Execute an Even/Odd trade (DIGITEVEN or DIGITODD, no barrier).
   */
  private executeEvenOddTrade(symbol: string, direction: "EVEN" | "ODD", state: SymbolState) {
    const baseStake = this.config.stakeAmount;
    let computedStake = baseStake;

    // Pro mode: 2× martingale on loss, reset on win
    if ((this.config.evenOddMode ?? "Standard") === "Pro" && this.consecutiveLosses > 0) {
      computedStake = Number((baseStake * this.multiplier).toFixed(2));
    }

    // Balance check
    const isSandbox = this.config.demoMode || !this.config.apiToken;
    const currentBalance = isSandbox
      ? Math.max(0, (Number(this.balance) || 10000) - this.bankBalance)
      : (Number(this.balance) || 0);
    if (computedStake > currentBalance) {
      this.showToast(
        `Insufficient balance. Required: $${computedStake.toFixed(2)}, Available: $${currentBalance.toFixed(2)}. Halting bot.`,
        "red"
      );
      this.haltBot(`Insufficient balance for Even/Odd stake: $${computedStake} vs $${currentBalance}`);
      return;
    }

    const dominance = direction === "EVEN" ? state.evenPct : state.oddPct;
    const dominantPct = Math.max(state.evenPct, state.oddPct);
    const dominantSide = state.evenPct >= state.oddPct ? "EVEN" : "ODD";
    const contractType = direction === "EVEN" ? "DIGITEVEN" : "DIGITODD";
    this.awaitingSettlement = true;

    this.showToast(
      `Order logged: [${contractType}] on ${state.displayName} ($${computedStake.toFixed(2)}) — ${dominantSide} dominant at ${dominantPct}%, trading ${direction} reversal`,
      "blue"
    );

    if (isSandbox) {
      this.pendingVirtualContract = {
        symbol,
        stake: computedStake,
        barrier: 0, // no barrier for even/odd
        multiplier: Number((computedStake / baseStake).toFixed(2)),
        seq: this.sequenceDone,
        timestamp: new Date().toISOString(),
        under_pct: dominance,
        signal_strength: state.signalStrength,
        direction
      };
    } else {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.pendingRealContract = {
          id: "",
          symbol,
          stake: computedStake,
          seq: this.sequenceDone,
          under_pct: dominance,
          signal_strength: state.signalStrength,
          direction
        };

        const proposalPayload = {
          proposal: 1,
          amount: computedStake,
          basis: "stake",
          contract_type: contractType,
          currency: this.accountCurrency || "USD",
          duration: 1,
          duration_unit: "t",
          underlying_symbol: symbol
        };

        this.ws.send(JSON.stringify(proposalPayload));
      }
    }
  }

  /**
   * Virtual (demo) settlement for Even/Odd contracts.
   * Win = settled digit parity matches the direction traded.
   */
  private handleEvenOddVirtualSettled(settledDigit: number) {
    const contract = this.pendingVirtualContract;
    if (!contract || !contract.direction) return;

    this.pendingVirtualContract = null;
    this.awaitingSettlement = false;

    const settledParity: "EVEN" | "ODD" = settledDigit % 2 === 0 ? "EVEN" : "ODD";
    const isWin = settledParity === contract.direction;

    // Even/Odd flat payout: ~95% of stake
    const EVENODD_PAYOUT = 0.95;
    const profitAmount = isWin
      ? Number((contract.stake * EVENODD_PAYOUT).toFixed(2))
      : -contract.stake;

    this.processEvenOddOutcome(
      isWin ? "WIN" : "LOSS",
      contract.symbol,
      contract.stake,
      profitAmount,
      contract.under_pct ?? 0,
      contract.signal_strength ?? "STRONG",
      contract.direction
    );
  }

  /**
   * Outcome handler for Even/Odd trades — handles martingale Pro mode and resets streak/symbol.
   */
  private processEvenOddOutcome(
    outcome: "WIN" | "LOSS",
    symbol: string,
    stake: number,
    profit: number,
    dominance: number,
    signalStrength: string,
    direction: "EVEN" | "ODD"
  ) {
    const nextSessionProfit = Number((this.sessionProfit + profit).toFixed(2));
    this.sessionProfit = nextSessionProfit;
    const nextDailyTrades = this.dailyTradesCount + 1;
    this.dailyTradesCount = nextDailyTrades;

    // Update sandbox balance
    if (this.config.demoMode || !this.config.apiToken) {
      this.sandboxBalance = Number((this.sandboxBalance + profit).toFixed(2));
      this.config.demoBalance = this.sandboxBalance;
      this.balance = this.sandboxBalance.toFixed(2);
      this.saveConfigPersistence();
      if (this.onBalanceChange) {
        this.onBalanceChange(this.telegramId, this.sandboxBalance);
      }
    }

    // Streak / drawdown tracking
    if (outcome === "WIN") {
      this.currentStreak += 1;
      if (this.currentStreak > this.bestStreak) this.bestStreak = this.currentStreak;
    } else {
      this.currentStreak = 0;
    }
    if (nextSessionProfit > this.peakProfit) this.peakProfit = nextSessionProfit;
    const drawdown = this.peakProfit - nextSessionProfit;
    if (drawdown > this.worstDrawdown) this.worstDrawdown = drawdown;

    // Log trade
    const nextId = this.tradeLogs.length > 0 ? Math.max(...this.tradeLogs.map(l => l.id)) + 1 : 1;
    const modeLabel = `EvenOdd-${this.config.evenOddMode ?? "Standard"}`;
    const newLog: TradeLog = {
      id: nextId,
      timestamp: new Date().toISOString(),
      symbol,
      mode: modeLabel,
      under_pct: dominance,
      signal_strength: signalStrength,
      barrier: 0,
      stake,
      multiplier: this.multiplier,
      outcome,
      profit,
      session_profit: nextSessionProfit,
      daily_trade_no: nextDailyTrades,
      consecutive_losses_before: this.consecutiveLosses,
      in_recovery: this.inRecovery,
      direction
    };
    this.tradeLogs = [newLog, ...this.tradeLogs].slice(0, 200);
    this.saveLogsPersistence();

    if (outcome === "WIN") {
      tgNotifier.notifyTradeWin(newLog);
    } else {
      tgNotifier.notifyTradeLoss(newLog);
    }

    // Pro mode: 2× on loss, reset on win
    if ((this.config.evenOddMode ?? "Standard") === "Pro") {
      if (outcome === "WIN") {
        this.consecutiveLosses = 0;
        this.multiplier = 1;
        this.inRecovery = false;
        this.evenOddCooldownSkipsRemaining = 0;
        this.showToast(`WIN! +$${profit.toFixed(2)} [EvenOdd Pro]. Stake reset to base.`, "green");
      } else {
        this.consecutiveLosses += 1;
        const m = this.config.evenOddMartingale ?? 2;
        this.multiplier = Math.pow(m, this.consecutiveLosses);
        this.inRecovery = true;
        const nextStake = Number((this.config.stakeAmount * this.multiplier).toFixed(2));
        if (this.consecutiveLosses >= 2) {
          // Progressive: each additional loss adds one more skip
          this.evenOddCooldownSkipsRemaining = this.consecutiveLosses;
          this.showToast(`LOSS -$${Math.abs(profit).toFixed(2)} [EvenOdd Pro]. ${this.consecutiveLosses} consecutive losses — cooldown: skipping next ${this.consecutiveLosses} signals (dominance raised to ${this.config.evenOddCooldownDominance ?? 60}%). Resumes at $${nextStake.toFixed(2)}.`, "red");
        } else {
          this.showToast(`LOSS -$${Math.abs(profit).toFixed(2)} [EvenOdd Pro]. Next stake: $${nextStake.toFixed(2)} (×${this.multiplier.toFixed(2)}).`, "red");
        }
      }
    } else {
      // Standard: fixed stake, track consecutive losses for cooldown + stop loss
      if (outcome === "WIN") {
        this.consecutiveLosses = 0;
        this.evenOddCooldownSkipsRemaining = 0;
        this.showToast(`WIN! +$${profit.toFixed(2)} [EvenOdd Standard].`, "green");
      } else {
        this.consecutiveLosses += 1;
        if (this.consecutiveLosses >= 2) {
          // Progressive: each additional loss adds one more skip
          this.evenOddCooldownSkipsRemaining = this.consecutiveLosses;
          this.showToast(`LOSS -$${Math.abs(profit).toFixed(2)} [EvenOdd Standard]. ${this.consecutiveLosses} consecutive losses — cooldown: skipping next ${this.consecutiveLosses} signals (dominance raised to ${this.config.evenOddCooldownDominance ?? 60}%).`, "red");
        } else {
          this.showToast(`LOSS -$${Math.abs(profit).toFixed(2)} [EvenOdd Standard]. Consecutive losses: ${this.consecutiveLosses}/${this.config.stopLoss}.`, "red");
        }
      }
    }

    const nextSeqDone = this.sequenceDone + 1;
    this.sequenceDone = nextSeqDone;

    const limitsTriggered = this.checkSessionLimits();
    if (!limitsTriggered) {
      // Full reset per cycle: clear streak, drop symbol lock, scan for best pair again
      if (this.activeSymbol && this.symbolStates[this.activeSymbol]) {
        this.symbolStates[this.activeSymbol].evenOddStreakType = null;
        this.symbolStates[this.activeSymbol].evenOddStreakCount = 0;
      }
      this.pendingEvenOddSignal = null;
      this.activeSymbol = null;
      this.botState = "STATE_SCANNING";
      this.showToast("Cycle complete. Resetting and scanning for next opportunity.", "blue");
      this.selectEvenOddSymbol();
    }
  }

  private processTradingMachine(symbol: string, symbolStateData: SymbolState) {
    // Safety guard — should never be called when strategy is evenodd or digitmatch
    if (this.config.strategy === "evenodd" || this.config.strategy === "digitmatch") return;

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

    // Safety balance check
    // Reserved Bank only applies to sandbox demo — never deduct from real Deriv account balance
    const isSandbox = this.config.demoMode || !this.config.apiToken;
    const currentBalance = isSandbox
      ? Math.max(0, (Number(this.balance) || 10000) - this.bankBalance)
      : (Number(this.balance) || 0);
    if (computedStake > currentBalance) {
      this.showToast(`Insufficient balance. Required: $${computedStake.toFixed(2)}, Available: $${currentBalance.toFixed(2)}. Halting bot.`, "red");
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
        timestamp: new Date().toISOString(),
        under_pct: currentActiveObj?.underPct ?? 0,
        signal_strength: currentActiveObj?.signalStrength ?? "STRONG"
      };
    } else {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // New Deriv API: first get proposal, then buy using proposal ID
        // Send proposal request — the response handler will execute the buy
        this.pendingRealContract = {
          id: "",
          symbol,
          stake: computedStake,
          seq: this.sequenceDone,
          under_pct: currentActiveObj?.underPct ?? 0,
          signal_strength: currentActiveObj?.signalStrength ?? "STRONG"
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
    const signalStr = contract.signal_strength || (currentActive ? currentActive.signalStrength : "STRONG");
    const under_pct = contract.under_pct ?? (currentActive ? currentActive.underPct : 0);
    
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
    // poc.symbol may be undefined or in a different format — fall back to activeSymbol
    const symbol = poc.symbol || poc.underlying || this.activeSymbol || "";
    
    if (poc && poc.balance_after !== undefined && poc.balance_after !== null) {
      const parsedBal = Number(poc.balance_after);
      if (!isNaN(parsedBal)) {
        this.balance = parsedBal.toFixed(2);
      }
    }
    // Use snapshotted values from trade entry — more accurate than reading current tick
    const savedContract = this.pendingRealContract;
    this.pendingRealContract = null;
    this.awaitingSettlement = false;

    const currentActive = this.symbolStates[symbol] || (this.activeSymbol ? this.symbolStates[this.activeSymbol] : null);
    const signalStr = savedContract?.signal_strength || (currentActive ? currentActive.signalStrength : "STRONG");
    const under_pct = savedContract?.under_pct ?? (currentActive ? currentActive.underPct : 0);

    // Even/Odd real trades: route to dedicated outcome handler
    if (this.config.strategy === "evenodd" && savedContract?.direction) {
      this.processEvenOddOutcome(
        isWin ? "WIN" : "LOSS",
        symbol,
        stakeAmount,
        profitAmount,
        under_pct,
        signalStr,
        savedContract.direction
      );
      return;
    }

    // DigitMatch real trades
    if (this.config.strategy === "digitmatch") {
      const targetDigit = savedContract?.under_pct !== undefined
        ? this.pendingVirtualContract?.barrier ?? 0
        : 0;
      // For real trades, barrier is the target digit stored in proposal
      const dmTargetDigit = Number(savedContract?.signal_strength?.match(/\d+/)?.[0] ?? 0);
      this.processDigitMatchOutcome(
        isWin ? "WIN" : "LOSS",
        symbol,
        stakeAmount,
        profitAmount,
        dmTargetDigit,
        under_pct,
        signalStr
      );
      return;
    }

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
    // Safety guard — even/odd and digitmatch trades must never reach this method
    if (this.config.strategy === "evenodd" || this.config.strategy === "digitmatch") return;

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
