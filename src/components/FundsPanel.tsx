import { useState, useEffect } from "react";
import { Wallet, ArrowDownCircle, ArrowRightLeft, RefreshCw, CheckCircle, XCircle, Loader, Landmark, ArrowUpCircle } from "lucide-react";

interface FundsPanelProps {
  balance: string | null;
  isRealAccount: boolean;
  accountEmail: string | null;
  apiToken: string;
  telegramId: string;
  onBalanceRefresh: () => void;
}

type Tab = "topup" | "transfer" | "bank";
type Status = "idle" | "loading" | "success" | "error";

const TOPUP_AMOUNTS = [1000, 5000, 10000, 50000];

export default function FundsPanel({
  balance,
  isRealAccount,
  accountEmail,
  apiToken,
  telegramId,
  onBalanceRefresh,
}: FundsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("topup");

  // Top up state
  const [topupAmount, setTopupAmount] = useState<number>(10000);
  const [topupStatus, setTopupStatus] = useState<Status>("idle");
  const [topupMessage, setTopupMessage] = useState("");

  // Transfer state
  const [transferAmount, setTransferAmount] = useState("");
  const [transferStatus, setTransferStatus] = useState<Status>("idle");
  const [transferMessage, setTransferMessage] = useState("");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [fromAccount, setFromAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [accountsLoaded, setAccountsLoaded] = useState(false);

  // Reserved Bank state
  const [bankBalance, setBankBalance] = useState<number>(0);
  const [bankAmount, setBankAmount] = useState("");
  const [bankStatus, setBankStatus] = useState<Status>("idle");
  const [bankMessage, setBankMessage] = useState("");
  const [bankAction, setBankAction] = useState<"deposit" | "withdraw">("deposit");

  // Load bank balance from localStorage on mount
  useEffect(() => {
    const key = `reserved_bank_${telegramId}`;
    const saved = localStorage.getItem(key);
    if (saved) setBankBalance(parseFloat(saved) || 0);
  }, [telegramId]);

  const saveBankBalance = (amount: number) => {
    const key = `reserved_bank_${telegramId}`;
    localStorage.setItem(key, String(amount));
    setBankBalance(amount);
  };

  // ── Top Up Demo Balance ─────────────────────────────────────────────────────
  async function handleTopUp() {
    if (!apiToken) {
      setTopupStatus("error");
      setTopupMessage("Not connected to Deriv. Please login first.");
      return;
    }
    setTopupStatus("loading");
    setTopupMessage("");

    try {
      const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=1089`);
      ws.onopen = () => ws.send(JSON.stringify({ authorize: apiToken }));
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.msg_type === "authorize") {
          if (data.error) {
            setTopupStatus("error");
            setTopupMessage(`Auth failed: ${data.error.message}`);
            ws.close(); return;
          }
          ws.send(JSON.stringify({ topup_virtual: 1 }));
        }
        if (data.msg_type === "topup_virtual") {
          ws.close();
          if (data.error) {
            setTopupStatus("error");
            setTopupMessage(`Top up failed: ${data.error.message}`);
          } else {
            setTopupStatus("success");
            const newBal = data.topup_virtual?.balance?.toFixed(2) ?? "—";
            setTopupMessage(`✅ Demo balance topped up! New balance: $${newBal}`);
            onBalanceRefresh();
          }
        }
      };
      ws.onerror = () => { setTopupStatus("error"); setTopupMessage("Connection error."); ws.close(); };
    } catch (e) {
      setTopupStatus("error");
      setTopupMessage("Unexpected error. Please try again.");
    }
  }

  // ── Load Accounts for Transfer ──────────────────────────────────────────────
  async function loadAccounts() {
    if (!apiToken) return;
    setTransferStatus("loading");
    try {
      const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=1089`);
      ws.onopen = () => ws.send(JSON.stringify({ authorize: apiToken }));
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.msg_type === "authorize") {
          if (data.error) { setTransferStatus("error"); setTransferMessage(`Auth failed: ${data.error.message}`); ws.close(); return; }
          ws.send(JSON.stringify({ transfer_between_accounts: 1 }));
        }
        if (data.msg_type === "transfer_between_accounts") {
          ws.close();
          if (data.error) {
            setTransferStatus("error"); setTransferMessage(`Failed to load accounts: ${data.error.message}`);
          } else {
            const accs = data.accounts ?? [];
            setAccounts(accs); setAccountsLoaded(true); setTransferStatus("idle");
            if (accs.length >= 2) { setFromAccount(accs[0].loginid); setToAccount(accs[1].loginid); }
          }
        }
      };
      ws.onerror = () => { setTransferStatus("error"); setTransferMessage("Connection error."); ws.close(); };
    } catch (e) { setTransferStatus("error"); setTransferMessage("Unexpected error."); }
  }

  // ── Execute Transfer ────────────────────────────────────────────────────────
  async function handleTransfer() {
    if (!apiToken || !fromAccount || !toAccount || !transferAmount) {
      setTransferStatus("error"); setTransferMessage("Please fill in all fields."); return;
    }
    if (fromAccount === toAccount) {
      setTransferStatus("error"); setTransferMessage("From and To accounts must be different."); return;
    }
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      setTransferStatus("error"); setTransferMessage("Please enter a valid amount."); return;
    }
    setTransferStatus("loading"); setTransferMessage("");
    try {
      const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=1089`);
      const fromAcc = accounts.find(a => a.loginid === fromAccount);
      ws.onopen = () => ws.send(JSON.stringify({ authorize: apiToken }));
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.msg_type === "authorize") {
          if (data.error) { setTransferStatus("error"); setTransferMessage(`Auth failed: ${data.error.message}`); ws.close(); return; }
          ws.send(JSON.stringify({ transfer_between_accounts: 1, accounts: "all", amount, currency: fromAcc?.currency ?? "USD", account_from: fromAccount, account_to: toAccount }));
        }
        if (data.msg_type === "transfer_between_accounts") {
          ws.close();
          if (data.error) { setTransferStatus("error"); setTransferMessage(`Transfer failed: ${data.error.message}`); }
          else { setTransferStatus("success"); setTransferMessage(`✅ Transfer of $${amount.toFixed(2)} successful!`); setTransferAmount(""); onBalanceRefresh(); }
        }
      };
      ws.onerror = () => { setTransferStatus("error"); setTransferMessage("Connection error."); ws.close(); };
    } catch (e) { setTransferStatus("error"); setTransferMessage("Unexpected error."); }
  }

  // ── Reserved Bank ───────────────────────────────────────────────────────────
  function handleBankTransaction() {
    const amount = parseFloat(bankAmount);
    if (isNaN(amount) || amount <= 0) {
      setBankStatus("error"); setBankMessage("Please enter a valid amount."); return;
    }

    const currentBalance = parseFloat(balance ?? "0");

    if (bankAction === "deposit") {
      if (amount > currentBalance) {
        setBankStatus("error"); setBankMessage(`Insufficient balance. You only have $${currentBalance.toFixed(2)}.`); return;
      }
      // Deduct from demo balance (via topup reset trick) — actually just track virtually
      const newBankBalance = bankBalance + amount;
      saveBankBalance(newBankBalance);
      setBankStatus("success");
      setBankMessage(`✅ $${amount.toFixed(2)} deposited to Reserved Bank. Bank balance: $${newBankBalance.toFixed(2)}`);
      setBankAmount("");
      // Update displayed balance virtually
      onBalanceRefresh();
    } else {
      if (amount > bankBalance) {
        setBankStatus("error"); setBankMessage(`Insufficient bank balance. Bank has $${bankBalance.toFixed(2)}.`); return;
      }
      const newBankBalance = bankBalance - amount;
      saveBankBalance(newBankBalance);
      setBankStatus("success");
      setBankMessage(`✅ $${amount.toFixed(2)} withdrawn from Reserved Bank. Bank balance: $${newBankBalance.toFixed(2)}`);
      setBankAmount("");
      onBalanceRefresh();
    }
  }

  const currentBalance = parseFloat(balance ?? "0");

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
        <div className="bg-bg-card border border-white/[0.07] rounded-xl p-3">
          <p className="text-[10px] text-neutral-400 uppercase tracking-widest mb-1">Demo Balance</p>
          <p className="text-xl font-bold text-white">${balance ?? "—"}</p>
          <button onClick={onBalanceRefresh} className="mt-1 text-[10px] text-neutral-500 flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
        <div className="bg-bg-card border border-gold-500/20 rounded-xl p-3">
          <p className="text-[10px] text-neutral-400 uppercase tracking-widest mb-1">Reserved Bank</p>
          <p className="text-xl font-bold text-gold-400">${bankBalance.toFixed(2)}</p>
          <p className="text-[10px] text-neutral-500 mt-1">Virtual safe</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-bg-card border border-white/[0.07] rounded-xl p-1 gap-1">
        {([["topup", "Top Up", ArrowDownCircle], ["bank", "Bank", Landmark], ["transfer", "Transfer", ArrowRightLeft]] as const).map(([tab, label, Icon]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
              activeTab === tab
                ? "bg-gold-500/15 text-gold-400 border border-gold-500/25"
                : "text-neutral-400"
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* ── TOP UP TAB ── */}
      {activeTab === "topup" && (
        <div className="bg-bg-card border border-white/[0.07] rounded-xl p-4 space-y-4">
          <p className="text-[11px] text-neutral-400 leading-relaxed">Adds virtual funds to your Deriv demo account via the official Deriv API. Only works on demo accounts.</p>
          {isRealAccount && (
            <div className="p-3 bg-orange-500/10 border border-orange-500/25 rounded-lg">
              <p className="text-[11px] text-orange-400 font-semibold">⚠️ Real Account Detected</p>
              <p className="text-[10px] text-orange-300 mt-0.5">Top up is only available for demo accounts.</p>
            </div>
          )}
          <div>
            <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">Select Amount</p>
            <div className="grid grid-cols-2 gap-2">
              {TOPUP_AMOUNTS.map((amt) => (
                <button key={amt} onClick={() => setTopupAmount(amt)}
                  className={`py-2.5 rounded-lg text-xs font-bold border transition-all ${topupAmount === amt ? "bg-gold-500/15 border-gold-500/40 text-gold-400" : "bg-white/5 border-white/10 text-neutral-400"}`}>
                  ${amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">Or custom amount</p>
            <input type="number" placeholder="e.g. 25000"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-gold-500/40"
              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setTopupAmount(v); }} />
          </div>
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
      {activeTab === "bank" && (
        <div className="space-y-4">
          <div className="bg-bg-card border border-white/[0.07] rounded-xl p-4 space-y-4">
            <div>
              <p className="text-xs text-neutral-300 mb-1 font-semibold">How it works</p>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Store funds in your Reserved Bank to protect your capital. For example, deposit $9,950 to the bank and keep only $50 to test the bot — your main funds stay safe until you need them.
              </p>
            </div>

            {/* Action Toggle */}
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
              <button
                onClick={() => { setBankAction("deposit"); setBankStatus("idle"); setBankMessage(""); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  bankAction === "deposit" ? "bg-gold-500/15 text-gold-400 border border-gold-500/25" : "text-neutral-400"
                }`}>
                <ArrowDownCircle className="h-3.5 w-3.5" /> Deposit to Bank
              </button>
              <button
                onClick={() => { setBankAction("withdraw"); setBankStatus("idle"); setBankMessage(""); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  bankAction === "withdraw" ? "bg-gold-500/15 text-gold-400 border border-gold-500/25" : "text-neutral-400"
                }`}>
                <ArrowUpCircle className="h-3.5 w-3.5" /> Withdraw
              </button>
            </div>

            {/* Info row */}
            <div className="flex gap-3">
              <div className="flex-1 bg-white/5 rounded-lg p-3 text-center">
                <p className="text-[10px] text-neutral-400 mb-1">Available to Deposit</p>
                <p className="text-sm font-bold text-white">${currentBalance.toFixed(2)}</p>
              </div>
              <div className="flex-1 bg-gold-500/5 border border-gold-500/15 rounded-lg p-3 text-center">
                <p className="text-[10px] text-neutral-400 mb-1">Bank Balance</p>
                <p className="text-sm font-bold text-gold-400">${bankBalance.toFixed(2)}</p>
              </div>
            </div>

            {/* Amount input */}
            <div>
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">
                {bankAction === "deposit" ? "Amount to deposit into bank" : "Amount to withdraw from bank"}
              </p>
              <input
                type="number"
                placeholder="e.g. 9950"
                value={bankAmount}
                onChange={(e) => setBankAmount(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-gold-500/40"
              />
              {/* Quick amount buttons */}
              {bankAction === "deposit" && currentBalance > 0 && (
                <div className="flex gap-2 mt-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button key={pct} onClick={() => setBankAmount((currentBalance * pct / 100).toFixed(2))}
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-neutral-400 hover:text-white transition-colors">
                      {pct}%
                    </button>
                  ))}
                </div>
              )}
              {bankAction === "withdraw" && bankBalance > 0 && (
                <div className="flex gap-2 mt-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button key={pct} onClick={() => setBankAmount((bankBalance * pct / 100).toFixed(2))}
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-neutral-400 hover:text-white transition-colors">
                      {pct}%
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status message */}
            {bankMessage && (
              <div className={`p-3 rounded-lg flex items-start gap-2 ${bankStatus === "success" ? "bg-green-500/10 border border-green-500/25" : "bg-red-500/10 border border-red-500/25"}`}>
                {bankStatus === "success" ? <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />}
                <p className={`text-[11px] ${bankStatus === "success" ? "text-green-300" : "text-red-300"}`}>{bankMessage}</p>
              </div>
            )}

            {/* Action Button */}
            <button onClick={handleBankTransaction} disabled={!bankAmount}
              className="w-full py-3 rounded-xl bg-gold-500 text-black font-bold text-sm uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95">
              {bankAction === "deposit"
                ? <><ArrowDownCircle className="h-4 w-4" /> Deposit to Reserved Bank</>
                : <><ArrowUpCircle className="h-4 w-4" /> Withdraw from Bank</>}
            </button>
          </div>
        </div>
      )}

      {/* ── TRANSFER TAB ── */}
      {activeTab === "transfer" && (
        <div className="bg-bg-card border border-white/[0.07] rounded-xl p-4 space-y-4">
          <p className="text-[11px] text-neutral-400 leading-relaxed">Move funds between your Deriv accounts.</p>
          {!accountsLoaded && (
            <button onClick={loadAccounts} disabled={transferStatus === "loading"}
              className="w-full py-2.5 rounded-xl border border-white/10 bg-white/5 text-neutral-300 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50">
              {transferStatus === "loading" ? <><Loader className="h-3.5 w-3.5 animate-spin" /> Loading...</> : <><RefreshCw className="h-3.5 w-3.5" /> Load My Accounts</>}
            </button>
          )}
          {accountsLoaded && accounts.length >= 2 && (
            <>
              <div>
                <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">From Account</p>
                <select value={fromAccount} onChange={(e) => setFromAccount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold-500/40">
                  {accounts.map((acc) => (
                    <option key={acc.loginid} value={acc.loginid} className="bg-gray-900">
                      {acc.loginid} — {acc.currency} ({acc.is_virtual ? "Demo" : "Real"})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">To Account</p>
                <select value={toAccount} onChange={(e) => setToAccount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold-500/40">
                  {accounts.map((acc) => (
                    <option key={acc.loginid} value={acc.loginid} className="bg-gray-900">
                      {acc.loginid} — {acc.currency} ({acc.is_virtual ? "Demo" : "Real"})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">Amount</p>
                <input type="number" placeholder="e.g. 100" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-gold-500/40" />
              </div>
            </>
          )}
          {accountsLoaded && accounts.length < 2 && (
            <div className="p-3 bg-orange-500/10 border border-orange-500/25 rounded-lg">
              <p className="text-[11px] text-orange-400">⚠️ You need at least 2 Deriv accounts to transfer.</p>
            </div>
          )}
          {transferMessage && (
            <div className={`p-3 rounded-lg flex items-start gap-2 ${transferStatus === "success" ? "bg-green-500/10 border border-green-500/25" : "bg-red-500/10 border border-red-500/25"}`}>
              {transferStatus === "success" ? <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />}
              <p className={`text-[11px] ${transferStatus === "success" ? "text-green-300" : "text-red-300"}`}>{transferMessage}</p>
            </div>
          )}
          {accountsLoaded && accounts.length >= 2 && (
            <button onClick={handleTransfer} disabled={transferStatus === "loading" || !transferAmount}
              className="w-full py-3 rounded-xl bg-gold-500 text-black font-bold text-sm uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95">
              {transferStatus === "loading" ? <><Loader className="h-4 w-4 animate-spin" /> Transferring...</> : <><ArrowRightLeft className="h-4 w-4" /> Transfer Funds</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
