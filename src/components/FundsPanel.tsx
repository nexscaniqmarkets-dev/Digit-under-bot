import { useState } from "react";
import { Wallet, ArrowDownCircle, ArrowRightLeft, RefreshCw, CheckCircle, XCircle, Loader } from "lucide-react";

interface FundsPanelProps {
  balance: string | null;
  isRealAccount: boolean;
  accountEmail: string | null;
  apiToken: string;
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

  // ── Top Up Demo Balance ─────────────────────────────────────────────────────
  // Uses Deriv's topup_virtual API call to reset/add virtual funds
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

      ws.onopen = () => {
        ws.send(JSON.stringify({ authorize: apiToken }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.msg_type === "authorize") {
          if (data.error) {
            setTopupStatus("error");
            setTopupMessage(`Auth failed: ${data.error.message}`);
            ws.close();
            return;
          }
          // Request topup
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

      ws.onerror = () => {
        setTopupStatus("error");
        setTopupMessage("Connection error. Please try again.");
        ws.close();
      };

      // Timeout safety
      setTimeout(() => {
        if (ws.readyState !== WebSocket.CLOSED) {
          ws.close();
          if (topupStatus === "loading") {
            setTopupStatus("error");
            setTopupMessage("Request timed out. Please try again.");
          }
        }
      }, 15000);

    } catch (e) {
      setTopupStatus("error");
      setTopupMessage("Unexpected error. Please try again.");
    }
  }

  // ── Load Accounts for Transfer ──────────────────────────────────────────────
  async function loadAccounts() {
    if (!apiToken) return;
    setTransferStatus("loading");
    setTransferMessage("");

    try {
      const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=1089`);

      ws.onopen = () => {
        ws.send(JSON.stringify({ authorize: apiToken }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.msg_type === "authorize") {
          if (data.error) {
            setTransferStatus("error");
            setTransferMessage(`Auth failed: ${data.error.message}`);
            ws.close();
            return;
          }
          ws.send(JSON.stringify({ transfer_between_accounts: 1 }));
        }

        if (data.msg_type === "transfer_between_accounts") {
          ws.close();
          if (data.error) {
            setTransferStatus("error");
            setTransferMessage(`Failed to load accounts: ${data.error.message}`);
          } else {
            const accs = data.accounts ?? [];
            setAccounts(accs);
            setAccountsLoaded(true);
            setTransferStatus("idle");
            if (accs.length >= 2) {
              setFromAccount(accs[0].loginid);
              setToAccount(accs[1].loginid);
            }
          }
        }
      };

      ws.onerror = () => {
        setTransferStatus("error");
        setTransferMessage("Connection error. Please try again.");
        ws.close();
      };
    } catch (e) {
      setTransferStatus("error");
      setTransferMessage("Unexpected error.");
    }
  }

  // ── Execute Transfer ────────────────────────────────────────────────────────
  async function handleTransfer() {
    if (!apiToken || !fromAccount || !toAccount || !transferAmount) {
      setTransferStatus("error");
      setTransferMessage("Please fill in all fields.");
      return;
    }
    if (fromAccount === toAccount) {
      setTransferStatus("error");
      setTransferMessage("From and To accounts must be different.");
      return;
    }
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      setTransferStatus("error");
      setTransferMessage("Please enter a valid amount.");
      return;
    }

    setTransferStatus("loading");
    setTransferMessage("");

    try {
      const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=1089`);
      const fromAcc = accounts.find(a => a.loginid === fromAccount);

      ws.onopen = () => {
        ws.send(JSON.stringify({ authorize: apiToken }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.msg_type === "authorize") {
          if (data.error) {
            setTransferStatus("error");
            setTransferMessage(`Auth failed: ${data.error.message}`);
            ws.close();
            return;
          }
          ws.send(JSON.stringify({
            transfer_between_accounts: 1,
            accounts: "all",
            amount,
            currency: fromAcc?.currency ?? "USD",
            account_from: fromAccount,
            account_to: toAccount,
          }));
        }

        if (data.msg_type === "transfer_between_accounts") {
          ws.close();
          if (data.error) {
            setTransferStatus("error");
            setTransferMessage(`Transfer failed: ${data.error.message}`);
          } else {
            setTransferStatus("success");
            setTransferMessage(`✅ Transfer of $${amount.toFixed(2)} successful!`);
            setTransferAmount("");
            onBalanceRefresh();
          }
        }
      };

      ws.onerror = () => {
        setTransferStatus("error");
        setTransferMessage("Connection error. Please try again.");
        ws.close();
      };
    } catch (e) {
      setTransferStatus("error");
      setTransferMessage("Unexpected error.");
    }
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

      {/* Balance Card */}
      <div className="bg-bg-card border border-white/[0.07] rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-neutral-400 uppercase tracking-widest mb-1">Current Balance</p>
          <p className="text-2xl font-bold text-white">${balance ?? "—"}</p>
          <p className="text-[10px] text-neutral-500 mt-0.5">{accountEmail ?? "Not connected"}</p>
        </div>
        <button
          onClick={onBalanceRefresh}
          className="p-2 rounded-lg bg-white/5 border border-white/10 text-neutral-400 hover:text-white transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-bg-card border border-white/[0.07] rounded-xl p-1">
        <button
          onClick={() => setActiveTab("topup")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === "topup"
              ? "bg-gold-500/15 text-gold-400 border border-gold-500/25"
              : "text-neutral-400"
          }`}
        >
          <ArrowDownCircle className="h-3.5 w-3.5" />
          Top Up Demo
        </button>
        <button
          onClick={() => setActiveTab("transfer")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === "transfer"
              ? "bg-gold-500/15 text-gold-400 border border-gold-500/25"
              : "text-neutral-400"
          }`}
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Transfer
        </button>
      </div>

      {/* ── TOP UP TAB ── */}
      {activeTab === "topup" && (
        <div className="space-y-4">
          <div className="bg-bg-card border border-white/[0.07] rounded-xl p-4 space-y-4">
            <div>
              <p className="text-xs text-neutral-300 mb-1 font-semibold">What is Top Up?</p>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Adds virtual funds to your Deriv demo account via the official Deriv API. 
                Only works on demo accounts — real accounts are not affected.
              </p>
            </div>

            {isRealAccount && (
              <div className="p-3 bg-orange-500/10 border border-orange-500/25 rounded-lg">
                <p className="text-[11px] text-orange-400 font-semibold">⚠️ Real Account Detected</p>
                <p className="text-[10px] text-orange-300 mt-0.5">Top up is only available for demo accounts. Switch to your demo account first.</p>
              </div>
            )}

            {/* Amount selector */}
            <div>
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">Select Amount</p>
              <div className="grid grid-cols-2 gap-2">
                {TOPUP_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setTopupAmount(amt)}
                    className={`py-2.5 rounded-lg text-xs font-bold border transition-all ${
                      topupAmount === amt
                        ? "bg-gold-500/15 border-gold-500/40 text-gold-400"
                        : "bg-white/5 border-white/10 text-neutral-400"
                    }`}
                  >
                    ${amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom amount */}
            <div>
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">Or enter custom amount</p>
              <input
                type="number"
                placeholder="e.g. 25000"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-gold-500/40"
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) setTopupAmount(val);
                }}
              />
            </div>

