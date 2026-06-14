export const PORTABLE_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deriv Digit Under Bot — Portable Client</title>
  <!-- Google Fonts: Inter and JetBrains Mono -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700;800&display=swap" rel="stylesheet">
  <!-- Chart.js CDN -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          }
        }
      }
    }
  </script>

  <style>
    body {
      background-color: #0a0f1e;
      color: #e2e8f0;
      font-family: 'Inter', sans-serif;
    }
    /* Custom Scrollbar for dark theme */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: #0a0f1e;
    }
    ::-webkit-scrollbar-thumb {
      background: #1e2d45;
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #00d4ff;
    }
    /* Glow animations */
    .glow-green { box-shadow: 0 0 15px rgba(0, 230, 118, 0.15); border-color: rgba(0, 230, 118, 0.4); }
    .glow-blue { box-shadow: 0 0 15px rgba(0, 212, 255, 0.25); border-color: rgba(0, 212, 255, 0.5); }
    .glow-yellow { box-shadow: 0 0 15px rgba(255, 170, 0, 0.15); border-color: rgba(255, 170, 0, 0.3); }
    .glow-orange { box-shadow: 0 0 15px rgba(255, 152, 0, 0.15); border-color: rgba(255, 152, 0, 0.3); }

    /* Toast styles */
    #toast-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: 320px;
      width: 100%;
    }
    .toast-card {
      padding: 12px;
      border-radius: 8px;
      color: white;
      font-size: 11px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      border-left: 4px solid #fff;
      animation: slideIn 0.25s ease-out forwards;
      background-color: #111827;
    }
    @keyframes slideIn {
      from { transform: translateX(120%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  </style>
</head>
<body class="min-h-screen flex flex-col justify-between py-6 px-4 sm:px-6 lg:px-8">
  <div class="max-w-7xl w-full mx-auto flex flex-col gap-6">
    <!-- Header -->
    <header class="bg-[#111827] border border-[#1e2d45] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-[#141f33] rounded-lg border border-[#1e2d45] text-[#00d4ff]">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <h1 class="text-lg font-bold text-white tracking-wide">DIGIT UNDER BOT</h1>
          <p class="text-[10px] text-[#64748b]">Real-Time Multi-Symbol Portfolio Scanner (Portable)</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div id="header-user-info"></div>
        <div id="connection-badge" class="flex items-center gap-2 bg-[#141f33] px-3 py-1.5 rounded-lg border border-[#1e2d45] text-xs font-semibold text-[#ff4444]">
          <span class="h-2 w-2 rounded-full bg-[#ff4444] inline-block" id="conn-dot"></span>
          <span id="conn-text">OFFLINE</span>
        </div>
      </div>
    </header>

    <!-- Auth Panel Overlay -->
    <div id="auth-panel" class="max-w-md w-full mx-auto bg-[#111827] border border-[#1e2d45] rounded-2xl shadow-2xl p-6 md:p-8 mt-10 transition-all flex flex-col gap-5 hidden animate-fade-in">
      <div class="text-center">
        <h2 id="auth-title" class="text-lg font-bold text-white tracking-wide uppercase font-sans">Secure Account Access</h2>
        <p id="auth-sub" class="text-[9px] text-[#64748b] uppercase tracking-wider mt-1 text-center">Enter your API Token to start trading</p>
      </div>

      <!-- Mode Selector Tabs -->
      <div class="grid grid-cols-2 gap-2 p-1 bg-[#141f33] rounded-lg border border-[#1e2d45]">
        <button id="btn-auth-tab-login" onclick="setAuthMode(true)" class="py-1.5 px-3 rounded text-[10px] font-bold transition-all bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/25">Sign In</button>
        <button id="btn-auth-tab-signup" onclick="setAuthMode(false)" class="py-1.5 px-3 rounded text-[10px] font-bold transition-all text-[#64748b] hover:text-white">Register</button>
      </div>

      <!-- Auth Form Inputs -->
      <div id="auth-form-container" class="flex flex-col gap-3">
        <!-- Sign In Form Inputs (Token Only) -->
        <div id="auth-login-fields" class="flex flex-col gap-3">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-[9px] text-[#64748b] uppercase tracking-wider block">Deriv API Token</label>
              <a href="https://deriv.partners/rx?sidc=C6D4FA86-827B-4AAF-844B-344F9FE57A0F&utm_campaign=dynamicworks&utm_medium=affiliate&utm_source=CU334564" target="_blank" rel="noopener noreferrer" class="text-[8px] text-[#00d4ff] hover:underline uppercase tracking-wide">Get Account</a>
            </div>
            <input type="text" id="auth-token" placeholder="Paste your Deriv API token here" class="w-full bg-[#141f33] border border-[#1e2d45] rounded p-2.5 text-xs text-white font-mono">
            <p class="text-[8px] text-[#64748b] leading-normal mt-1.5">* Generate token on Deriv panel under <b>Settings &gt; API Token</b> with <b>Read</b> + <b>Trade</b> scope.</p>
          </div>
          <button id="btn-auth-submit" onclick="submitAuth()" class="w-full py-2.5 bg-gradient-to-r from-[#00d4ff] to-[#0077b6] text-white font-bold rounded-lg text-xs hover:brightness-115 active:scale-95 transition-all mt-2 uppercase tracking-wider">Secure Sign In</button>
        </div>

        <!-- Register / Affiliate Presentation Page -->
        <div id="auth-signup-fields" class="hidden flex flex-col gap-4">
          <div class="text-left bg-[#00d4ff]/[0.02] border border-[#00d4ff]/10 p-3.5 rounded-lg space-y-2.5">
            <h3 class="text-[11px] font-bold text-[#00d4ff] tracking-wide uppercase">Sponsor Trading Benefits</h3>
            <p class="text-[10px] text-neutral-300 leading-relaxed uppercase tracking-wider font-semibold">
              Register a free trading account through our sponsor link below to unlock premium configurations & priority execution benefits:
            </p>
            <ul class="space-y-1.5 text-[10px] text-[#64748b] font-medium">
              <li class="flex items-start gap-1.5">
                <span class="text-[#00d4ff]">•</span>
                <span>Complete setup under partner registration ID <b>CU334564</b></span>
              </li>
              <li class="flex items-start gap-1.5">
                <span class="text-[#00d4ff]">•</span>
                <span>Optimized trading routes with near-zero websocket latency</span>
              </li>
              <li class="flex items-start gap-1.5">
                <span class="text-[#00d4ff]">•</span>
                <span>Activate split martingale and payout-aware modes without caps</span>
              </li>
            </ul>
          </div>
          <a href="https://deriv.partners/rx?sidc=C6D4FA86-827B-4AAF-844B-344F9FE57A0F&utm_campaign=dynamicworks&utm_medium=affiliate&utm_source=CU334564" target="_blank" rel="noopener noreferrer" class="w-full py-2.5 bg-gradient-to-r from-[#00d4ff] to-[#0077b6] text-white font-black rounded-lg text-xs hover:brightness-115 active:scale-95 transition-all text-center block uppercase tracking-wider">Register on Deriv</a>
          <p class="text-[8px] text-[#64748b] uppercase tracking-wider text-center leading-normal">After registering, generate your API token, go to the <b>Sign In</b> tab, and paste it to connect.</p>
        </div>

        <div id="auth-error" class="hidden p-2.5 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] rounded leading-tight text-center mt-2"></div>
      </div>

      <div class="flex items-center gap-3">
        <div class="h-[1px] bg-[#1e2d45]/60 flex-1"></div>
        <span class="text-[8px] uppercase tracking-widest text-[#64748b] font-bold">OR</span>
        <div class="h-[1px] bg-[#1e2d45]/60 flex-1"></div>
      </div>

      <button onclick="bypassAuthMode()" class="w-full py-2 bg-white/[0.02] border border-[#1e2d45] hover:bg-white/[0.05] text-[#00d4ff] text-xs font-bold rounded-lg transition-all">TRY DEMO SANDBOX MODE</button>
    </div>

    <!-- Main Content trading elements wrapped inside container -->
    <div id="main-trading-container" class="hidden flex flex-col gap-6">
      <!-- Control -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div class="bg-[#111827] border border-[#1e2d45] rounded-xl p-5 flex flex-col justify-between gap-4 h-full">
          <div class="flex flex-col gap-3">
            <h2 class="text-[10px] font-bold text-[#64748b] tracking-wider uppercase">Engine Controller</h2>
            <div class="grid grid-cols-2 gap-1.5 bg-[#141f33] p-1.5 rounded-lg border border-[#1e2d45]">
              <button id="btn-mode-Standard" onclick="setMode('Standard')" class="text-[10px] py-1.5 rounded font-bold transition-all bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/25">Standard</button>
              <button id="btn-mode-Martingale" onclick="setMode('Martingale')" class="text-[10px] py-1.5 rounded font-semibold text-[#64748b] hover:text-white transition-all">Martingale</button>
              <button id="btn-mode-PayoutAdaptive" onclick="setMode('PayoutAdaptive')" class="text-[10px] py-1.5 rounded font-semibold text-[#64748b] hover:text-white transition-all">Payout-Aware</button>
              <button id="btn-mode-DAlembert" onclick="setMode('DAlembert')" class="text-[10px] py-1.5 rounded font-semibold text-[#64748b] hover:text-white transition-all">D'Alembert</button>
              <button id="btn-mode-GradualRecovery" onclick="setMode('GradualRecovery')" style="grid-column: span 2" class="text-[10px] py-1.5 rounded font-semibold text-[#64748b] hover:text-white transition-all">Split-Martingale</button>
            </div>

            <!-- Settings Inputs -->
            <div class="border-t border-[#1e2d45]/40 pt-3 flex flex-col gap-2">
              <div class="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <label class="text-[#64748b] block mb-1">Base Stake ($)</label>
                  <input type="number" id="input-stake" value="2.0" step="0.5" class="w-full bg-[#141f33] border border-[#1e2d45] rounded p-1.5 text-white font-mono" onchange="updateConfig()">
                </div>
                <div>
                  <label class="text-[#64748b] block mb-1">Under Barrier</label>
                  <input type="number" id="input-barrier" value="7" min="1" max="9" class="w-full bg-[#141f33] border border-[#1e2d45] rounded p-1.5 text-white font-mono" onchange="updateConfig()">
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <label class="text-[#64748b] block mb-1">Take Profit (3x Stake)</label>
                  <div id="display-tp" class="w-full bg-[#141f33]/60 border border-[#1e2d45]/60 rounded p-1.5 text-emerald-400 font-mono font-bold">+$ 6.00</div>
                </div>
                <div>
                  <label class="text-[#64748b] block mb-1">Stop Loss (Loss Streak)</label>
                  <div id="display-sl" class="w-full bg-[#141f33]/60 border border-[#1e2d45]/60 rounded p-1.5 text-rose-400 font-mono font-bold">4</div>
                </div>
              </div>
            </div>
          </div>

          <button id="btn-start" onclick="toggleBot()" class="w-full py-3 bg-gradient-to-r from-[#00d4ff] to-[#0077b6] text-white font-bold rounded-xl text-xs hover:brightness-115 active:scale-95 transition-all mt-2">START BOT</button>
          <div id="status-display" class="p-3 bg-[#141f33] rounded-lg border border-[#1e2d45] text-xs">
            <div class="font-bold text-gray-300" id="status-title">READY TO START</div>
            <div class="text-[10px] text-[#64748b] mt-0.5" id="status-sub">Waiting for user command...</div>
          </div>
        </div>

        <div class="md:col-span-2 bg-[#111827] border border-[#1e2d45] rounded-xl p-5 flex flex-col justify-between gap-3">
          <h2 class="text-[10px] font-bold text-[#64748b] tracking-wider uppercase">Select Volatility Index</h2>
          <div class="grid grid-cols-3 sm:grid-cols-4 gap-2" id="symbols-grid">
            <!-- Populated by JS -->
          </div>
        </div>
      </div>

      <!-- Live Statistics row -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-[#111827] border border-[#1e2d45] rounded-xl p-4 flex flex-col justify-between">
          <span class="text-[9px] font-bold text-[#64748b] uppercase tracking-wider">Under Digit %</span>
          <span id="stat-under-pct" class="text-3xl font-extrabold text-[#64748b] font-mono mt-2">0.0%</span>
          <span id="stat-signal-strength" class="text-[9px] font-bold text-gray-500 uppercase mt-1">SCANNING...</span>
        </div>
        <div class="bg-[#111827] border border-[#1e2d45] rounded-xl p-4 flex flex-col justify-between">
          <span class="text-[9px] font-bold text-[#64748b] uppercase tracking-wider">Confirmations</span>
          <span id="stat-conf" class="text-3xl font-extrabold text-white font-mono mt-2">0 / 2</span>
          <div class="w-full bg-[#141f33] h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div id="stat-conf-bar" class="h-full bg-[#ffaa00] w-0 transition-all"></div>
          </div>
        </div>
        <div class="bg-[#111827] border border-[#1e2d45] rounded-xl p-4 flex flex-col justify-between">
          <span class="text-[9px] font-bold text-[#64748b] uppercase tracking-wider">Running Profit / Loss</span>
          <span id="stat-pnl" class="text-3xl font-extrabold text-white font-mono mt-2">+$0.00</span>
          <span id="label-tp-sl" class="text-[9px] text-[#64748b] mt-1 font-medium select-none">Target of TP: +$20 | SL: -$10</span>
        </div>
        <div class="bg-[#111827] border border-[#1e2d45] rounded-xl p-4 flex flex-col justify-between">
          <span class="text-[9px] font-bold text-[#64748b] uppercase tracking-wider">Stakes / Daily Limits</span>
          <span id="stat-stake" class="text-3xl font-extrabold text-white font-mono mt-2">$2.00</span>
          <span id="stat-consec" class="text-[9px] text-[#64748b] mt-1 font-medium">Daily runs: 0 / 50</span>
        </div>
      </div>

      <!-- Core analytical view and leaderboard -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <!-- Leaderboard -->
        <div class="lg:col-span-4 bg-[#111827] border border-[#1e2d45] rounded-xl p-5 flex flex-col gap-4 h-full">
          <h2 class="text-[10px] font-bold text-[#64748b] tracking-wider uppercase border-b border-[#1e2d45] pb-2.5">Scanning Leaderboard</h2>
          <div class="flex flex-col gap-2 overflow-y-auto max-h-[360px] pr-1" id="leaderboard-container">
            <!-- Populated by JS -->
          </div>
        </div>

        <!-- Analysis -->
        <div class="lg:col-span-8 bg-[#111827] border border-[#1e2d45] rounded-xl p-5 flex flex-col gap-5">
          <h2 class="text-[10px] font-bold text-[#64748b] tracking-wider uppercase border-b border-[#1e2d45] pb-2.5">
            Live Analysis: <span id="inspect-title" class="text-[#00d4ff] font-mono">Select Market</span>
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div class="flex flex-col justify-between gap-4">
              <div>
                <span class="text-[9px] font-bold text-[#64748b] uppercase block mb-2 font-mono">Probability Matrix</span>
                <div id="probability-grid" class="grid grid-cols-5 gap-2 font-mono text-center">
                  <!-- 10 digits cells -->
                </div>
              </div>
              <div>
                <span class="text-[9px] font-bold text-[#64748b] uppercase block mb-1.5 font-mono">Recent Ticks Flow</span>
                <div id="ticks-bubbles-container" class="bg-[#141f33]/30 border border-[#1e2d45] rounded-lg p-2.5 flex items-center justify-end gap-1 overflow-hidden h-12">
                  <!-- Ticks circles -->
                </div>
              </div>
            </div>
            <div class="h-[180px] bg-[#141f33]/1D rounded-lg border border-[#1e2d45] p-3 flex flex-col justify-between">
              <span class="text-[9px] font-bold text-[#64748b] uppercase font-mono block">Digit Histogram Chart</span>
              <div class="flex-1 h-[140px] relative">
                <canvas id="frequencyChart" class="w-full h-full"></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Trade Logger table -->
      <div class="bg-[#111827] border border-[#1e2d45] rounded-xl p-5 flex flex-col gap-4">
        <div class="flex items-center justify-between border-b border-[#1e2d45] pb-3">
          <h2 class="text-[10px] font-bold text-[#64748b] tracking-wider uppercase">Transactions log</h2>
          <button onclick="clearHistory()" class="text-[10px] font-bold px-2.5 py-1 text-red-500 bg-red-500/5 rounded hover:bg-red-500/10 transition-colors">Clear History</button>
        </div>
        <div class="overflow-x-auto rounded-lg border border-[#1e2d45]">
          <table class="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr class="bg-[#141f33]/50 border-b border-[#1e2d45] text-[#64748b]">
                <th class="py-2.5 px-3">#</th>
                <th class="py-2.5 px-3">Time</th>
                <th class="py-2.5 px-3">Symbol</th>
                <th class="py-2.5 px-3">Mode</th>
                <th class="py-2.5 px-3">Under%</th>
                <th class="py-2.5 px-3">Stake</th>
                <th class="py-2.5 px-3">Outcome</th>
                <th class="py-2.5 px-3">Profit / Loss</th>
              </tr>
            </thead>
            <tbody id="trade-log-body">
              <!-- Populated by JS -->
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <footer class="text-center text-[10px] text-[#64748b] mt-8 pt-4 border-t border-[#1e2d45]/30">
    <p>Deriv Digit Under Bot Client. For educational and automation assessment purposes of Deriv APIs.</p>
  </footer>

  <!-- Structural JS Logic Engine -->
  <script>
    const SYMBOLS = [
      { s: "R_10", n: "Volatility 10" },
      { s: "R_25", n: "Volatility 25" },
      { s: "R_50", n: "Volatility 50" },
      { s: "R_75", n: "Volatility 75" },
      { s: "R_100", n: "Volatility 100" },
      { s: "1HZ10V", n: "Volatility 10 (1s)" },
      { s: "1HZ15V", n: "Volatility 15 (1s)" },
      { s: "1HZ25V", n: "Volatility 25 (1s)" },
      { s: "1HZ30V", n: "Volatility 30 (1s)" },
      { s: "1HZ50V", n: "Vol 50 (s1)" },
      { s: "1HZ75V", n: "Volatility 75 (1s)" },
      { s: "1HZ90V", n: "Volatility 90 (1s)" },
      { s: "1HZ100V", n: "Volatility 100 (1s)" }
    ];

    let config = {
      stakeAmount: 2.0,
      referenceDigit: 7,
      analysisTickCount: 120,
      minUnderPercentage: 65,
      confirmationRequired: 2,
      stopLoss: 4.0,
      takeProfit: 6.0,
      maxDailyTrades: 50,
      selectedSymbol: "1HZ100V",
      mode: "Standard"
    };

    let accumulatedLoss = 0;

    let botState = "STATE_IDLE";
    let activeSymbol = null;
    let inspectSymbol = "1HZ100V";
    let ws = null;

    let sessionProfit = 0;
    let dailyCount = 0;
    let consecutiveLosses = 0;
    let multiplier = 1;
    let sequenceDone = 0;
    let awaitingSettlement = false;
    let inRecovery = false;

    let symbolState = {};
    let logs = [];
    let chartInstance = null;

    // Initialize States
    SYMBOLS.forEach(({ s, n }) => {
      symbolState[s] = {
        symbol: s,
        name: n,
        buffer: [],
        underPct: 0,
        confirmationCounter: 0,
        tickCount: 0,
        digitPct: Array(10).fill(0)
      };
    });

    // Populate Selector matrix
    function buildSymbolsGrid() {
      const g = document.getElementById("symbols-grid");
      g.innerHTML = "";
      SYMBOLS.forEach(({ s, n }) => {
        const btn = document.createElement("button");
        btn.id = "btn-sym-" + s;
        btn.onclick = () => selectInspectSymbol(s);
        btn.className = "p-2 rounded bg-[#141f33]/30 border border-[#1e2d45] text-left hover:bg-[#141f33]/60 transition-all font-mono text-[10px]";
        btn.innerHTML = \`<div class="text-[#64748b] leading-none uppercase">\${s}</div><div class="text-white font-bold leading-none mt-1 truncate">\${n}</div>\`;
        g.appendChild(btn);
      });
    }

    function selectInspectSymbol(sym) {
      inspectSymbol = sym;
      document.getElementById("inspect-title").innerText = sym;
      updateInspectionPanel();
      highlightActiveInspect();
    }

    function highlightActiveInspect() {
      SYMBOLS.forEach(({ s }) => {
        const btn = document.getElementById("btn-sym-" + s);
        if (btn) {
          if (inspectSymbol === s) {
            btn.className = "p-2 rounded bg-[#141f33] border border-[#00d4ff] text-left hover:bg-[#141f33]/60 transition-all font-mono text-[10px]";
          } else if (activeSymbol === s) {
            btn.className = "p-2 rounded bg-[#141f33]/40 border border-[#00e676] text-left hover:bg-[#141f33]/60 transition-all font-mono text-[10px]";
          } else {
            btn.className = "p-2 rounded bg-[#141f33]/25 border border-[#1e2d45] text-left hover:bg-[#141f33]/60 transition-all font-mono text-[10px]";
          }
        }
      });
    }

    function setMode(mode) {
      if (botState !== "STATE_IDLE" && botState !== "STATE_STOPPED") return;
      config.mode = mode;
      const modes = ["Standard", "Martingale", "PayoutAdaptive", "DAlembert", "GradualRecovery"];
      modes.forEach(m => {
        const btn = document.getElementById("btn-mode-" + m);
        if (btn) {
          if (m === mode) {
            btn.className = "text-[10px] py-1.5 rounded font-bold transition-all bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/25";
          } else {
            btn.className = "text-[10px] py-1.5 rounded font-semibold text-[#64748b] hover:text-white transition-all";
          }
        }
      });
    }

    function updateConfig() {
      config.stakeAmount = Number(document.getElementById("input-stake").value) || 2.0;
      config.referenceDigit = parseInt(document.getElementById("input-barrier").value) || 7;
      
      // Compute thresholds dynamically exactly matching server-bot and React settings panel
      config.takeProfit = Number((config.stakeAmount * 3).toFixed(2));
      config.stopLoss = 4.0;

      document.getElementById("display-tp").innerText = "+$ " + config.takeProfit.toFixed(2);
      document.getElementById("display-sl").innerText = config.stopLoss;

      updateMetricCounters();
      updateChartColors();
      if (chartInstance) {
        chartInstance.update();
      }
    }

    function updateChartColors() {
      if (!chartInstance) return;
      const ref = config.referenceDigit;
      chartInstance.data.datasets[0].backgroundColor = Array.from({ length: 10 }, (_, i) => i < ref ? "rgba(0, 212, 255, 0.4)" : "rgba(255, 68, 68, 0.4)");
      chartInstance.data.datasets[0].borderColor = Array.from({ length: 10 }, (_, i) => i === ref ? "#ffaa00" : i < ref ? "#00d4ff" : "#ff4444");
      chartInstance.data.datasets[0].borderWidth = Array.from({ length: 10 }, (_, i) => i === ref ? 2.5 : 1.2);
    }

    function toggleBot() {
      const btn = document.getElementById("btn-start");
      if (botState === "STATE_IDLE" || botState === "STATE_STOPPED") {
        btn.innerText = "STOP BOT";
        btn.className = "w-full py-3 bg-gradient-to-r from-[#e63946] to-[#b70918] text-white font-bold rounded-xl text-xs hover:brightness-115 active:scale-95 transition-all mt-2";
        startBot();
      } else {
        btn.innerText = "START BOT";
        btn.className = "w-full py-3 bg-gradient-to-r from-[#00d4ff] to-[#0077b6] text-white font-bold rounded-xl text-xs hover:brightness-115 active:scale-95 transition-all mt-2";
        stopBot("Deactivated manually");
      }
    }

    function connectWebSocket() {
      if (ws) {
        try { ws.close(); } catch(e){}
        ws = null;
      }

      const b = document.getElementById("connection-badge");
      b.className = "flex items-center gap-2 bg-[#141f33] px-3 py-1.5 rounded-lg border border-[#1e2d45] text-xs font-semibold text-[#ffaa00] animate-pulse";
      document.getElementById("conn-dot").className = "h-2 w-2 rounded-full bg-[#ffaa00] inline-block";
      document.getElementById("conn-text").innerText = "CONNECTING...";

      ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=1089");
      
      ws.onopen = () => {
        const b = document.getElementById("connection-badge");
        b.className = "flex items-center gap-2 bg-[#141f33] px-3 py-1.5 rounded-lg border border-[#1e2d45] text-xs font-semibold text-[#00e676]";
        document.getElementById("conn-dot").className = "h-2 w-2 rounded-full bg-[#00e676] inline-block";
        document.getElementById("conn-text").innerText = "CONNECTED";

        if (botState === "STATE_CONNECTING") {
          botState = "STATE_WARMING_UP";
          updateStatusBadge();
        }

        // Subscribe using ticks_history to prewarm 120 ticks instantly
        SYMBOLS.forEach(({ s }) => {
          ws.send(JSON.stringify({
            ticks_history: s,
            adjust_start_time: 1,
            count: config.analysisTickCount,
            end: "latest",
            style: "ticks",
            subscribe: 1
          }));
        });
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.msg_type === "history" && data.history) {
          handleHistory(data);
        } else if (data.msg_type === "tick" && data.tick) {
          handleTick(data.tick);
        }
      };

      ws.onclose = () => {
        const b = document.getElementById("connection-badge");
        b.className = "flex items-center gap-2 bg-[#141f33] px-3 py-1.5 rounded-lg border border-[#1e2d45] text-xs font-semibold text-[#ff4444]";
        document.getElementById("conn-dot").className = "h-2 w-2 rounded-full bg-[#ff4444] inline-block";
        document.getElementById("conn-text").innerText = "OFFLINE";
        
        setTimeout(connectWebSocket, 5000); // Always auto-reconnect background scanner
      };
    }

    function startBot() {
      sessionProfit = 0;
      dailyCount = 0;
      consecutiveLosses = 0;
      accumulatedLoss = 0;
      multiplier = 1;
      sequenceDone = 0;
      awaitingSettlement = false;
      inRecovery = false;

      // Check if we already have warmed symbols ready to execute
      const readyCount = SYMBOLS.map(({ s }) => symbolState[s]).filter(t => t.buffer.length >= config.analysisTickCount).length;
      if (readyCount >= 5) {
        botState = "STATE_SCANNING";
        updateStatusBadge();
        evalSymbolSwitch();
      } else {
        botState = "STATE_WARMING_UP";
        updateStatusBadge();
      }

      // Ensure WS is connected
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        connectWebSocket();
      }
    }

    function handleHistory(data) {
      const sym = data.echo_req?.ticks_history;
      if (!sym) return;
      const sObj = symbolState[sym];
      if (!sObj) return;

      const prices = data.history?.prices;
      if (!prices || !Array.isArray(prices)) return;

      const digitsBuf = [];
      prices.forEach(price => {
        const priceStr = String(price);
        const lastDigit = parseInt(priceStr.charAt(priceStr.length - 1));
        if (!isNaN(lastDigit)) {
          digitsBuf.push(lastDigit);
        }
      });

      const cap = config.analysisTickCount;
      sObj.buffer = digitsBuf.slice(-cap);
      sObj.tickCount = sObj.buffer.length;

      // Calculate stats
      const underCount = sObj.buffer.filter(d => d < config.referenceDigit).length;
      sObj.underPct = sObj.buffer.length > 0 ? Number(((underCount / sObj.buffer.length) * 100).toFixed(1)) : 0;

      // Frequencies
      const freqs = Array(10).fill(0);
      sObj.buffer.forEach(d => freqs[d] += 1);
      sObj.digitPct = freqs.map(f => sObj.buffer.length > 0 ? Number(((f / sObj.buffer.length) * 100).toFixed(1)) : 0);

      // Check if warmup is done
      if (botState === "STATE_WARMING_UP") {
        const readyCount = SYMBOLS.map(({ s }) => symbolState[s]).filter(t => t.buffer.length >= config.analysisTickCount).length;
        if (readyCount >= 5) {
          botState = "STATE_SCANNING";
          updateStatusBadge();
        }
      }

      if (sym === inspectSymbol) {
        updateInspectionPanel();
      }
      updateLeaderboard();
      updateMetricCounters();
    }

    function handleTick(tick) {
      const sym = tick.symbol;
      const sObj = symbolState[sym];
      if (!sObj) return;

      const quoteStr = String(tick.quote);
      const digit = parseInt(quoteStr.charAt(quoteStr.length - 1));
      if (isNaN(digit)) return;

      sObj.buffer.push(digit);
      if (sObj.buffer.length > config.analysisTickCount) {
        sObj.buffer.shift();
      }

      sObj.tickCount += 1;

      // Stats
      const cap = sObj.buffer.length;
      const underCount = sObj.buffer.filter(d => d < config.referenceDigit).length;
      sObj.underPct = Number(((underCount / cap) * 100).toFixed(1));

      // Frequencies
      const freqs = Array(10).fill(0);
      sObj.buffer.forEach(d => freqs[d] += 1);
      sObj.digitPct = freqs.map(f => Number(((f / cap) * 100).toFixed(1)));

      // Process trade cycles!
      processBotTrading(sym, digit);

      // Throttled UI Render
      if (sym === inspectSymbol) {
        updateInspectionPanel();
      }
      updateLeaderboard();
      updateMetricCounters();
    }

    function updateInspectionPanel() {
      const sObj = symbolState[inspectSymbol];
      if (!sObj) return;

      // Update grid values
      const grid = document.getElementById("probability-grid");
      grid.innerHTML = "";
      
      let maxVal = -1, minVal = 101, maxD = -1, minD = -1;
      for (let d = 0; d < 10; d++) {
        const pct = sObj.digitPct[d] || 0;
        if (pct > maxVal) { maxVal = pct; maxD = d; }
        if (pct < minVal) { minVal = pct; minD = d; }
      }

      for (let d = 0; d < 10; d++) {
        const pct = sObj.digitPct[d] || 0;
        const cell = document.createElement("div");
        let border = "border-[#1e2d45] bg-[#141f33]/30";
        if (pct > 0) {
          if (d === maxD) border = "border-[#00e676] bg-[#00e676]/5";
          else if (d === minD) border = "border-[#ff4444] bg-[#ff4444]/5";
        }
        cell.className = \`p-2.5 rounded-lg border \${border}\`;
        cell.innerHTML = \`<div class="text-sm font-bold text-white font-sans">\${d}</div><div class="text-[9.5px] text-[#64748b] font-bold mt-1 font-mono">\${pct}%</div>\`;
        grid.appendChild(cell);
      }

      // Update Bubble log
      const circles = document.getElementById("ticks-bubbles-container");
      circles.innerHTML = "";
      const last20 = sObj.buffer.slice(-15);
      if (last20.length === 0) {
        circles.innerHTML = "<span class='text-[10px] text-[#64748b] mx-auto'>Gathering ticks...</span>";
      }
      last20.forEach(d => {
        const isUnder = d < config.referenceDigit;
        const el = document.createElement("div");
        el.className = \`h-7 w-7 rounded-full flex items-center justify-center font-bold text-[10px] select-none shrink-0 border \${
          isUnder ? "bg-[#00d4ff]/10 text-[#00d4ff] border-[#00d4ff]/30" : "bg-[#ff4444]/10 text-[#ff4444] border-[#ff4444]/30"
        }\`;
        el.innerText = d;
        circles.appendChild(el);
      });

      // Update Chart Canvas
      if (chartInstance) {
        chartInstance.data.datasets[0].data = sObj.digitPct;
        chartInstance.update("none");
      }
    }

    function updateLeaderboard() {
      const container = document.getElementById("leaderboard-container");
      container.innerHTML = "";

      const ranked = SYMBOLS.map(({ s }) => symbolState[s]).sort((a,b) => b.underPct - a.underPct);

      ranked.forEach((item) => {
        const isWarmed = item.buffer.length >= config.analysisTickCount;
        const isBest = ranked.filter(r => r.buffer.length >= config.analysisTickCount).sort((a,b) => b.underPct - a.underPct)[0]?.symbol === item.symbol;
        const isActive = activeSymbol === item.symbol;

        const card = document.createElement("div");
        card.onclick = () => selectInspectSymbol(item.symbol);
        
        let border = "border-[#1e2d45]";
        if (isActive) border = "border-[#00d4ff] shadow-[0_0_10px_rgba(0,212,255,0.15)] bg-[#141f33]/60";
        else if (isWarmed) {
          if (item.underPct >= 80) border = "border-[#00e676]/40";
          else if (item.underPct >= 70) border = "border-[#ffaa00]/30";
        }

        card.className = \`relative p-3 rounded-lg border cursor-pointer hover:bg-[#141f33]/40 transition-colors flex flex-col justify-between h-[90px] \${border}\`;
        
        let subText = "";
        if (!isWarmed) {
          const pct = Math.round((item.buffer.length / config.analysisTickCount) * 100);
          subText = \`<div class="w-full bg-[#111827] h-1 rounded-full mt-2 overflow-hidden border border-[#1e2d45]">
                      <div class="bg-[#00d4ff] h-full" style="width: \${pct}%"></div>
                     </div>
                     <span class="text-[8.5px] text-[#64748b] leading-none mt-1">Collecting: \${item.buffer.length}/\${config.analysisTickCount}</span>\`;
        } else {
          subText = \`<div class="flex justify-between items-center text-[10px]"><span class="text-[#64748b]">Under \${config.referenceDigit}:</span><span class="font-bold text-white font-mono">\${item.underPct}%</span></div>\`;
        }

        card.innerHTML = \`<div class="flex items-start justify-between min-w-0">
                            <div>
                              <div class="text-[10px] font-bold text-white truncate max-w-[120px]">\${item.name}</div>
                              <span class="text-[8px] font-mono tracking-wider font-semibold text-[#64748b] uppercase mt-0.5 inline-block">\${item.symbol}</span>
                            </div>
                            <div class="flex flex-col gap-0.5 h-4 items-end shrink-0">
                              \${isActive ? '<span class="text-[7.5px] font-black shrink-0 px-1 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded">ACTIVE</span>' : ''}
                              \${isBest && isWarmed ? '<span class="text-[7.5px] font-black shrink-0 px-1 bg-[#ffaa00]/10 border border-[#ffaa00]/30 text-[#ffaa00] rounded">BEST</span>' : ''}
                            </div>
                           </div>
                           \${subText}\`;
        container.appendChild(card);
      });

      highlightActiveInspect();
    }

    function processBotTrading(sym, digit) {
      // Warmup check
      if (botState === "STATE_WARMING_UP") {
        const activeCount = SYMBOLS.map(({ s }) => symbolState[s]).filter(t => t.buffer.length >= config.analysisTickCount).length;
        if (activeCount >= 5) {
          botState = "STATE_SCANNING";
          updateStatusBadge();
        }
        return;
      }

      if (botState === "STATE_IDLE" || botState === "STATE_STOPPED") return;

      // Virtual contract settlement check
      if (awaitingSettlement && activeSymbol === sym) {
        settleVirtualContract(digit);
        return;
      }

      // Evaluation and Switches
      if (botState === "STATE_SCANNING" || botState === "STATE_CONFIRMING") {
        evalSymbolSwitch();
      }

      // Confirmation ticks tracker
      if (activeSymbol === sym && botState === "STATE_CONFIRMING") {
        const sObj = symbolState[sym];
        if (sObj.underPct >= config.minUnderPercentage) {
          if (digit >= config.referenceDigit) {
            sObj.confirmationCounter += 1;
            if (sObj.confirmationCounter >= config.confirmationRequired) {
              sObj.confirmationCounter = 0;
              botState = "STATE_TRADING";
              sequenceDone = 0;
              updateStatusBadge();
              placeTrade();
            }
          } else {
            sObj.confirmationCounter = 0;
          }
        } else {
          sObj.confirmationCounter = 0;
          evalSymbolSwitch();
        }
      }
    }

    function evalSymbolSwitch() {
      if (botState === "STATE_TRADING" || awaitingSettlement || inRecovery || consecutiveLosses > 0) return;

      const ranked = SYMBOLS.map(({ s }) => symbolState[s])
        .filter(r => r.buffer.length >= config.analysisTickCount && r.underPct >= config.minUnderPercentage)
        .sort((a,b) => b.underPct - a.underPct);

      if (ranked.length === 0) {
        activeSymbol = null;
        botState = "STATE_SCANNING";
        updateStatusBadge();
        return;
      }

      const best = ranked[0].symbol;
      if (best !== activeSymbol) {
        if (activeSymbol && symbolState[activeSymbol]) {
          symbolState[activeSymbol].confirmationCounter = 0;
        }
        activeSymbol = best;
        botState = "STATE_CONFIRMING";
        updateStatusBadge();
      }
    }

    function getPayoutFactor() {
      const barrier = config.referenceDigit;
      const payoutFactor = barrier === 7 ? 0.34 : (0.95 / (barrier / 10)) - 1;
      return Number(Math.max(0.05, payoutFactor).toFixed(2));
    }

    function placeTrade() {
      if (botState === "STATE_STOPPED") return;
      awaitingSettlement = true;
      const currentStake = Number((config.stakeAmount * multiplier).toFixed(2));
      
      const statusText = document.getElementById("status-sub");
      statusText.innerText = \`Executing order #\${sequenceDone + 1} on \${activeSymbol} ($ \${currentStake})...\`;
    }

    function settleVirtualContract(digit) {
      awaitingSettlement = false;
      const currentStake = Number((config.stakeAmount * multiplier).toFixed(2));
      const sObj = symbolState[activeSymbol];

      const pFactor = getPayoutFactor();
      const isWin = digit < config.referenceDigit;
      const profit = isWin ? Number((currentStake * pFactor).toFixed(2)) : -currentStake;

      sessionProfit = Number((sessionProfit + profit).toFixed(2));
      dailyCount += 1;

      // Log trade
      const nextId = logs.length > 0 ? logs[0].id + 1 : 1;
      const newLog = {
        id: nextId,
        timestamp: new Date().toISOString(),
        symbol: activeSymbol,
        mode: config.mode,
        under_pct: sObj.underPct,
        stake: currentStake,
        outcome: isWin ? "WIN" : "LOSS",
        profit: profit
      };
      
      logs.unshift(newLog);
      updateLogsTable();
      saveLogs();

      if (isWin) {
        let msg = \`WIN EXECUTION! Payout: +\$\${profit.toFixed(2)}. (Trade #\${sequenceDone + 1})\`;
        if (config.mode === "DAlembert") {
          consecutiveLosses = Math.max(0, consecutiveLosses - 1);
          accumulatedLoss = Math.max(0, accumulatedLoss - profit);
          if (consecutiveLosses === 0) {
            accumulatedLoss = 0;
            multiplier = 1;
            inRecovery = false;
            msg = \`WIN EXECUTION! +\$\${profit.toFixed(2)}. D'Alembert fully recovered, back to base stake.\`;
          } else {
            multiplier = consecutiveLosses + 1;
            inRecovery = true;
            msg = \`WIN EXECUTION! +\$\${profit.toFixed(2)}. D'Alembert step decreased to \${consecutiveLosses}.\`;
          }
        } else if (config.mode === "GradualRecovery") {
          consecutiveLosses = 0;
          accumulatedLoss = Math.max(0, accumulatedLoss - profit);
          if (accumulatedLoss <= 0.01) {
            accumulatedLoss = 0;
            multiplier = 1;
            inRecovery = false;
            msg = \`WIN EXECUTION! +\$\${profit.toFixed(2)}. Gradual Recovery target achieved!\`;
          } else {
            inRecovery = true;
            const nextSmartStake = ((accumulatedLoss + config.stakeAmount) / pFactor);
            multiplier = Number((nextSmartStake / config.stakeAmount).toFixed(2));
            msg = \`WIN EXECUTION! +\$\${profit.toFixed(2)}. Recovering remaining -\$\${accumulatedLoss.toFixed(2)} next.\`;
          }
        } else {
          // Standard / Martingale / PayoutAdaptive
          consecutiveLosses = 0;
          accumulatedLoss = 0;
          multiplier = 1;
          inRecovery = false;
        }
        showCustomToast(msg, "green");
      } else {
        consecutiveLosses += 1;
        accumulatedLoss += Math.abs(profit);

        let recoveryMsg = "";
        if (config.mode === "Martingale") {
          multiplier = multiplier * 2;
          inRecovery = true;
          recoveryMsg = \` Doubling stake to \$\${(config.stakeAmount * multiplier).toFixed(2)}.\`;
        } else if (config.mode === "PayoutAdaptive") {
          inRecovery = true;
          const nextSmartStake = ((accumulatedLoss + config.stakeAmount) / pFactor);
          multiplier = Number((nextSmartStake / config.stakeAmount).toFixed(2));
          recoveryMsg = \` Stake scaled to \$\${nextSmartStake.toFixed(2)} to recover -\$\${accumulatedLoss.toFixed(2)}.\`;
        } else if (config.mode === "DAlembert") {
          inRecovery = true;
          multiplier = consecutiveLosses + 1;
          recoveryMsg = \` D'Alembert scaling active. Next stake: \$\${(config.stakeAmount * multiplier).toFixed(2)}.\`;
        } else if (config.mode === "GradualRecovery") {
          inRecovery = true;
          const targetRecovery = accumulatedLoss / 2;
          const nextGradualStake = ((targetRecovery + config.stakeAmount) / pFactor);
          multiplier = Number((nextGradualStake / config.stakeAmount).toFixed(2));
          recoveryMsg = \` Split-Martingale: Targeting 50% recovery of -\$\${accumulatedLoss.toFixed(2)}. Stake: \$\${nextGradualStake.toFixed(2)}.\`;
        } else {
          multiplier = 1;
          inRecovery = false;
        }

        if (consecutiveLosses >= 8) {
          stopBot("Risk cap clamp: 8 consecutive loss streaks.");
          return;
        }

        showCustomToast(\`LOSS RECORDED! Loss: -\$\${Math.abs(profit).toFixed(2)}.\${recoveryMsg}\`, "red");
      }

      const limitsTriggered = checkSessionLimits();
      if (!limitsTriggered) {
        if (inRecovery || consecutiveLosses > 0) {
          botState = "STATE_CONFIRMING";
          if (activeSymbol && symbolState[activeSymbol]) {
            symbolState[activeSymbol].confirmationCounter = 0;
          }
          updateStatusBadge();
          showCustomToast(\`Recovery series active (Trade #\${sequenceDone + 1}). Locked on \${activeSymbol}. Waiting for confirmation criteria...\`, "blue");
        } else {
          sequenceDone = 0;
          if (activeSymbol && symbolState[activeSymbol]) {
            symbolState[activeSymbol].confirmationCounter = 0;
          }
          botState = "STATE_SCANNING";
          activeSymbol = null; // Clear so we search and reload for an even better pair!
          updateStatusBadge();
          showCustomToast("Trade complete. Searching and reloading for better pair...", "green");
          evalSymbolSwitch();
        }
      }
    }

    function checkSessionLimits() {
      if (sessionProfit <= -config.stopLoss) {
        stopBot(\`Stop Loss clamped: -\$ \${Math.abs(sessionProfit).toFixed(2)}\`);
        return true;
      }
      if (sessionProfit >= config.takeProfit) {
        stopBot(\`Take Profit achieved: +\$ \${sessionProfit.toFixed(2)}\`);
        return true;
      }
      return false;
    }

    function stopBot(reason) {
      botState = "STATE_STOPPED";
      updateStatusBadge();
      
      if (reason) {
        document.getElementById("status-sub").innerHTML = \`<span class="text-red-400 font-bold">\${reason}</span>\`;
      }

      // DO NOT DISCONNECT WEBSOCKET! This lets the scanner remain active in the background as requested!

      document.getElementById("btn-start").innerText = "START BOT";
      document.getElementById("btn-start").className = "w-full py-3.5 bg-gradient-to-r from-[#00d4ff] to-[#0077b6] text-white font-bold rounded-xl text-sm hover:brightness-115 active:scale-95 transition-all";
    }

    function updateMetricCounters() {
      document.getElementById("stat-under-pct").innerText = symbolState[inspectSymbol]?.underPct ? symbolState[inspectSymbol].underPct + "%" : "0.0%";
      document.getElementById("stat-signal-strength").innerText = symbolState[inspectSymbol]?.underPct ? symbolState[inspectSymbol].underPct >= config.minUnderPercentage ? "SIGNAL MET" : "SCANNING..." : "SCANNING...";

      const sObj = symbolState[activeSymbol];
      document.getElementById("stat-conf").innerText = sObj ? \`\${sObj.confirmationCounter} / \${config.confirmationRequired}\` : \`0 / \${config.confirmationRequired}\`;
      const fill = sObj ? (sObj.confirmationCounter / config.confirmationRequired) * 100 : 0;
      document.getElementById("stat-conf-bar").style.width = fill + "%";

      document.getElementById("stat-pnl").innerText = (sessionProfit >= 0 ? "+$" : "-$") + Math.abs(sessionProfit).toFixed(2);
      document.getElementById("stat-pnl").className = \`text-3xl font-extrabold font-mono mt-2 \${sessionProfit > 0 ? "text-[#00e676]" : sessionProfit < 0 ? "text-[#ff4444]" : "text-white"}\`;

      document.getElementById("label-tp-sl").innerText = \`Target of TP: +\$\${config.takeProfit.toFixed(1)} | SL: \${config.stopLoss} Losses\`;

      const csVal = Number((config.stakeAmount * multiplier).toFixed(2));
      document.getElementById("stat-stake").innerText = "$" + csVal.toFixed(2);
      document.getElementById("stat-consec").innerText = \`Daily runs: \${dailyCount} / \u221E\`;
    }

    function updateStatusBadge() {
      const title = document.getElementById("status-title");
      const sub = document.getElementById("status-sub");
      
      title.innerText = botState.replace("STATE_", "");
      switch (botState) {
        case "STATE_IDLE":
          sub.innerText = "Waiting for user command...";
          break;
        case "STATE_CONNECTING":
          sub.innerText = "Connecting to secure broker sockets...";
          break;
        case "STATE_WARMING_UP":
          sub.innerText = "Warming ticks buffers for 13 symbols. Hold on...";
          break;
        case "STATE_SCANNING":
          sub.innerText = "Scanning 13 indexes. Selecting best score...";
          break;
        case "STATE_CONFIRMING":
          sub.innerText = \`Signal confirmed on \${activeSymbol}. Waiting for confirmation digits...\`;
          break;
        case "STATE_TRADING":
          sub.innerText = \`Executing order #\${sequenceDone + 1} on \${activeSymbol}...\`;
          break;
        case "STATE_RECOVERY":
          sub.innerText = \`Martingale Recovery active on \${activeSymbol} ($ \${(config.stakeAmount*multiplier).toFixed(2)})...\`;
          break;
        case "STATE_STOPPED":
          // Remains handled by stopBot call
          break;
      }
    }

    function updateLogsTable() {
      const body = document.getElementById("trade-log-body");
      body.innerHTML = "";
      const last50 = logs.slice(0, 50);
      last50.forEach(l => {
        const isWin = l.outcome === "WIN";
        const row = document.createElement("tr");
        row.className = isWin ? "bg-[#00e676]/3 border-b border-[#1e2d45]/40" : "bg-[#ff4444]/3 border-b border-[#1e2d45]/40";
        row.innerHTML = \`<td class="py-2 px-3 font-bold text-white">\${l.id}</td>
                          <td class="py-2 px-3 text-[#64748b]">\${new Date(l.timestamp).toLocaleTimeString()}</td>
                          <td class="py-2 px-3 text-white font-bold">\${l.symbol}</td>
                          <td class="py-2 px-3 text-[#e2e8f0]">\${l.mode}</td>
                          <td class="py-2 px-3 text-white">\${l.under_pct}%</td>
                          <td class="py-2 px-3 font-semibold text-white font-mono">$ \${l.stake.toFixed(2)}</td>
                          <td class="py-2 px-3"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold \${isWin ? "bg-[#00e676]/10 text-[#00e676]" : "bg-[#ff4444]/15 text-[#ff4444]"}">\${l.outcome}</span></td>
                          <td class="py-2 px-3 text-right \${isWin ? "text-[#00e676]" : "text-[#ff4444]"} font-bold">$ \${l.profit.toFixed(2)}</td>\`;
        body.appendChild(row);
      });
    }

    function clearHistory() {
      if (confirm("Clear historical transactions?")) {
        logs = [];
        updateLogsTable();
        localStorage.removeItem("portable_bot_logs");
      }
    }

    function saveLogs() {
      localStorage.setItem("portable_bot_logs", JSON.stringify(logs));
    }

    let authIsLogin = true;
    
    function setAuthMode(isLogin) {
      authIsLogin = isLogin;
      document.getElementById("auth-error").classList.add("hidden");
      if (isLogin) {
        document.getElementById("auth-title").innerText = "Secure Account Access";
        document.getElementById("auth-sub").innerText = "Enter your API Token to start trading";
        document.getElementById("auth-login-fields").classList.remove("hidden");
        document.getElementById("auth-signup-fields").classList.add("hidden");
        document.getElementById("btn-auth-tab-login").className = "py-1.5 px-3 rounded text-[10px] font-bold transition-all bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/25";
        document.getElementById("btn-auth-tab-signup").className = "py-1.5 px-3 rounded text-[10px] font-bold transition-all text-[#64748b] hover:text-white";
      } else {
        document.getElementById("auth-title").innerText = "Create Deriv Account";
        document.getElementById("auth-sub").innerText = "Sign up under our official partner program";
        document.getElementById("auth-login-fields").classList.add("hidden");
        document.getElementById("auth-signup-fields").classList.remove("hidden");
        document.getElementById("btn-auth-tab-signup").className = "py-1.5 px-3 rounded text-[10px] font-bold transition-all bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/25";
        document.getElementById("btn-auth-tab-login").className = "py-1.5 px-3 rounded text-[10px] font-bold transition-all text-[#64748b] hover:text-white";
      }
    }

    function submitAuth() {
      const token = document.getElementById("auth-token").value.trim();
      const err = document.getElementById("auth-error");
      
      if (!token) {
        err.innerText = "Please specify your Deriv API Token.";
        err.classList.remove("hidden");
        return;
      }

      err.classList.add("hidden");
      document.getElementById("btn-auth-submit").innerText = "AUTHORIZING...";
      
      const url = "wss://ws.binaryws.com/websockets/v3?app_id=" + (config.appId || 1089);
      const tempWs = new WebSocket(url);
      let resolved = false;

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { tempWs.close(); } catch(e){}
          document.getElementById("btn-auth-submit").innerText = "Secure Sign In";
          err.innerText = "Connection timed out. Check your internet connection.";
          err.classList.remove("hidden");
        }
      }, 8000);

      tempWs.onopen = () => {
        tempWs.send(JSON.stringify({ authorize: token }));
      };

      tempWs.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.msg_type === "authorize") {
            resolved = true;
            clearTimeout(timeoutId);
            try { tempWs.close(); } catch(e){}
            
            document.getElementById("btn-auth-submit").innerText = "Secure Sign In";
            
            if (parsed.error) {
              err.innerText = parsed.error.message || "Invalid API token.";
              err.classList.remove("hidden");
            } else {
              const email = parsed.authorize.email;
              
              // Persist locally
              let store = JSON.parse(localStorage.getItem("portable_user_store") || "{}");
              store[email] = { derivToken: token };
              localStorage.setItem("portable_user_store", JSON.stringify(store));
              localStorage.setItem("portable_session_user", email);
              
              config.apiToken = token;
              config.demoMode = false;
              
              bootstrapTradingScreen(email);
            }
          }
        } catch (e) {
          // Ignore
        }
      };

      tempWs.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          try { tempWs.close(); } catch(e){}
          document.getElementById("btn-auth-submit").innerText = "Secure Sign In";
          err.innerText = "Authorization communication failed. Could not open Deriv Gateway.";
          err.classList.remove("hidden");
        }
      };
    }

    function bypassAuthMode() {
      bootstrapTradingScreen(null);
    }

    function bootstrapTradingScreen(email) {
      document.getElementById("auth-panel").classList.add("hidden");
      document.getElementById("main-trading-container").classList.remove("hidden");
      
      if (email) {
        document.getElementById("header-user-info").innerHTML = \`
          <div style="display:flex; align-items:center; gap:8px; background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.15); padding:4px 8px; border-radius:6px; font-size:11px;">
            <span style="color:#94a3b8;">Logged in: <span style="font-weight:bold; color:#ff4444; font-family:monospace;">\${email}</span></span>
            <button onclick="logoutPortable()" style="padding:2px 6px; border-radius:4px; background:rgba(239,68,68,0.15); border:none; color:#ff4444; font-size:9px; font-weight:bold; cursor:pointer;" onmouseover="this.style.background='#ef4444'; this.style.color='#fff'" onmouseout="this.style.background='rgba(239,68,68,0.15)'; this.style.color='#ff4444'">Logout</button>
          </div>
        \`;
      } else {
        document.getElementById("header-user-info").innerHTML = \`
          <div style="display:flex; align-items:center; gap:8px; background:rgba(251,191,36,0.05); border:1px solid rgba(251,191,36,0.15); padding:4px 8px; border-radius:6px; font-size:11px;">
            <span style="color:#fbbf24;">Guest Sandbox Mode</span>
            <button onclick="location.reload()" style="padding:2px 6px; border-radius:4px; background:rgba(251,191,36,0.15); border:none; color:#fbbf24; font-size:9px; font-weight:bold; cursor:pointer;">Login</button>
          </div>
        \`;
      }
      connectWebSocket();
    }

    function logoutPortable() {
      localStorage.removeItem("portable_session_user");
      location.reload();
    }

    // Initialize Chart Canvas
    window.addEventListener("DOMContentLoaded", () => {
      buildSymbolsGrid();
      selectInspectSymbol("1HZ100V");

      // Load cached logs
      try {
        const saved = localStorage.getItem("portable_bot_logs");
        if (saved) {
          logs = JSON.parse(saved);
          updateLogsTable();
        }
      } catch(e){}

      // Check session
      const sess = localStorage.getItem("portable_session_user");
      if (sess) {
        let store = JSON.parse(localStorage.getItem("portable_user_store") || "{}");
        const user = store[sess];
        if (user && user.derivToken) {
          config.apiToken = user.derivToken;
          config.demoMode = false;
        }
        bootstrapTradingScreen(sess);
      } else {
        // Show auth portal
        document.getElementById("auth-panel").classList.remove("hidden");
        document.getElementById("main-trading-container").classList.add("hidden");
      }

      const ctx = document.getElementById("frequencyChart").getContext("2d");
      chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
          datasets: [{
            data: Array(10).fill(0),
            backgroundColor: Array.from({ length: 10 }, (_, i) => i < 7 ? "rgba(0, 212, 255, 0.4)" : "rgba(255, 68, 68, 0.4)"),
            borderColor: Array.from({ length: 10 }, (_, i) => i === 7 ? "#ffaa00" : i < 7 ? "#00d4ff" : "#ff4444"),
            borderWidth: Array.from({ length: 10 }, (_, i) => i === 7 ? 2.5 : 1.2),
            borderRadius: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: 0, max: 25, ticks: { font: { size: 8 } } },
            x: { ticks: { font: { size: 9, weight: "bold" }, color: "#fff" } }
          }
        }
      });
    });
  </script>
</body>
</html>`;
