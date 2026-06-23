import { useState, useEffect } from "react";

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

type Status = "idle" | "loading" | "success" | "error";

export default function FundsPanel({ balance, isRealAccount, accountEmail, telegramId, currentUserEmail, onSwitchToDemo, onSwitchToDeriv, onBalanceRefresh }: FundsPanelProps) {
  const [bankBalance, setBankBalance] = useState<number>(0);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDirection, setTransferDirection] = useState<"toBank" | "fromBank">("toBank");
  const [transferStatus, setTransferStatus] = useState<Status>("idle");
  const [transferMessage, setTransferMessage] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [switchLoading, setSwitchLoading] = useState(false);
  const [switchMessage, setSwitchMessage] = useState("");

  const isOnDeriv = !!currentUserEmail;
  const actualBalance = parseFloat(balance ?? "0");
  const availableBalance = isOnDeriv ? actualBalance : Math.max(0, actualBalance - bankBalance);

  useEffect(() => {
    fetch(`/api/bank/balance?telegramId=${telegramId}`)
      .then((r) => r.json())
      .then((d) => setBankBalance(d.balance ?? 0))
      .catch(() => {});
  }, [telegramId]);

  async function handleSwitch() {
    setSwitchLoading(true); setSwitchMessage("");
    try {
      if (isOnDeriv) {
        await onSwitchToDemo();
        setSwitchMessage("Switched to Sandbox Demo mode.");
      } else {
        const res = await onSwitchToDeriv();
        setSwitchMessage(res.success ? "Switched back to Deriv account." : "No saved Deriv session. Please login first.");
      }
      onBalanceRefresh();
    } catch { setSwitchMessage("Switch failed. Please try again."); }
    finally { setSwitchLoading(false); setTimeout(() => setSwitchMessage(""), 3000); }
  }

  async function handleTransfer() {
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) { setTransferStatus("error"); setTransferMessage("Enter a valid amount."); return; }
    if (transferDirection === "toBank" && amount > availableBalance) { setTransferStatus("error"); setTransferMessage(`Insufficient balance. Available: $${availableBalance.toFixed(2)}`); return; }
    if (transferDirection === "fromBank" && amount > bankBalance) { setTransferStatus("error"); setTransferMessage(`Insufficient bank balance. Bank: $${bankBalance.toFixed(2)}`); return; }
    setTransferLoading(true); setTransferStatus("idle"); setTransferMessage("");
    try {
      const endpoint = transferDirection === "toBank" ? "/api/bank/deposit" : "/api/bank/withdraw";
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telegramId, amount }) });
      const data = await res.json();
      if (data.success) {
        setBankBalance(data.bankBalance);
        setTransferStatus("success");
        setTransferMessage(transferDirection === "toBank" ? `✅ $${amount.toFixed(2)} moved to Reserved Bank.` : `✅ $${amount.toFixed(2)} returned to demo balance.`);
        setTransferAmount("");
        onBalanceRefresh();
      } else { setTransferStatus("error"); setTransferMessage(data.error ?? "Transfer failed."); }
    } catch { setTransferStatus("error"); setTransferMessage("Network error. Please try again."); }
    finally { setTransferLoading(false); }
  }

  async function handleResetBank() {
    if (bankBalance <= 0) return;
    setTransferLoading(true);
    try {
      const res = await fetch("/api/bank/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telegramId, amount: bankBalance }) });
      const data = await res.json();
      if (data.success) { setBankBalance(0); setTransferStatus("success"); setTransferMessage("✅ Bank reset. All funds returned to balance."); onBalanceRefresh(); }
    } catch {}
    finally { setTransferLoading(false); }
  }

  return (
    <div className="flex flex-col gap-4 pb-4 animate-fade-in">
      {/* Page title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#ffdea5] border border-[#c5a059] flex items-center justify-center">
          <span className="material-symbols-outlined text-[#775a19] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
        </div>
        <div>
          <h2 className="text-[16px] font-bold text-[#1e1b16] uppercase tracking-[0.08em]">FUNDS MANAGER</h2>
          <p className="text-[10px] text-[#4e4639] uppercase tracking-widest">Deriv Account Operations</p>
        </div>
      </div>

      {/* Account mode toggle */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold text-[#4e4639] uppercase tracking-widest">ACCOUNT MODE</p>
        <div className="flex p-1 bg-[#efe7de] rounded-xl border border-[#d1c5b4]">
          <button
            type="button"
            onClick={() => !isOnDeriv || handleSwitch()}
            className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
              isOnDeriv ? "bg-white text-[#775a19] shadow-sm border border-[#d1c5b4]" : "text-[#4e4639] opacity-60"
            }`}
          >
            Deriv Account
          </button>
          <button
            type="button"
            onClick={() => isOnDeriv && handleSwitch()}
            className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
              !isOnDeriv ? "bg-white text-[#775a19] shadow-sm border border-[#d1c5b4]" : "text-[#4e4639] opacity-60"
            }`}
          >
            Sandbox Demo
          </button>
        </div>
        {isOnDeriv && (
          <p className="text-[10px] text-[#4e4639] text-center">Connected as <span className="font-bold text-[#775a19]">{currentUserEmail}</span></p>
        )}
        {switchMessage && (
          <p className={`text-[11px] text-center font-medium ${switchMessage.includes("failed") ? "text-error" : "text-success"}`}>{switchMessage}</p>
        )}
        {switchLoading && <p className="text-[11px] text-center text-[#775a19]">Switching…</p>}
      </div>

      {/* Balance cards */}
      <div className="flex flex-col gap-3">
        <div className="glass-card p-5 rounded-xl relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-[10px] font-bold text-[#4e4639] uppercase tracking-widest mb-1">{isOnDeriv ? "DERIV BALANCE" : "AVAILABLE BALANCE"}</p>
              <h2 className="text-2xl font-bold text-[#1e1b16]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                ${availableBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </h2>
            </div>
            <span className="material-symbols-outlined text-[#c5a059] opacity-40 text-4xl">payments</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${isRealAccount ? "text-success" : "text-[#7f7667]"}`}>
              {isRealAccount ? "REAL ACCOUNT" : "DEMO ACCOUNT"}
            </span>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#c5a059]/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
        </div>

        {!isOnDeriv && (
          <div className="glass-card p-5 rounded-xl relative overflow-hidden border-[#c5a059]/20">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-[10px] font-bold text-[#4e4639] uppercase tracking-widest mb-1">RESERVED BANK</p>
                <h2 className="text-2xl font-bold text-[#775a19]" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                  ${bankBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </h2>
              </div>
              <span className="material-symbols-outlined text-[#c5a059] opacity-40 text-4xl">account_balance</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-[#775a19] uppercase tracking-widest">Secured</span>
                <span className="material-symbols-outlined text-[#775a19] text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
              </div>
              {bankBalance > 0 && (
                <button type="button" onClick={handleResetBank} disabled={transferLoading} className="text-[9px] text-error underline font-bold cursor-pointer disabled:opacity-40">
                  Reset bank
                </button>
              )}
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#c5a059]/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
          </div>
        )}
      </div>

      {/* Internal Transfer (sandbox only) */}
      {!isOnDeriv && (
        <div className="glass-card p-5 rounded-xl bg-[#fbf2e9]">
          <h3 className="text-[13px] font-bold text-[#1e1b16] mb-4 uppercase tracking-[0.06em]">INTERNAL TRANSFER</h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-[10px] font-bold text-[#4e4639] block mb-2 uppercase tracking-widest">AMOUNT TO MOVE</label>
              <div className="relative">
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white border border-[#d1c5b4] rounded-lg h-12 px-4 text-[14px] text-[#1e1b16] focus:outline-none focus:border-[#775a19] transition-colors"
                  style={{ fontFamily: "IBM Plex Mono, monospace" }}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-[#4e4639] font-bold" style={{ fontFamily: "IBM Plex Mono, monospace" }}>USD</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setTransferDirection("toBank"); }}
                className={`flex-1 h-12 rounded-lg text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                  transferDirection === "toBank" ? "bg-[#545f72] text-white border-[#545f72]" : "bg-[#f5ede4] text-[#4e4639] border-[#d1c5b4]"
                }`}
              >
                <span className="material-symbols-outlined text-sm">arrow_downward</span>
                To Bank
              </button>
              <button
                type="button"
                onClick={() => { setTransferDirection("fromBank"); }}
                className={`flex-1 h-12 rounded-lg text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                  transferDirection === "fromBank" ? "bg-[#775a19] text-white border-[#775a19]" : "bg-[#f5ede4] text-[#4e4639] border-[#d1c5b4]"
                }`}
              >
                <span className="material-symbols-outlined text-sm">arrow_upward</span>
                To Trading
              </button>
            </div>
            <button
              type="button"
              onClick={handleTransfer}
              disabled={transferLoading}
              className="w-full h-12 gold-gradient text-white rounded-lg text-[11px] font-bold uppercase tracking-wider active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {transferLoading ? "Processing…" : "CONFIRM TRANSFER"}
            </button>
            {transferMessage && (
              <p className={`text-[11px] font-medium text-center ${transferStatus === "success" ? "text-success" : "text-error"}`}>{transferMessage}</p>
            )}
          </div>
        </div>
      )}

      {/* Danger zone */}
      {!isOnDeriv && (
        <div className="pt-4 border-t border-[#d1c5b4]">
          <button
            type="button"
            disabled={transferLoading}
            onClick={handleResetBank}
            className="w-full h-11 border border-error/40 text-error rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#ffdad6]/30 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Reset Demo Balance
          </button>
          <p className="text-center text-[10px] text-[#4e4639]/60 mt-2 uppercase tracking-widest">
            Resets sandbox balance to <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>$10,000.00</span>
          </p>
        </div>
      )}
    </div>
  );
}