            {/* Status message */}
            {topupMessage && (
              <div className={`p-3 rounded-lg flex items-start gap-2 ${
                topupStatus === "success"
                  ? "bg-green-500/10 border border-green-500/25"
                  : "bg-red-500/10 border border-red-500/25"
              }`}>
                {topupStatus === "success"
                  ? <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                  : <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                }
                <p className={`text-[11px] ${topupStatus === "success" ? "text-green-300" : "text-red-300"}`}>
                  {topupMessage}
                </p>
              </div>
            )}

            {/* Top Up Button */}
            <button
              onClick={handleTopUp}
              disabled={topupStatus === "loading" || isRealAccount}
              className="w-full py-3 rounded-xl bg-gold-500 text-black font-bold text-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              {topupStatus === "loading" ? (
                <><Loader className="h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                <><ArrowDownCircle className="h-4 w-4" /> Top Up ${topupAmount.toLocaleString()}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── TRANSFER TAB ── */}
      {activeTab === "transfer" && (
        <div className="space-y-4">
          <div className="bg-bg-card border border-white/[0.07] rounded-xl p-4 space-y-4">
            <div>
              <p className="text-xs text-neutral-300 mb-1 font-semibold">Transfer Between Accounts</p>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Move funds between your Deriv accounts (e.g. demo to real, or between wallets).
              </p>
            </div>

            {/* Load Accounts Button */}
            {!accountsLoaded && (
              <button
                onClick={loadAccounts}
                disabled={transferStatus === "loading"}
                className="w-full py-2.5 rounded-xl border border-white/10 bg-white/5 text-neutral-300 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {transferStatus === "loading" ? (
                  <><Loader className="h-3.5 w-3.5 animate-spin" /> Loading accounts...</>
                ) : (
                  <><RefreshCw className="h-3.5 w-3.5" /> Load My Accounts</>
                )}
              </button>
            )}

            {/* Account selectors */}
            {accountsLoaded && accounts.length >= 2 && (
              <>
                <div>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">From Account</p>
                  <select
                    value={fromAccount}
                    onChange={(e) => setFromAccount(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold-500/40"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.loginid} value={acc.loginid} className="bg-gray-900">
                        {acc.loginid} — {acc.currency} ({acc.account_type ?? (acc.is_virtual ? "Demo" : "Real")})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">To Account</p>
                  <select
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold-500/40"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.loginid} value={acc.loginid} className="bg-gray-900">
                        {acc.loginid} — {acc.currency} ({acc.account_type ?? (acc.is_virtual ? "Demo" : "Real")})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">Amount</p>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-gold-500/40"
                  />
                </div>
              </>
            )}

            {accountsLoaded && accounts.length < 2 && (
              <div className="p-3 bg-orange-500/10 border border-orange-500/25 rounded-lg">
                <p className="text-[11px] text-orange-400">⚠️ You need at least 2 Deriv accounts to transfer between them.</p>
              </div>
            )}

            {/* Status message */}
            {transferMessage && (
              <div className={`p-3 rounded-lg flex items-start gap-2 ${
                transferStatus === "success"
                  ? "bg-green-500/10 border border-green-500/25"
                  : "bg-red-500/10 border border-red-500/25"
              }`}>
                {transferStatus === "success"
                  ? <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                  : <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                }
                <p className={`text-[11px] ${transferStatus === "success" ? "text-green-300" : "text-red-300"}`}>
                  {transferMessage}
                </p>
              </div>
            )}

            {/* Transfer Button */}
            {accountsLoaded && accounts.length >= 2 && (
              <button
                onClick={handleTransfer}
                disabled={transferStatus === "loading" || !transferAmount}
                className="w-full py-3 rounded-xl bg-gold-500 text-black font-bold text-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {transferStatus === "loading" ? (
                  <><Loader className="h-4 w-4 animate-spin" /> Transferring...</>
                ) : (
                  <><ArrowRightLeft className="h-4 w-4" /> Transfer Funds</>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
