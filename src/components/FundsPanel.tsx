import { useState, useEffect } from "react";
import { Wallet, ArrowDownCircle, ArrowUpCircle, RefreshCw, CheckCircle, XCircle, Loader, Landmark, ArrowRightLeft } from "lucide-react";

interface FundsPanelProps {
  balance: string | null;
  isRealAccount: boolean;
  accountEmail: string | null;
  apiToken: string;
  telegramId: string;
  currentUserEmail: string | null;
  onSwitchToDemo: () => Promise<any>;
  onSwitchToDeriv: () => Promise<any>;
  onBalanceRefresh: () => void;
}

type Tab = "topup" | "transfer";
type Status = "idle" | "loading" | "success" | "error";

const TOPUP_AMOUNTS = [1000, 5000, 10000, 50000];

export default function FundsPanel({
  balance,
  isRealAccount,
  accountEmail,
  apiToken,
  telegramId,
  currentUserEmail,
  onSwitchToDemo,
  onSwitchToDeriv,
  onBalanceRefresh,
}: FundsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("topup");

  // Top up state
  const [topupAmount, setTopupAmount] = useState<number>(10000);
  const [topupStatus, setTopupStatus] = useState<Status>("idle");
  const [topupMessage, setTopupMessage] = useState("");

  // Transfer / Bank state
  const [bankBalance, setBankBalance] = useState<number>(0);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDirection, setTransferDirection] = useState<"toBank" | "fromBank">("toBank");
  const [transferStatus, setTransferStatus] = useState<Status>("idle");
  const [transferMessage, setTransferMessage] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  const [switchLoading, setSwitchLoading] = useState(false);
  const [switchMessage, setSwitchMessage] = useState("");

  const isOnDeriv = !!currentUserEmail;

  async function handleAccountSwitch() {
    setSwitchLoading(true);
    setSwitchMessage("");
    try {
      if (isOnDeriv) {
        await onSwitchToDemo();
        setSwitchMessage("Switched to Sandbox Demo mode.");
      } else {
        const result = await onSwitchToDeriv();
        if (result.success) {
          setSwitchMessage("Switched back to Deriv account.");
        } else {
          setSwitchMessage("No saved Deriv session. Please login first.");
        }
      }
      onBalanceRefresh();
    } catch {
      setSwitchMessage("Switch failed. Please try again.");
    } finally {
      setSwitchLoading(false);
      setTimeout(() => setSwitchMessage(""), 3000);
    }
  }

  const actualBalance = parseFloat(balance ?? "0");
  const availableBalance = Math.max(0, actualBalance - bankBalance);

  // Load bank balance from server on mount
  useEffect(() => {
    fetch(`/api/bank/balance?telegramId=${telegramId}`)
      .then(r => r.json())
      .then(data => setBankBalance(data.balance ?? 0))
      .catch(() => {});
  }, [telegramId]);

  // ── Top Up Demo Balance ─────────────────────────────────────────────────────
  async function handleTopUp() {
    if (!apiToken) { setTopupStatus("error"); setTopupMessage("Not connected to Deriv. Please login first."); return; }
    setTopupStatus("loading"); setTopupMessage("");
    try {
      const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=1089`);
      ws.onopen = () => ws.send(JSON.stringify({ authorize: apiToken }));
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.msg_type === "authorize") {
          if (data.error) { setTopupStatus("error"); setTopupMessage(`Auth failed: ${data.error.message}`); ws.close(); return; }
          ws.send(JSON.stringify({ topup_virtual: 1 }));
        }
        if (data.msg_type === "topup_virtual") {
          ws.close();
          if (data.error) { setTopupStatus("error"); setTopupMessage(`Top up failed: ${data.error.message}`); }
          else {
            setTopupStatus("success");
            const newBal = data.topup_virtual?.balance?.toFixed(2) ?? "—";
            setTopupMessage(`✅ Demo balance topped up! New balance: $${newBal}`);
            onBalanceRefresh();
          }
        }
      };
      ws.onerror = () => { setTopupStatus("error"); setTopupMessage("Connection error."); ws.close(); };
    } catch { setTopupStatus("error"); setTopupMessage("Unexpected error."); }
  }

  // ── Transfer (Demo ↔ Reserved Bank) ────────────────────────────────────────
  async function handleTransfer() {
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      setTransferStatus("error"); setTransferMessage("Please enter a valid amount."); return;
    }
    if (transferDirection === "toBank" && amount > availableBalance) {
      setTransferStatus("error"); setTransferMessage(`Insufficient balance. Available: $${availableBalance.toFixed(2)}`); return;
    }
    if (transferDirection === "fromBank" && amount > bankBalance) {
      setTransferStatus("error"); setTransferMessage(`Insufficient bank balance. Bank has: $${bankBalance.toFixed(2)}`); return;
    }

    setTransferLoading(true); setTransferStatus("idle"); setTransferMessage("");

    try {
      const endpoint = transferDirection === "toBank" ? "/api/bank/deposit" : "/api/bank/withdraw";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId, amount }),
      });
      const data = await res.json();
      if (data.success) {
        setBankBalance(data.bankBalance);
        setTransferStatus("success");
        setTransferMessage(
          transferDirection === "toBank"
            ? `✅ $${amount.toFixed(2)} moved to Reserved Bank. Bank: $${data.bankBalance.toFixed(2)}`
            : `✅ $${amount.toFixed(2)} returned to demo balance. Bank: $${data.bankBalance.toFixed(2)}`
        );
        setTransferAmount("");
        onBalanceRefresh();
      } else {
        setTransferStatus("error"); setTransferMessage(data.error ?? "Transfer failed.");
      }
    } catch { setTransferStatus("error"); setTransferMessage("Network error. Please try again."); }
    finally { setTransferLoading(false); }
  }

  async function handleResetBank() {
    if (bankBalance <= 0) return;
    setTransferLoading(true);
    try {
      const res = await fetch("/api/bank/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId, amount: bankBalance }),
      });
      const data = await res.json();
      if (data.success) {
        setBankBalance(0);
        setTransferStatus("success");
        setTransferMessage("✅ Bank reset. All funds returned to available balance.");
        onBalanceRefresh();
      }
    } catch { }
    finally { setTransferLoading(false); }
  }

  return (
    <div className="px-4 py-4 space-y-4 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-full bg-gold-500/10 border border-gold-500/25 flex items-center justify-center">
          <Wallet className="h-4 w-4 text-gold-500" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white tracking-wide">FUNDS MANAGER</h2>
          <p className="text-[10px] text-neutral-400 uppercase tracking-widest">Deriv Account Operations</p>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-card border border-green-500/20 rounded-xl p-3">
          <p className="text-[9px] text-neutral-400 uppercase tracking-widest mb-1">Available Balance</p>
          <p className="text-xl font-bold text-green-400">${availableBalance.toFixed(2)}</p>
          <p className="text-[9px] text-neutral-500 mt-0.5">Total: ${actualBalance.toFixed(2)}</p>
        </div>
        <div className="bg-bg-card border border-gold-500/20 rounded-xl p-3">
          <p className="text-[9px] text-neutral-400 uppercase tracking-widest mb-1">Reserved Bank</p>
          <p className="text-xl font-bold text-gold-400">${bankBalance.toFixed(2)}</p>
          {bankBalance > 0 && (
            <button onClick={handleResetBank} disabled={transferLoading}
              className="text-[9px] text-red-400 mt-0.5 underline">
              Reset bank
            </button>
          )}
        </div>
      </div>

      {/* Account Mode Toggle */}
      <div className="bg-bg-card border border-white/[0.07] rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-white mb-0.5">
              {isOnDeriv ? "Deriv Account" : "Sandbox Demo"}
            </p>
            <p className="text-[10px] text-neutral-400">
              {isOnDeriv
                ? `Connected as ${currentUserEmail}`
                : "No Deriv account connected"}
            </p>
          </div>
          <button
            onClick={handleAccountSwitch}
            disabled={switchLoading}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none disabled:opacity-50 ${
              isOnDeriv ? "bg-gold-500" : "bg-white/20"
            }`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
              isOnDeriv ? "translate-x-8" : "translate-x-1"
            }`} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[9px] text-neutral-500 uppercase tracking-wider">
            {isOnDeriv ? "Tap to switch to Demo" : "Tap to switch to Deriv"}
          </span>
          {switchLoading && <Loader className="h-3 w-3 text-gold-400 animate-spin" />}
        </div>
        {switchMessage && (
          <p className={`text-[10px] mt-2 ${switchMessage.includes("failed") || switchMessage.includes("No saved") ? "text-red-400" : "text-green-400"}`}>
            {switchMessage}
          </p>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-bg-card border border-white/[0.07] rounded-xl p-1 gap-1">
        <button onClick={() => setActiveTab("topup")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === "topup" ? "bg-gold-500/15 text-gold-400 border border-gold-500/25" : "text-neutral-400"}`}>
          <ArrowDownCircle className="h-3 w-3" /> Top Up Demo
        </button>
        {!currentUserEmail && (
          <button onClick={() => setActiveTab("transfer")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === "transfer" ? "bg-gold-500/15 text-gold-400 border border-gold-500/25" : "text-neutral-400"}`}>
            <Landmark className="h-3 w-3" /> Reserved Bank
          </button>
        )}
      </div>

      {/* ── TOP UP TAB ── */}
      {activeTab === "topup" && (
        <div className="bg-bg-card border border-white/[0.07] rounded-xl p-4 space-y-4">
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Adds virtual funds to your Deriv demo account via the official Deriv API. Only works on demo accounts.
          </p>
          {isRealAccount && (
            <div className="p-3 bg-orange-500/10 border border-orange-500/25 rounded-lg">
              <p className="text-[11px] text-orange-400 font-semibold">⚠️ Real Account — Top up unavailable.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {TOPUP_AMOUNTS.map((amt) => (
              <button key={amt} onClick={() => setTopupAmount(amt)}
                className={`py-2.5 rounded-lg text-xs font-bold border transition-all ${topupAmount === amt ? "bg-gold-500/15 border-gold-500/40 text-gold-400" : "bg-white/5 border-white/10 text-neutral-400"}`}>
                ${amt.toLocaleString()}
              </button>
            ))}
          </div>
          <input type="number" placeholder="Or enter custom amount"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-gold-500/40"
            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setTopupAmount(v); }} />
          {topupMessage && (
            <div className={`p-3 rounded-lg flex items-start gap-2 ${topupStatus === "success" ? "bg-green-500/10 border border-green-500/25" : "bg-red-500/10 border border-red-500/25"}`}>
              {topupStatus === "success" ? <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />}
              <p className={`text-[11px] ${topupStatus === "success" ? "text-green-300" : "text-red-300"}`}>{topupMessage}</p>
            </div>
          )}
          <button onClick={handleTopUp} disabled={topupStatus === "loading" || isRealAccount}
            className="w-full py-3 rounded-xl bg-gold-500 text-black font-bold text-sm uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95">
            {topupStatus === "loading" ? <><Loader className="h-4 w-4 animate-spin" /> Processing...</> : <><ArrowDownCircle className="h-4 w-4" /> Top Up ${topupAmount.toLocaleString()}</>}
          </button>
        </div>
      )}

      {/* ── RESERVED BANK TAB ── */}
      {activeTab === "transfer" && (
        <div className="bg-bg-card border border-white/[0.07] rounded-xl p-4 space-y-4">
          <div>
            <p className="text-xs text-neutral-300 mb-1 font-semibold">Reserved Bank</p>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Protect your capital by storing funds in the Reserved Bank. Keep only what you need for testing — e.g. transfer $9,950 to bank and trade with just $50.
            </p>
          </div>

          {/* Direction Toggle */}
          <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
            <button onClick={() => { setTransferDirection("toBank"); setTransferStatus("idle"); setTransferMessage(""); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${transferDirection === "toBank" ? "bg-gold-500/15 text-gold-400 border border-gold-500/25" : "text-neutral-400"}`}>
              <ArrowDownCircle className="h-3.5 w-3.5" /> Demo → Bank
            </button>
            <button onClick={() => { setTransferDirection("fromBank"); setTransferStatus("idle"); setTransferMessage(""); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${transferDirection === "fromBank" ? "bg-gold-500/15 text-gold-400 border border-gold-500/25" : "text-neutral-400"}`}>
              <ArrowUpCircle className="h-3.5 w-3.5" /> Bank → Demo
            </button>
          </div>

          {/* Info row */}
          <div className="flex gap-3">
            <div className="flex-1 bg-white/5 rounded-lg p-3 text-center">
              <p className="text-[9px] text-neutral-400 mb-1">
                {transferDirection === "toBank" ? "Available to Transfer" : "In Bank"}
              </p>
              <p className="text-sm font-bold text-white">
                ${transferDirection === "toBank" ? availableBalance.toFixed(2) : bankBalance.toFixed(2)}
              </p>
            </div>
            <div className="flex-1 bg-gold-500/5 border border-gold-500/15 rounded-lg p-3 text-center">
              <p className="text-[9px] text-neutral-400 mb-1">After Transfer</p>
              <p className="text-sm font-bold text-gold-400">
                {transferDirection === "toBank"
                  ? `$${(bankBalance + (parseFloat(transferAmount) || 0)).toFixed(2)}`
                  : `$${Math.max(0, bankBalance - (parseFloat(transferAmount) || 0)).toFixed(2)}`}
              </p>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">Amount</p>
            <input type="number" placeholder="e.g. 9950" value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-gold-500/40" />
            <div className="flex gap-2 mt-2">
              {[25, 50, 75, 100].map((pct) => (
                <button key={pct} onClick={() => {
                  const base = transferDirection === "toBank" ? availableBalance : bankBalance;
                  setTransferAmount((base * pct / 100).toFixed(2));
                }} className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-neutral-400 hover:text-white transition-colors">
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          {transferMessage && (
            <div className={`p-3 rounded-lg flex items-start gap-2 ${transferStatus === "success" ? "bg-green-500/10 border border-green-500/25" : "bg-red-500/10 border border-red-500/25"}`}>
              {transferStatus === "success" ? <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />}
              <p className={`text-[11px] ${transferStatus === "success" ? "text-green-300" : "text-red-300"}`}>{transferMessage}</p>
            </div>
          )}

          <button onClick={handleTransfer} disabled={transferLoading || !transferAmount}
            className="w-full py-3 rounded-xl bg-gold-500 text-black font-bold text-sm uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95">
            {transferLoading
              ? <><Loader className="h-4 w-4 animate-spin" /> Processing...</>
              : transferDirection === "toBank"
                ? <><ArrowDownCircle className="h-4 w-4" /> Transfer to Reserved Bank</>
                : <><ArrowUpCircle className="h-4 w-4" /> Return to Demo Balance</>}
          </button>
        </div>
      )}
    </div>
  );
}
