import React, { useState } from "react";
import { BotConfig } from "../types";

interface SettingsPanelProps {
  config: BotConfig;
  saveConfig: (newConfig: BotConfig) => void;
  isRunning: boolean;
}

export default function SettingsPanel({ config, saveConfig, isRunning }: SettingsPanelProps) {
  const [formData, setFormData] = useState<BotConfig>(config);
  const [openGroup, setOpenGroup] = useState<string | null>("tuning");

  const set = (key: keyof BotConfig, value: any) => setFormData((p) => ({ ...p, [key]: value }));

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.stakeAmount <= 0) { alert("Base stake must be > 0."); return; }
    if (formData.referenceDigit < 1 || formData.referenceDigit > 9) { alert("Reference digit must be 1–9."); return; }
    if (formData.analysisTickCount < 10 || formData.analysisTickCount > 300) { alert("Tick buffer must be 10–300."); return; }
    if (formData.minUnderPercentage < 50 || formData.minUnderPercentage > 95) { alert("Min Under % must be 50–95%."); return; }
    saveConfig({ ...formData, takeProfit: Number((formData.stakeAmount * 3).toFixed(2)), stopLoss: 4.0, confirmationRequired: 2, tradeSequenceCount: 3 });
    alert(`Config applied. TP set to $${(formData.stakeAmount * 3).toFixed(2)} · SL at 4 losses.`);
  };

  const toggle = (id: string) => setOpenGroup(openGroup === id ? null : id);

  const AccordionHeader = ({ id, icon, title }: { id: string; icon: string; title: string }) => (
    <button
      type="button"
      className="w-full px-4 py-4 flex items-center justify-between hover:bg-[#fbf2e9] transition-colors cursor-pointer"
      onClick={() => toggle(id)}
    >
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-[#775a19] opacity-70 text-[20px]">{icon}</span>
        <span className="text-[16px] font-semibold text-[#1e1b16] uppercase tracking-[0.04em]">{title}</span>
      </div>
      <span className={`material-symbols-outlined text-[#4e4639] transition-transform duration-300 ${openGroup === id ? "rotate-180" : ""}`}>expand_more</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-4 animate-fade-in pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[#1e1b16] uppercase tracking-[0.05em]">BOT SETTINGS</h1>
          <p className="text-[11px] text-[#4e4639] mt-0.5">Configure risk guidelines & signal parameters</p>
        </div>
        {isRunning && (
          <span className="px-3 py-1 rounded-full bg-[#ffdea5] text-[#4e3700] text-[9px] font-black uppercase tracking-wider border border-[#c5a059]">
            BOT ACTIVE · LOCKED
          </span>
        )}
      </div>

      {/* Active session status */}
      {isRunning && (
        <div className="glass-card rounded-xl p-3 flex items-center justify-between border-[#c5a059]/30 bg-[#ffdea5]/20">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#775a19]">smart_toy</span>
            <div>
              <p className="text-[10px] font-bold text-[#775a19] uppercase tracking-wider">ACTIVE SESSION</p>
              <p className="text-[13px] font-bold text-[#1e1b16] uppercase">BOT RUNNING</p>
            </div>
          </div>
        </div>
      )}

      {/* Warning */}
      <div className="bg-[#ffdad6]/30 border border-error/20 p-3 rounded-xl flex gap-3">
        <span className="material-symbols-outlined text-error text-[20px] shrink-0">warning</span>
        <p className="text-[12px] text-[#4e4639] leading-snug">
          <span className="font-bold text-error uppercase tracking-wider">Warning: </span>
          Applying new parameters resets all session streaks and martingale multipliers.
        </p>
      </div>

      <form onSubmit={handleApply} className="flex flex-col gap-3">
        {/* Strategy Selector */}
        <div className="glass-card rounded-xl overflow-hidden">
          <AccordionHeader id="strategy" icon="swap_horiz" title="STRATEGY" />
          {openGroup === "strategy" && (
            <div className="px-4 pb-5 pt-2 flex flex-col gap-4 border-t border-[#d1c5b4]/50">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.12em]">TRADING STRATEGY</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "under", label: "DIGIT UNDER", icon: "trending_down", desc: "Predict last digit under barrier" },
                    { value: "evenodd", label: "EVEN / ODD", icon: "swap_horiz", desc: "Predict parity reversal pattern" },
                    { value: "digitmatch", label: "DIGIT MATCH", icon: "target", desc: "Predict exact digit match (~8×)" },
                  ].map(({ value, label, icon, desc }) => (
                    <button
                      key={value} type="button" disabled={isRunning}
                      onClick={() => set("strategy", value as any)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all cursor-pointer disabled:opacity-40 ${
                        (formData.strategy ?? "under") === value
                          ? "border-[#775a19] bg-[#ffdea5] text-[#4e3700]"
                          : "border-[#d1c5b4] bg-[#f5ede4] text-[#4e4639] hover:border-[#c5a059]"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[22px]">{icon}</span>
                      <span className="text-[11px] font-black uppercase tracking-wider">{label}</span>
                      <span className="text-[9px] opacity-70 text-center leading-tight">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Even/Odd sub-options */}
              {(formData.strategy ?? "under") === "evenodd" && (
                <>
                  {/* Direction Filter */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.12em]">TRADE DIRECTION</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: "BOTH", label: "BOTH", icon: "swap_horiz", desc: "Even & Odd signals" },
                        { value: "EVEN", label: "EVEN", icon: "looks_two", desc: "Even signals only" },
                        { value: "ODD", label: "ODD", icon: "looks_one", desc: "Odd signals only" },
                      ].map(({ value, label, icon, desc }) => (
                        <button
                          key={value} type="button" disabled={isRunning}
                          onClick={() => set("evenOddDirection", value as any)}
                          className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border transition-all cursor-pointer disabled:opacity-40 ${
                            (formData.evenOddDirection ?? "BOTH") === value
                              ? "border-[#775a19] bg-[#ffdea5] text-[#4e3700]"
                              : "border-[#d1c5b4] bg-[#f5ede4] text-[#4e4639] hover:border-[#c5a059]"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">{icon}</span>
                          <span className="text-[11px] font-black uppercase tracking-wider">{label}</span>
                          <span className="text-[9px] opacity-70 text-center leading-tight">{desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.12em]">EVEN/ODD MODE</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "Standard", label: "STANDARD", desc: "Fixed stake, no progression" },
                        { value: "Pro", label: "PRO", desc: `${formData.evenOddMartingale ?? 2}× martingale on loss` },
                      ].map(({ value, label, desc }) => (
                        <button
                          key={value} type="button" disabled={isRunning}
                          onClick={() => set("evenOddMode", value as any)}
                          className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border transition-all cursor-pointer disabled:opacity-40 ${
                            (formData.evenOddMode ?? "Standard") === value
                              ? "border-[#775a19] bg-[#ffdea5] text-[#4e3700]"
                              : "border-[#d1c5b4] bg-[#f5ede4] text-[#4e4639] hover:border-[#c5a059]"
                          }`}
                        >
                          <span className="text-[11px] font-black uppercase tracking-wider">{label}</span>
                          <span className="text-[9px] opacity-70 text-center leading-tight">{desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Martingale multiplier — Pro only */}
                  {(formData.evenOddMode ?? "Standard") === "Pro" && (
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.12em]">MARTINGALE MULTIPLIER</label>
                      <span className="text-[13px] font-bold text-[#775a19]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        {(formData.evenOddMartingale ?? 2).toFixed(1)}×
                      </span>
                    </div>
                    <input
                      type="range" min="1.2" max="4" step="0.1" disabled={isRunning}
                      value={formData.evenOddMartingale ?? 2}
                      onChange={(e) => set("evenOddMartingale", parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-[#e9e1d8] rounded-lg appearance-none cursor-pointer accent-[#775a19] disabled:opacity-40"
                    />
                    <div className="flex justify-between text-[9px] text-[#7f7667]">
                      <span>1.2× (conservative)</span>
                      <span>2× (standard)</span>
                      <span>4× (aggressive)</span>
                    </div>
                    {(() => {
                      const m = formData.evenOddMartingale ?? 2;
                      const s = formData.stakeAmount ?? 1;
                      const l1 = (s * m).toFixed(2);
                      const l2 = (s * Math.pow(m, 2)).toFixed(2);
                      const l3 = (s * Math.pow(m, 3)).toFixed(2);
                      return (
                        <p className="text-[9px] text-[#7f7667] bg-[#f0e8df] rounded-lg px-2.5 py-1.5 leading-relaxed">
                          Stake progression: ${s} → ${l1} → ${l2} → ${l3} (then SL halts)
                        </p>
                      );
                    })()}
                  </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.12em]">DOMINANCE THRESHOLD</label>
                      <span className="text-[13px] font-bold text-[#775a19]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        {formData.evenOddDominance ?? 55}%
                      </span>
                    </div>
                    <input
                      type="range" min="51" max="75" disabled={isRunning}
                      value={formData.evenOddDominance ?? 55}
                      onChange={(e) => set("evenOddDominance", parseInt(e.target.value))}
                      className="w-full h-1.5 bg-[#e9e1d8] rounded-lg appearance-none cursor-pointer accent-[#775a19] disabled:opacity-40"
                    />
                    <p className="text-[9px] text-[#7f7667]">
                      Min even% or odd% required on the selected pair before trading (51–75%). Default: 55%.
                    </p>
                  </div>

                  {/* Cooldown dominance slider — visible for both modes */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.12em]">COOLDOWN THRESHOLD</label>
                      <span className="text-[13px] font-bold text-[#775a19]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        {formData.evenOddCooldownDominance ?? 60}%
                      </span>
                    </div>
                    <input
                      type="range" min={formData.evenOddDominance ?? 55} max="70" disabled={isRunning}
                      value={formData.evenOddCooldownDominance ?? 60}
                      onChange={(e) => set("evenOddCooldownDominance", parseInt(e.target.value))}
                      className="w-full h-1.5 bg-[#e9e1d8] rounded-lg appearance-none cursor-pointer accent-[#775a19] disabled:opacity-40"
                    />
                    <div className="flex justify-between text-[9px] text-[#7f7667]">
                      <span>{formData.evenOddDominance ?? 55}% (base)</span>
                      <span>70% (strict)</span>
                    </div>
                    <p className="text-[9px] text-[#7f7667]">
                      After 2+ consecutive losses, bot requires this higher dominance before re-entering. Default: 60%.
                    </p>
                  </div>

                  {/* Min pattern win rate */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.12em]">MIN PATTERN WIN RATE</label>
                      <span className="text-[13px] font-bold text-[#775a19]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        {formData.evenOddMinPatternRate ?? 55}%
                      </span>
                    </div>
                    <input
                      type="range" min="50" max="75" disabled={isRunning}
                      value={formData.evenOddMinPatternRate ?? 55}
                      onChange={(e) => set("evenOddMinPatternRate", parseInt(e.target.value))}
                      className="w-full h-1.5 bg-[#e9e1d8] rounded-lg appearance-none cursor-pointer accent-[#775a19] disabled:opacity-40"
                    />
                    <div className="flex justify-between text-[9px] text-[#7f7667]">
                      <span>50% (relaxed)</span>
                      <span>55% (default)</span>
                      <span>75% (strict)</span>
                    </div>
                    <p className="text-[9px] text-[#7f7667]">
                      Minimum historical reversal pattern win rate on a pair before the bot locks on. Requires ≥5 patterns to activate. Default: 55%.
                    </p>
                  </div>
                </>
              )}

              {/* DigitMatch sub-options */}
              {(formData.strategy ?? "under") === "digitmatch" && (
                <>
                  {/* Mode selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.12em]">DIGIT MATCH MODE</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "Standard", label: "STANDARD", desc: "Weighted scoring engine — 90 digit combinations" },
                        { value: "Pro", label: "PRO", desc: "Frequency + historical win rate — trigger-based" },
                      ].map(({ value, label, desc }) => (
                        <button
                          key={value} type="button" disabled={isRunning}
                          onClick={() => set("digitMatchMode", value as any)}
                          className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border transition-all cursor-pointer disabled:opacity-40 ${
                            (formData.digitMatchMode ?? "Standard") === value
                              ? "border-[#775a19] bg-[#ffdea5] text-[#4e3700]"
                              : "border-[#d1c5b4] bg-[#f5ede4] text-[#4e4639] hover:border-[#c5a059]"
                          }`}
                        >
                          <span className="text-[11px] font-black uppercase tracking-wider">{label}</span>
                          <span className="text-[9px] opacity-70 text-center leading-tight">{desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Stop Loss */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.12em]">STOP LOSS</label>
                      <span className="text-[13px] font-bold text-error" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        -${((formData.stakeAmount ?? 1) * (formData.digitMatchStopLossMultiple ?? 15)).toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range" min="5" max="30" step="1" disabled={isRunning}
                      value={formData.digitMatchStopLossMultiple ?? 15}
                      onChange={(e) => set("digitMatchStopLossMultiple", parseInt(e.target.value))}
                      className="w-full h-1.5 bg-[#e9e1d8] rounded-lg appearance-none cursor-pointer accent-[#775a19] disabled:opacity-40"
                    />
                    <div className="flex justify-between text-[9px] text-[#7f7667]">
                      <span>5× stake</span>
                      <span className="font-bold">{formData.digitMatchStopLossMultiple ?? 15}× stake (default 15×)</span>
                      <span>30× stake</span>
                    </div>
                  </div>

                  {/* Take Profit */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.12em]">TAKE PROFIT</label>
                      <span className="text-[13px] font-bold text-success" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                        +${((formData.stakeAmount ?? 1) * (formData.digitMatchTakeProfitMultiple ?? 20)).toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range" min="10" max="50" step="1" disabled={isRunning}
                      value={formData.digitMatchTakeProfitMultiple ?? 20}
                      onChange={(e) => set("digitMatchTakeProfitMultiple", parseInt(e.target.value))}
                      className="w-full h-1.5 bg-[#e9e1d8] rounded-lg appearance-none cursor-pointer accent-[#775a19] disabled:opacity-40"
                    />
                    <div className="flex justify-between text-[9px] text-[#7f7667]">
                      <span>10× stake</span>
                      <span className="font-bold">{formData.digitMatchTakeProfitMultiple ?? 20}× stake (default 20×)</span>
                      <span>50× stake</span>
                    </div>
                  </div>

                  {/* Tie cooldown toggle — applies to Standard and Pro */}
                  <div className="flex items-center justify-between py-2 border-t border-[#d1c5b4]/30">
                    <div>
                      <span className="text-[13px] text-[#1e1b16] font-semibold uppercase tracking-[0.04em]">30S COOLDOWN AFTER TIE</span>
                      <p className="text-[10px] text-[#7f7667] mt-0.5">
                        {(formData.digitMatchCooldownAfterTieEnabled ?? true)
                          ? "Waits 30s after a tie breaks before resuming"
                          : "Resumes immediately once a tie breaks"}
                      </p>
                    </div>
                    <div
                      className={`custom-switch ${(formData.digitMatchCooldownAfterTieEnabled ?? true) ? "switch-active" : ""}`}
                      onClick={() => !isRunning && set("digitMatchCooldownAfterTieEnabled", !(formData.digitMatchCooldownAfterTieEnabled ?? true))}
                    />
                  </div>

                  <div className="text-[9px] text-[#7f7667] bg-[#f0e8df] rounded-lg px-2.5 py-2 leading-relaxed">
                    At $1 stake: SL halts at -${((formData.stakeAmount ?? 1) * (formData.digitMatchStopLossMultiple ?? 15)).toFixed(2)} session loss · TP stops at +${((formData.stakeAmount ?? 1) * (formData.digitMatchTakeProfitMultiple ?? 20)).toFixed(2)} session profit
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Accordion 1: Basic Tuning */}
        <div className="glass-card rounded-xl overflow-hidden">
          <AccordionHeader id="tuning" icon="tune" title="BASIC TUNING" />
          {openGroup === "tuning" && (
            <div className="px-4 pb-5 pt-2 flex flex-col gap-4 border-t border-[#d1c5b4]/50">
              {/* Stake */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.12em]">STAKE AMOUNT (USD)</label>
                <div className="flex items-center bg-white border border-[#d1c5b4] rounded-lg h-11 px-3 focus-within:border-[#775a19] transition-colors">
                  <span className="text-[#775a19] font-bold mr-2" style={{ fontFamily: "IBM Plex Mono, monospace" }}>$</span>
                  <input
                    type="number" step="0.1" min="0.35" required disabled={isRunning}
                    value={formData.stakeAmount || ""}
                    onChange={(e) => set("stakeAmount", parseFloat(e.target.value) || 0)}
                    className="bg-transparent border-none focus:ring-0 w-full text-[14px] text-[#1e1b16] outline-none disabled:opacity-50"
                    style={{ fontFamily: "IBM Plex Mono, monospace" }}
                  />
                </div>
              </div>

              {/* Reference Digit — Digit Under only */}
              {(formData.strategy ?? "under") === "under" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.12em]">REFERENCE DIGIT (BARRIER)</label>
                <div className="grid grid-cols-5 gap-2">
                  {[1,2,3,4,5,6,7,8,9].slice(0,9).map((d) => (
                    <button
                      key={d} type="button" disabled={isRunning}
                      onClick={() => set("referenceDigit", d)}
                      className={`h-10 rounded border text-[14px] font-bold transition-all cursor-pointer disabled:opacity-40 ${
                        formData.referenceDigit === d
                          ? "border-[#775a19] bg-[#ffdea5] text-[#4e3700]"
                          : "border-[#d1c5b4] bg-[#f5ede4] text-[#4e4639] hover:border-[#c5a059]"
                      }`}
                      style={{ fontFamily: "IBM Plex Mono, monospace" }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-[#7f7667] mt-1">Bot places DIGITUNDER — wins if last digit is strictly less than this value.</p>
              </div>
              )}

              {/* Show all modes toggle — Digit Under only */}
              {(formData.strategy ?? "under") === "under" && (
              <div className="flex items-center justify-between py-2 border-t border-[#d1c5b4]/30">
                <div>
                  <span className="text-[13px] text-[#1e1b16] font-semibold uppercase tracking-[0.04em]">SHOW ALL TRADING MODES</span>
                  <p className="text-[10px] text-[#7f7667] mt-0.5">
                    {formData.showAllModes ? "All 5 modes available" : "Only Split-M Pro Lite & Pro shown"}
                  </p>
                </div>
                <div
                  className={`custom-switch ${formData.showAllModes ? "switch-active" : ""}`}
                  onClick={() => !isRunning && set("showAllModes", !formData.showAllModes)}
                />
              </div>
              )}
            </div>
          )}
        </div>

        {/* Accordion 2: Detector Thresholds */}
        <div className="glass-card rounded-xl overflow-hidden">
          <AccordionHeader id="detector" icon="analytics" title="DETECTOR THRESHOLDS" />
          {openGroup === "detector" && (
            <div className="px-4 pb-5 pt-2 flex flex-col gap-4 border-t border-[#d1c5b4]/50">
              {/* Tick buffer */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.12em]">TICK BUFFER SIZE</label>
                  <span className="text-[13px] font-bold text-[#775a19]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>{formData.analysisTickCount} TICKS</span>
                </div>
                <input
                  type="range" min="10" max="300" disabled={isRunning}
                  value={formData.analysisTickCount}
                  onChange={(e) => set("analysisTickCount", parseInt(e.target.value))}
                  className="w-full h-1.5 bg-[#e9e1d8] rounded-lg appearance-none cursor-pointer accent-[#775a19] disabled:opacity-40"
                />
                <p className="text-[9px] text-[#7f7667]">Historical ticks used to compute frequency scores (10–300)</p>
              </div>

              {/* Min Under % — Digit Under only */}
              {(formData.strategy ?? "under") === "under" && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.12em]">MIN UNDER PROBABILITY %</label>
                  <span className="text-[13px] font-bold text-[#775a19]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>{formData.minUnderPercentage}%</span>
                </div>
                <input
                  type="range" min="50" max="95" disabled={isRunning}
                  value={formData.minUnderPercentage}
                  onChange={(e) => set("minUnderPercentage", parseInt(e.target.value))}
                  className="w-full h-1.5 bg-[#e9e1d8] rounded-lg appearance-none cursor-pointer accent-[#775a19] disabled:opacity-40"
                />
              </div>
              )}

              {/* Fixed params */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#d1c5b4]/30">
                <div className="bg-[#fbf2e9] rounded-lg p-3 border border-[#d1c5b4]/50">
                  <div className="text-[9px] font-bold text-[#4e4639] uppercase tracking-wider mb-1">Confirmations Req.</div>
                  <div className="text-[13px] font-bold text-[#775a19]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>2 Consecutive</div>
                </div>
                <div className="bg-[#fbf2e9] rounded-lg p-3 border border-[#d1c5b4]/50">
                  <div className="text-[9px] font-bold text-[#4e4639] uppercase tracking-wider mb-1">Sequence Count</div>
                  <div className="text-[13px] font-bold text-[#775a19]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>3 Trades</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Accordion 3: Risk Protection */}
        <div className="glass-card rounded-xl overflow-hidden">
          <AccordionHeader id="risk" icon="security" title="RISK PROTECTION" />
          {openGroup === "risk" && (
            <div className="px-4 pb-5 pt-2 flex flex-col gap-4 border-t border-[#d1c5b4]/50">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#f0fdf4] rounded-lg p-3 border border-success/20">
                  <div className="text-[9px] font-bold text-[#4e4639] uppercase tracking-wider mb-1">TAKE PROFIT</div>
                  <div className="text-[14px] font-bold text-success" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                    ${(formData.stakeAmount * 3).toFixed(2)}
                  </div>
                  <div className="text-[9px] text-[#4e4639]/70 mt-0.5">Auto: 3× stake</div>
                </div>
                <div className="bg-[#ffdad6]/30 rounded-lg p-3 border border-error/20">
                  <div className="text-[9px] font-bold text-[#4e4639] uppercase tracking-wider mb-1">STOP LOSS</div>
                  <div className="text-[14px] font-bold text-error" style={{ fontFamily: "IBM Plex Mono, monospace" }}>4 Losses</div>
                  <div className="text-[9px] text-[#4e4639]/70 mt-0.5">Consecutive</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          type="submit"
          disabled={isRunning}
          className="w-full gold-gradient text-white font-bold text-[12px] py-4 rounded-xl shadow-lg shadow-[#775a19]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-[0.08em] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[20px]">save</span>
          APPLY & SAVE CONFIG
        </button>
      </form>
    </div>
  );
}
