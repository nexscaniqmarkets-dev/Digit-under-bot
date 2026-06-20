import React, { useState } from "react";
import { BotConfig } from "../types";
import { Settings, HelpCircle, Save, AlertTriangle, ShieldCheck, PlayCircle } from "lucide-react";

interface SettingsPanelProps {
  config: BotConfig;
  saveConfig: (newConfig: BotConfig) => void;
  isRunning: boolean;
}

export default function SettingsPanel({ config, saveConfig, isRunning }: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<BotConfig>(config);

  // Sync state if config updates from outside sources
  const handleInputChange = (key: keyof BotConfig, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (formData.stakeAmount <= 0) {
      alert("Base Stake Amount must be strictly greater than 0.");
      return;
    }
    if (formData.referenceDigit < 1 || formData.referenceDigit > 9) {
      alert("Reference boundary digit must be between 1 and 9.");
      return;
    }
    if (formData.analysisTickCount < 10 || formData.analysisTickCount > 300) {
      alert("Tick Analysis Buffer count must be between 10 and 300 ticks.");
      return;
    }
    if (formData.minUnderPercentage < 50 || formData.minUnderPercentage > 95) {
      alert("Minimum Under Percentage threshold must be between 50% and 95%.");
      return;
    }

    const automatedConfig = {
      ...formData,
      takeProfit: Number((formData.stakeAmount * 3).toFixed(2)),
      stopLoss: 4.0,
      confirmationRequired: 2,
      tradeSequenceCount: 3
    };

    saveConfig(automatedConfig);
    setIsOpen(false);
    alert("Configurations committed. Active session has been updated/reset with Take Profit set to 3x your stake amount ($" + (formData.stakeAmount * 3).toFixed(2) + ") and Stop Loss capped at 4 consecutive losses.");
  };

  return (
    <div className="bg-bg-card border border-white/[0.08] rounded-xl overflow-hidden shadow-sm animate-fade-in">
      {/* Head Header line toggle */}
      <div
        onClick={() => !isRunning && setIsOpen(!isOpen)}
        className={`px-5 py-4 flex items-center justify-between transition-all select-none ${
          isRunning ? "cursor-not-allowed opacity-60 bg-white/[0.01]" : "cursor-pointer hover:bg-white/[0.02] bg-transparent"
        }`}
      >
        <div className="flex items-center gap-3">
          <Settings className={`h-5 w-5 text-gold-500 transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`} />
          <div>
            <h3 className="text-xs font-bold tracking-widest text-white uppercase flex items-center gap-2 font-sans">
              BOT CONFIGURATION CAPABILITIES
              {isRunning && (
                <span className="text-[8px] font-bold tracking-wider px-2 py-0.5 bg-gold-500/10 text-gold-500 border border-gold-500/20 rounded uppercase font-mono">
                  LOCKED
                </span>
              )}
            </h3>
            <p className="text-[10px] text-neutral-500 mt-0.5 font-sans">
              {isOpen
                ? "Configure custom risk guidelines, signal trigger factors, and cloud variables"
                : `Base: $${config.stakeAmount} | Mode: ${config.mode} | Target: under ${config.referenceDigit} | Trigger: >= ${config.minUnderPercentage}%`}
            </p>
          </div>
        </div>

        {!isRunning && (
          <button
            type="button"
            className="text-[9px] font-bold tracking-widest uppercase px-3 py-1.5 text-gold-500 bg-gold-500/10 hover:bg-gold-500/15 rounded border border-gold-500/25 transition-all"
          >
            {isOpen ? "CLOSE" : "EDIT CONFIG"}
          </button>
        )}
      </div>

      {/* Expanded Forms block */}
      {isOpen && !isRunning && (
        <form onSubmit={handleApply} className="p-5 border-t border-white/[0.08] bg-[#131317]/50 flex flex-col gap-5">
          {/* Active Session Warning notice inside OCR page 16 */}
          <div className="bg-gold-500/5 border border-gold-500/15 p-3.5 rounded-lg flex items-start gap-2.5 text-gold-500 font-sans">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="text-[10px] leading-4 font-medium uppercase tracking-wider">
              Warning: Applying new constants immediately resets all current session histories, running streak counts, and Martingale multipliers.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* COLUMN 1: Basic Trading settings */}
            <div className="flex flex-col gap-4 font-sans">
              <h4 className="text-[9px] font-bold tracking-widest text-neutral-400 border-b border-white/[0.06] pb-2 uppercase">
                ⚙️ BASIC TUNING PARAMETERS
              </h4>
              
              {/* Stake Amount */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                  Stake Amount (USD)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={formData.stakeAmount}
                  onChange={(e) => handleInputChange("stakeAmount", parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#131317] border border-white/[0.06] rounded-lg px-3 py-2 font-mono text-xs text-white focus:outline-none focus:border-gold-500"
                />
              </div>

              {/* Reference boundary digit */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                  Reference Digit (Barrier)
                </label>
                <input
                  type="number"
                  min="1"
                  max="9"
                  required
                  value={formData.referenceDigit}
                  onChange={(e) => handleInputChange("referenceDigit", parseInt(e.target.value) || 0)}
                  className="w-full bg-[#131317] border border-white/[0.06] rounded-lg px-3 py-2 font-mono text-xs text-white focus:outline-none focus:border-gold-500"
                />
                <span className="text-[8.5px] text-neutral-500 leading-normal uppercase">Bot buys DIGITUNDER contract (losing on values &gt;= {formData.referenceDigit})</span>
              </div>

              {/* Show All Trading Modes Toggle */}
              <div className="flex items-center justify-between p-3 bg-[#131317] rounded-lg border border-white/[0.06]">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-white uppercase tracking-widest">Show All Trading Modes</span>
                  <span className="text-[8.5px] text-neutral-500 font-medium leading-snug mt-1">
                    {formData.showAllModes
                      ? "All 5 modes available for selection"
                      : "Locked to Split-M Pro Lite (recommended default)"}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={!!formData.showAllModes}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    handleInputChange("showAllModes", checked);
                    if (!checked) {
                      handleInputChange("mode", "GradualRecoveryProLite");
                    }
                  }}
                  className="h-4 w-4 rounded text-gold-500 focus:ring-0 focus:ring-offset-0 accent-gold-500 bg-[#0d0d0f] border-white/[0.1] cursor-pointer"
                />
              </div>

              {/* Mode Selection — only shown when Show All Modes is enabled */}
              {formData.showAllModes && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                    Stake &amp; Recovery Mode
                  </label>
                  <select
                    value={formData.mode}
                    onChange={(e) => handleInputChange("mode", e.target.value as any)}
                    className="w-full bg-[#131317] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-gold-500 cursor-pointer"
                  >
                    <option value="Standard">Standard (Fixed stakes)</option>
                    <option value="GradualRecovery">Split-M Classic (50% recovery)</option>
                    <option value="GradualRecoveryPro">Split-M Pro (50% recovery + signal tightening)</option>
                    <option value="GradualRecoveryLite">Split-M Lite (25% recovery, lower stakes)</option>
                    <option value="GradualRecoveryProLite">Split-M Pro Lite (25% recovery + signal tightening)</option>
                  </select>
                </div>
              )}
            </div>

            {/* COLUMN 2: Scanning threshold factors */}
            <div className="flex flex-col gap-4 font-sans">
              <h4 className="text-[9px] font-bold tracking-widest text-neutral-400 border-b border-white/[0.06] pb-2 uppercase">
                ⚡ DETECTOR THRESHOLDS
              </h4>

              {/* Ticks Analysis Buffer */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                  Analysis Tick Buffer Length
                </label>
                <input
                  type="number"
                  min="10"
                  max="300"
                  required
                  value={formData.analysisTickCount}
                  onChange={(e) => handleInputChange("analysisTickCount", parseInt(e.target.value) || 0)}
                  className="w-full bg-[#131317] border border-white/[0.06] rounded-lg px-3 py-2 font-mono text-xs text-white focus:outline-none focus:border-gold-500"
                />
                <span className="text-[8.5px] text-neutral-500 leading-normal uppercase">Depth of historical ticks to compute frequency scores.</span>
              </div>

              {/* Min Under Percentage */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                  Min Under % To Trigger (Signal)
                </label>
                <input
                  type="number"
                  min="50"
                  max="95"
                  required
                  value={formData.minUnderPercentage}
                  onChange={(e) => handleInputChange("minUnderPercentage", parseInt(e.target.value) || 0)}
                  className="w-full bg-[#131317] border border-white/[0.06] rounded-lg px-3 py-2 font-mono text-xs text-white focus:outline-none focus:border-gold-500"
                />
              </div>

              {/* Confirmation required */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[#131317] border border-white/[0.04]">
                  <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest leading-none">
                    Confirmations Req.
                  </span>
                  <span className="text-xs font-bold text-gold-400 font-mono mt-1">
                    2 Consecutive
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[#131317] border border-white/[0.04]">
                  <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest leading-none">
                    Sequence Count
                  </span>
                  <span className="text-xs font-bold text-gold-400 font-mono mt-1">
                    3 Trades Run
                  </span>
                </div>
              </div>
            </div>

            {/* COLUMN 3: Safety and Credentials */}
            <div className="flex flex-col gap-4 font-sans">
              <h4 className="text-[9px] font-bold tracking-widest text-neutral-400 border-b border-white/[0.06] pb-2 uppercase">
                🛡️ RISK PROTECTION LIMITS
              </h4>

              {/* Risk protection TP/SL */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[#131317] border border-white/[0.04]">
                  <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest leading-none">
                    Take Profit
                  </span>
                  <span className="text-xs font-bold text-emerald-400 font-mono mt-1">
                    3x Stake (${(formData.stakeAmount * 3).toFixed(2)})
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[#131317] border border-white/[0.04]">
                  <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest leading-none">
                    Stop Loss
                  </span>
                  <span className="text-xs font-bold text-rose-450 font-mono mt-1">
                    4 Consecutive L
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-white/[0.06] flex justify-end">
            <button
              type="submit"
              className="w-full px-6 py-2.5 rounded-lg border border-gold-500/20 text-black bg-gradient-to-r from-gold-600 to-gold-400 hover:from-gold-500 hover:to-gold-300 font-bold text-[10px] tracking-widest uppercase transition-all outline-none flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-gold-500/5 active:scale-95"
            >
              <Save className="h-3.5 w-3.5" /> APPLY AND SAVE CONFIG
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
