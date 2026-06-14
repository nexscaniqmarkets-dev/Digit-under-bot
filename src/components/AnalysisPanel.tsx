import { useEffect, useRef } from "react";
import { SymbolState } from "../types";
import { Chart } from "chart.js/auto";
import { BarChart3, Clock, AlertCircle } from "lucide-react";

interface AnalysisPanelProps {
  inspectSymbolState: SymbolState | undefined;
  referenceDigit: number;
}

export default function AnalysisPanel({
  inspectSymbolState,
  referenceDigit
}: AnalysisPanelProps) {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  // Extract variables
  const displayName = inspectSymbolState?.displayName || "Select a Symbol";
  const symbol = inspectSymbolState?.symbol || "";
  const buffer = inspectSymbolState?.buffer || [];
  const digitPct = inspectSymbolState?.digitPct || {};
  const digitFreq = inspectSymbolState?.digitFreq || {};
  const underPct = inspectSymbolState?.underPct || 0;
  const overPct = inspectSymbolState?.overPct || 0;
  const lastDigit = inspectSymbolState?.lastDigit ?? null;
  const signalStrength = inspectSymbolState?.signalStrength || "SCANNING...";

  // Get index stats to find the highest and lowest frequencies
  const getMinMaxDigits = () => {
    if (Object.keys(digitPct).length === 0) return { minDigit: -1, maxDigit: -1 };
    
    let maxVal = -1;
    let minVal = 101;
    let maxDigit = -1;
    let minDigit = -1;

    for (let d = 0; d < 10; d++) {
      const val = digitPct[d] ?? 0;
      if (val > maxVal) {
        maxVal = val;
        maxDigit = d;
      }
      if (val < minVal) {
        minVal = val;
        minDigit = d;
      }
    }
    return { minDigit, maxDigit };
  };

  const { minDigit, maxDigit } = getMinMaxDigits();

  // Create Bar chart instance
  useEffect(() => {
    if (!chartRef.current) return;

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    // Destroy old if exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const initialData = Array.from({ length: 10 }, (_, i) => digitPct[i] || 0);

    chartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
        datasets: [
          {
            label: "Occurrences (%)",
            data: initialData,
            backgroundColor: Array.from({ length: 10 }, (_, i) =>
              i < referenceDigit ? "rgba(197, 160, 89, 0.35)" : "rgba(225, 29, 72, 0.35)"
            ),
            borderColor: Array.from({ length: 10 }, (_, i) => {
              if (i === referenceDigit) return "#C5A059";
              return i < referenceDigit ? "#C5A059" : "#f43f5e";
            }),
            borderWidth: Array.from({ length: 10 }, (_, i) => (i === referenceDigit ? 2.5 : 1)),
            borderRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `Percentage: ${context.raw}%`
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 25,
            grid: { color: "rgba(255, 255, 255, 0.04)" },
            ticks: {
              color: "#6b7280",
              font: { family: "JetBrains Mono", size: 10 },
              callback: (val) => `${val}%`
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              color: "#9ca3af",
              font: { family: "JetBrains Mono", size: 11, weight: "bold" }
            }
          }
        },
        animation: { duration: 150 }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, []); // Once on mount

  // Update Chart values dynamically
  useEffect(() => {
    if (chartInstance.current) {
      const dataValues = Array.from({ length: 10 }, (_, i) => digitPct[i] || 0);
      chartInstance.current.data.datasets[0].data = dataValues;

      // Dynamically recalculate color bars based on possibly updated config
      const bgs = Array.from({ length: 10 }, (_, i) =>
        i < referenceDigit ? "rgba(197, 160, 89, 0.4)" : "rgba(225, 29, 72, 0.4)"
      );
      const borders = Array.from({ length: 10 }, (_, i) => {
        if (i === referenceDigit) return "#C5A059";
        return i < referenceDigit ? "#C5A059" : "#f43f5e";
      });
      const widths = Array.from({ length: 10 }, (_, i) => (i === referenceDigit ? 2.5 : 1));

      chartInstance.current.data.datasets[0].backgroundColor = bgs;
      chartInstance.current.data.datasets[0].borderColor = borders;
      chartInstance.current.data.datasets[0].borderWidth = widths;

      chartInstance.current.update("none"); // Use 'none' mode for lightning speed
    }
  }, [digitPct, referenceDigit]);

  // Extract last 20 elements of buffer to display as circular bubbles
  const last20Ticks = buffer.slice(-20);

  return (
    <div className="bg-bg-card border border-white/[0.08] rounded-xl p-5 shadow-sm flex flex-col gap-6 animate-fade-in">
      {/* Panel title */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-gold-500" />
          <h2 className="text-xs font-bold text-white tracking-widest uppercase font-sans">
            REAL-TIME INTENSITY SCAN: <span className="text-gold-500 font-mono">{displayName}</span>
          </h2>
        </div>
        {inspectSymbolState && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-500 uppercase tracking-widest text-[9px] font-bold">TICKS COLLECTED:</span>
            <span className="font-mono bg-[#1c1c22] px-2.5 py-0.5 rounded text-white border border-white/[0.06] text-[10px] font-semibold">
              {buffer.length}
            </span>
          </div>
        )}
      </div>

      {!inspectSymbolState ? (
        <div className="py-16 text-center text-neutral-500 flex flex-col items-center justify-center gap-3">
          <AlertCircle className="h-10 w-10 text-neutral-650" />
          <p className="text-xs uppercase tracking-wide">Select a synthetic index from the dashboard to launch live spectrum analysis</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* A. Left - Digit Grid and metrics */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-5">
            {/* Grid 2x5 */}
            <div>
              <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-2.5 font-bold font-sans">
                Digit Probability Matrix
              </span>
              <div className="grid grid-cols-5 gap-2.5 font-mono">
                {Array.from({ length: 10 }, (_, d) => {
                  const isLastDigit = lastDigit === d;
                  const isMax = maxDigit === d && (digitPct[d] || 0) > 0;
                  const isMin = minDigit === d && (digitPct[d] || 0) > 0;
                  const pct = digitPct[d] || 0.0;
                  const count = digitFreq[d] || 0;

                  let borderClass = "border-white/[0.05] bg-[#131317]/50 text-neutral-400";
                  let highlightTag = null;

                  if (isLastDigit) {
                    borderClass = "border-gold-500 bg-gold-500/5 shadow-sm text-gold-500";
                    highlightTag = "CURR";
                  } else if (isMax) {
                    borderClass = "border-emerald-500 bg-emerald-500/5 text-emerald-400";
                    highlightTag = "MAX";
                  } else if (isMin) {
                    borderClass = "border-rose-500 bg-rose-500/5 text-rose-400";
                    highlightTag = "MIN";
                  }

                  return (
                    <div
                      key={d}
                      className={`relative flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${borderClass}`}
                    >
                      {highlightTag && (
                        <span
                          className={`absolute top-1 right-1 text-[7px] font-bold px-1 py-0.2 rounded leading-none text-black ${
                            highlightTag === "CURR"
                              ? "bg-gold-500"
                              : highlightTag === "MAX"
                              ? "bg-emerald-500"
                              : "bg-rose-500"
                          }`}
                        >
                          {highlightTag}
                        </span>
                      )}
                      <span className="text-xl font-bold font-sans text-white">{d}</span>
                      <span className="text-[10px] mt-1.5 font-bold">
                        {pct.toFixed(1)}%
                      </span>
                      <span className="text-[8px] opacity-60 mt-0.5">
                        ({count}x)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Under / Over Pills wrapper */}
            <div className="bg-[#131317]/50 border border-white/[0.06] rounded-xl p-4 flex items-center justify-between shadow-inner">
              <div className="text-left font-sans">
                <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest font-sans">UNDER {referenceDigit} PROBABILITY</div>
                <div className="text-xl font-bold font-mono text-gold-500 mt-0.5">{underPct.toFixed(1)}%</div>
              </div>

              {/* [UNDER] [OVER] Badge centered */}
              <div className="flex gap-1.5 px-3 py-1 bg-[#1a1a22] rounded-full border border-white/[0.06] text-[10px] font-bold leading-5 font-sans uppercase">
                <span className="text-gold-500">UNDER</span>
                <span className="text-neutral-600">/</span>
                <span className="text-rose-500">OVER</span>
              </div>

              <div className="text-right font-sans">
                <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest font-sans">OVER {referenceDigit} PROBABILITY</div>
                <div className="text-xl font-bold font-mono text-rose-500 mt-0.5">{overPct.toFixed(1)}%</div>
              </div>
            </div>

            {/* Bubble ticks horizontal log */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                  <Clock className="h-3.5 w-3.5" /> Recent Tick Streams
                </span>
                <span className="text-[9px] text-neutral-500 font-mono select-none uppercase">Recent ➜</span>
              </div>
              <div className="bg-[#131317]/50 border border-white/[0.06] rounded-xl p-3 h-14 flex items-center gap-1.5 overflow-x-hidden justify-end">
                {last20Ticks.length === 0 && (
                  <span className="text-xs text-neutral-500 font-medium mx-auto">Receiving live feeds...</span>
                )}
                {last20Ticks.map((digit, idx) => {
                  const isUnder = digit < referenceDigit;
                  const isNewest = idx === last20Ticks.length - 1;
                  
                  return (
                    <div
                      key={idx}
                      className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 select-none border font-sans ${
                        isUnder
                          ? "bg-gold-500/10 text-gold-400 border-gold-500/30"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      } ${isNewest ? "scale-110 border-gold-500 font-black animate-pulse bg-gold-500/20" : "opacity-85"} transition-all`}
                    >
                      {digit}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* B. Right - Chart */}
          <div className="lg:col-span-5 bg-[#131317]/50 border border-white/[0.06] rounded-xl p-4 flex flex-col justify-between">
            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block font-bold font-sans mb-2">
              Digit Distribution Spectrum
            </span>
            <div className="h-[210px] relative w-full">
              <canvas ref={chartRef} id="frequencyChart" className="w-full h-full" />
            </div>
            <div className="mt-2 text-[9px] text-neutral-500 font-bold uppercase tracking-wider leading-4 flex items-center justify-between border-t border-white/[0.06] pt-2 font-sans">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-gold-500" /> Under [{referenceDigit}]
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-neutral-500" /> Barrier [{referenceDigit}]
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Over [{referenceDigit}]
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
