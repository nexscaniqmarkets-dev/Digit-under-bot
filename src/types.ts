export interface SymbolInfo {
  symbol: string;
  name: string;
}

export const SYMBOLS: SymbolInfo[] = [
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

export interface BotConfig {
  stakeAmount: number;
  referenceDigit: number;
  analysisTickCount: number;
  minUnderPercentage: number;
  confirmationRequired: number;
  tradeSequenceCount: number;
  stopLoss: number;
  takeProfit: number;
  maxDailyTrades: number;
  selectedSymbol: string;
  mode: "Standard" | "GradualRecovery" | "GradualRecoveryPro" | "GradualRecoveryLite" | "GradualRecoveryProLite";
  appId: string;
  apiToken: string;
  demoMode: boolean; // if true, simulates virtual trades inside the bot
  demoBalance?: number; // persistent simulated balance
}

export type BotState =
  | "STATE_IDLE"
  | "STATE_CONNECTING"
  | "STATE_WARMING_UP"
  | "STATE_SCANNING"
  | "STATE_CONFIRMING"
  | "STATE_TRADING"
  | "STATE_RECOVERY"
  | "STATE_STOPPED";

export interface SymbolState {
  symbol: string;
  displayName: string;
  buffer: number[];
  underPct: number;
  overPct: number;
  signalStrength: "VERY STRONG" | "STRONG" | "MODERATE" | "WEAK" | "SCANNING...";
  confirmationCounter: number;
  digitFreq: Record<number, number>;
  digitPct: Record<number, number>;
  lastDigit: number | null;
  qualified: boolean;
  tickCount: number;
  lastTickTime: number; // For detecting markets going silent (closed)
  isClosed: boolean; // Silent > 30 seconds
}

export interface TradeLog {
  id: number;
  timestamp: string; // ISO string
  symbol: string;
  mode: "Standard" | "GradualRecovery" | "GradualRecoveryPro" | "GradualRecoveryLite" | "GradualRecoveryProLite";
  under_pct: number;
  signal_strength: string;
  barrier: number;
  stake: number;
  multiplier: number;
  outcome: "WIN" | "LOSS";
  profit: number;
  session_profit: number;
  daily_trade_no: number;
  consecutive_losses_before: number;
  in_recovery: boolean;
}

export interface ToastMessage {
  id: string;
  type: "blue" | "orange" | "green" | "red" | "grey";
  message: string;
  dismissible: boolean;
  timestamp: number;
}

export interface SessionStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number; // %
  netProfit: number;
  stopReason: string;
  bestStreak: number;
  worstDrawdown: number;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
          };
          query_id?: string;
          auth_date?: string;
          hash?: string;
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        HapticFeedback?: {
          notificationOccurred: (type: "error" | "success" | "warning") => void;
          impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
          selectionChanged: () => void;
        };
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
      };
    };
  }
}

