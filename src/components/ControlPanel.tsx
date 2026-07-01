import { SYMBOLS, BotState, BotConfig } from "../types";

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
  reconnectCountdown,
}: ControlPanelProps) {
  const isRunning = botState !== "STATE_IDLE" && botState !== "STATE_STOPPED";

  const handleModeChange = (
    mode: "Standard" | "GradualRecovery" | "GradualRecoveryPro" | "GradualRecoveryLite" | "GradualRecoveryProLite"
  ) => {
    onConfigChange({ ...config, mode });
  };

  const handleEvenOddModeChange = (mode: "Standard" | "Pro") => {
    onConfigChange({ ...config, evenOddMode: mode });
  };

  const getStatusDisplay = () => {
    switch (botState) {
      case "STATE_IDLE":
        return { text: "READY TO START", sub: "Waiting for user initiation", dot: "bg-[#d1c5b4]", color: "text-[#4e4639]", bg: "bg-[#f5ede4]", border: "border-[#d1c5b4]" };
      case "STATE_CONNECTING":
        return { text: "WS CONNECTING", sub: reconnectCountdown !== null ? `Reconnecting in ${reconnectCountdown}s…` : "Establishing secure link to Broker Services…", dot: "bg-amber-500 pulsing-dot", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" };
      case "STATE_WARMING_UP":
        return { text: "WARMING UP CHANNELS", sub: "Populating tick buffers for 13 markets (min. 120 each)…", dot: "bg-[#775a19] pulsing-dot", color: "text-[#775a19]", bg: "bg-[#fff8e8]", border: "border-[#d1c5b4]" };
      case "STATE_SCANNING":
        return { text: "SCANNING ACTIVE CHANNELS", sub: "Auto-evaluating 13 synthetic markets simultaneously…", dot: "bg-[#c5a059] pulsing-dot", color: "text-[#775a19]", bg: "bg-[#ffdea5]/30", border: "border-[#c5a059]/50" };
      case "STATE_CONFIRMING":
        return (config.strategy ?? "under") === "evenodd"
          ? { text: "PATTERN WATCHING", sub: `Waiting for 3-digit reversal signal on ${SYMBOLS.find((s) => s.symbol === activeSymbol)?.name || activeSymbol}…`, dot: "bg-[#c5a059] pulsing-dot", color: "text-[#775a19]", bg: "bg-[#ffdea5]/40", border: "border-[#c5a059]" }
          : { text: "SIGNAL DETECTED", sub: `Matching 2-tick Under ${config.referenceDigit} qualifiers on ${SYMBOLS.find((s) => s.symbol === activeSymbol)?.name || activeSymbol}…`, dot: "bg-[#c5a059] pulsing-dot", color: "text-[#775a19]", bg: "bg-[#ffdea5]/40", border: "border-[#c5a059]" };
      case "STATE_TRADING":
        return (config.strategy ?? "under") === "evenodd"
          ? { text: "EVEN/ODD CONTRACT PLACED", sub: "Awaiting digit parity settlement on broker…", dot: "bg-success", color: "text-success", bg: "bg-success-light/50", border: "border-success/30" }
          : { text: "CONTRACT SEQUENCE PLACED", sub: "Executing rapid automated Digit Under settlements on broker…", dot: "bg-success", color: "text-success", bg: "bg-success-light/50", border: "border-success/30" };
      case "STATE_RECOVERY":
        return { text: "MARTINGALE RECOVERY SWEEP", sub: "Awaiting next confirming target on same volatility index…", dot: "bg-orange-500 pulsing-dot", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" };
      case "STATE_STOPPED":
        return { text: "SYSTEM HALTED", sub: "Session safety clamp triggered. Reset required.", dot: "bg-error", color: "text-error", bg: "bg-[#ffdad6]/40", border: "border-error/30" };
    }
  };

  const status = getStatusDisplay();

  const quickStakes = [0.35, 1, 5, 10];

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Mode selector */}
      <section className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.15em] px-1">ENGINE MODE</span>

        {/* Even/Odd strategy modes */}
        {(config.strategy ?? "under") === "evenodd" ? (
          <div className="bg-[#f5ede4] rounded-full p-1 flex items-center border border-[#d1c5b4]">
            {(["Standard", "Pro"] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={isRunning}
                onClick={() => handleEvenOddModeChange(m)}
                className={`flex-1 py-2 text-center rounded-full text-[10px] font-bold tracking-[0.12em] uppercase transition-all duration-200 cursor-pointer disabled:opacity-40 ${
                  (config.evenOddMode ?? "Standard") === m
                    ? "bg-[#c5a059] text-[#4e3700] shadow-sm"
                    : "text-[#4e4639] opacity-70 hover:opacity-100"
                }`}
              >
                {m === "Standard" ? "STANDARD" : "PRO (2× MARTINGALE)"}
              </button>
            ))}
          </div>
        ) : config.showAllModes ? (
          <div className="grid grid-cols-2 gap-2">
            {(["Standard", "GradualRecovery", "GradualRecoveryPro", "GradualRecoveryLite", "GradualRecoveryProLite"] as const).map((m) => {
              const labels: Record<string, string> = {
                Standard: "STANDARD",
                GradualRecovery: "SPLIT-M CLASSIC",
                GradualRecoveryPro: "SPLIT-M PRO",
                GradualRecoveryLite: "SPLIT-M LITE",
                GradualRecoveryProLite: "SPLIT-M PRO LITE",
              };
              return (
                <button
                  key={m}
                  type="button"
                  disabled={isRunning}
                  onClick={() => handleModeChange(m)}
                  className={`py-2 px-3 rounded-full text-[10px] font-bold tracking-[0.1em] uppercase transition-all duration-200 border cursor-pointer disabled:opacity-40 ${
                    config.mode === m
                      ? "bg-[#c5a059] text-[#4e3700] border-[#775a19]"
                      : "bg-[#f5ede4] text-[#4e4639] border-[#d1c5b4] hover:border-[#c5a059]"
                  }`}
                >
                  {labels[m]}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#f5ede4] rounded-full p-1 flex items-center border border-[#d1c5b4]">
            {(["GradualRecoveryProLite", "GradualRecoveryPro"] as const).map((m) => {
              const labels: Record<string, string> = { GradualRecoveryProLite: "SPLIT-M PRO LITE", GradualRecoveryPro: "SPLIT-M PRO" };
              return (
                <button
                  key={m}
                  type="button"
                  disabled={isRunning}
                  onClick={() => handleModeChange(m)}
                  className={`flex-1 py-2 text-center rounded-full text-[10px] font-bold tracking-[0.12em] uppercase transition-all duration-200 cursor-pointer disabled:opacity-40 ${
                    config.mode === m
                      ? "bg-[#c5a059] text-[#4e3700] shadow-sm"
                      : "text-[#4e4639] opacity-70 hover:opacity-100"
                  }`}
                >
                  {labels[m]}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Stake input */}
      <section className="glass-card rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.15em]">STAKE AMOUNT</span>
          <span className="text-[10px] font-bold text-[#775a19]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
            TP: ${(config.stakeAmount * 3).toFixed(2)} · SL: 4L
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={isRunning}
            onClick={() => onConfigChange({ ...config, stakeAmount: Math.max(0.35, parseFloat((config.stakeAmount - 0.5).toFixed(2))) })}
            className="w-12 h-12 rounded-full border border-[#d1c5b4] flex items-center justify-center text-[#775a19] hover:bg-[#f5ede4] active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
          >
            <span className="material-symbols-outlined">remove</span>
          </button>
          <div className="flex-1 text-center flex items-baseline justify-center gap-1">
            <span className="text-xl font-bold text-[#775a19]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>$</span>
            <input
              type="number"
              min="0.35"
              step="0.5"
              disabled={isRunning}
              value={config.stakeAmount === 0 ? "" : config.stakeAmount}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v >= 0) onConfigChange({ ...config, stakeAmount: v });
                else if (e.target.value === "") onConfigChange({ ...config, stakeAmount: 0 });
              }}
              onBlur={(e) => {
                if (!e.target.value || parseFloat(e.target.value) <= 0)
                  onConfigChange({ ...config, stakeAmount: 0.35 });
              }}
              className="bg-transparent border-none outline-none text-[40px] leading-none font-bold text-[#1e1b16] w-28 text-center disabled:opacity-50"
              style={{ fontFamily: "IBM Plex Mono, monospace" }}
            />
          </div>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => onConfigChange({ ...config, stakeAmount: parseFloat((config.stakeAmount + 0.5).toFixed(2)) })}
            className="w-12 h-12 rounded-full border border-[#d1c5b4] flex items-center justify-center text-[#775a19] hover:bg-[#f5ede4] active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
          >
            <span className="material-symbols-outlined">add</span>
          </button>
        </div>
        {/* Quick stake presets */}
        <div className="grid grid-cols-4 gap-2">
          {quickStakes.map((v) => (
            <button
              key={v}
              type="button"
              disabled={isRunning}
              onClick={() => onConfigChange({ ...config, stakeAmount: v })}
              className={`py-2 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer disabled:opacity-40 ${
                config.stakeAmount === v
                  ? "bg-[#ffdea5] text-[#4e3700] border-[#c5a059]"
                  : "bg-[#f5ede4] border-[#d1c5b4] text-[#4e4639] hover:border-[#c5a059]"
              }`}
              style={{ fontFamily: "IBM Plex Mono, monospace" }}
            >
              {v.toFixed(2)}
            </button>
          ))}
        </div>
      </section>

      {/* Start / Stop */}
      <section className="flex flex-col gap-3">
        {!isRunning ? (
          <button
            type="button"
            onClick={startBot}
            disabled={connectionStatus === "connecting"}
            className="w-full h-16 rounded-2xl gold-gradient flex items-center justify-center gap-3 shadow-[0_4px_20px_rgba(119,90,25,0.25)] active:scale-[0.98] transition-all duration-150 disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
            <span className="text-lg font-black text-white tracking-[0.05em] uppercase">START TRADING BOT</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={stopBot}
            className="w-full h-16 rounded-2xl bg-gradient-to-r from-error to-[#93000a] flex items-center justify-center gap-3 shadow-[0_4px_20px_rgba(186,26,26,0.2)] active:scale-[0.98] transition-all duration-150 cursor-pointer"
          >
            <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>stop</span>
            <span className="text-lg font-black text-white tracking-[0.05em] uppercase">STOP AUTOMATION</span>
          </button>
        )}

        {/* Status bar */}
        <div className={`flex items-center gap-3 p-3.5 rounded-xl border ${status.bg} ${status.border}`}>
          <div className={`w-2 h-2 rounded-full shrink-0 ${status.dot}`} />
          <div>
            <div className={`text-[10px] font-black uppercase tracking-[0.12em] ${status.color}`}>{status.text}</div>
            <div className="text-[11px] text-[#4e4639] mt-0.5 leading-snug font-medium">{status.sub}</div>
          </div>
        </div>
      </section>

      {/* Helper tip */}
      <p className="text-center text-[11px] text-[#4e4639]/60 italic px-4 leading-relaxed">
        * Bot runs in background. Use the navigation bar below to audit live markets or adjust parameters.
      </p>
    </div>
  );
}
