import React, { useState } from "react";
import { Shield, LogIn, ExternalLink, Sparkles, AlertCircle, Sparkle } from "lucide-react";

interface AuthPanelProps {
  onLogin: (token: string) => Promise<{ success: boolean; error?: string }>;
  onBypass: () => void;
  telegramUser?: any;
}

export default function AuthPanel({ onLogin, onBypass, telegramUser }: AuthPanelProps) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [derivToken, setDerivToken] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!derivToken.trim()) {
      setErrorMsg("Please enter your Deriv API Token to log in.");
      return;
    }
    setErrorMsg("");
    setIsLoading(true);

    try {
      const res = await onLogin(derivToken.trim());
      if (!res.success) {
        setErrorMsg(res.error || "Token authorization failed. Please check your token or connection.");
      }
    } catch (err) {
      setErrorMsg("A connection gateway error occurred. Please retry.");
    } finally {
      setIsLoading(false);
    }
  };

  const affiliateLink = "https://deriv.partners/rx?sidc=C6D4FA86-827B-4AAF-844B-344F9FE57A0F&utm_campaign=dynamicworks&utm_medium=affiliate&utm_source=CU334564";

  return (
    <div className="max-w-md w-full mx-auto bg-bg-card/90 backdrop-blur-md rounded-2xl border border-white/[0.08] shadow-2xl p-6 md:p-8 animate-fade-in transition-all">
      {/* Visual Title Header */}
      <div className="text-center mb-6">
        <div className="mx-auto h-12 w-12 rounded-full bg-gold-500/10 border border-gold-500/25 flex items-center justify-center mb-2.5 text-gold-500 shadow-md">
          <Shield className="h-5 w-5 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-wide">
          {isLoginMode ? "SECURE ACCOUNT ACCESS" : "CREATE DERIV ACCOUNT"}
        </h2>
        <p className="text-[10px] text-neutral-400 uppercase tracking-widest mt-1">
          {isLoginMode ? "Enter your API Token to start trading" : "Sign up under our official partner program"}
        </p>
      </div>

      {telegramUser && (
        <div className="mb-6 p-3 bg-[#229ED9]/5 border border-[#229ED9]/15 rounded-xl text-center flex flex-col items-center gap-1 animate-fade-in">
          <p className="text-[10px] text-[#229ED9] uppercase tracking-wider font-extrabold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#229ED9] animate-ping" /> Telegram Connected
          </p>
          <p className="text-xs text-white font-bold">
            Hi, {telegramUser.first_name || "Trader"}!
          </p>
          <p className="text-[9px] text-neutral-400 uppercase tracking-widest">
            Ready to scan synthetic index trends
          </p>
        </div>
      )}

      {/* Tabs / Selectors */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-xl border border-white/[0.05] mb-6">
        <button
          type="button"
          onClick={() => {
            setIsLoginMode(true);
            setErrorMsg("");
          }}
          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            isLoginMode
              ? "bg-gold-500/10 text-gold-400 border border-gold-500/20"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <LogIn className="h-3.5 w-3.5" /> Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setIsLoginMode(false);
            setErrorMsg("");
          }}
          className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            !isLoginMode
              ? "bg-gold-500/10 text-gold-400 border border-gold-500/20"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <ExternalLink className="h-3.5 w-3.5" /> Register Free
        </button>
      </div>

      {isLoginMode ? (
        /* Sign In Mode: single-field Deriv API token login */
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1 text-left">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
                Deriv API Token
              </label>
              <a
                href={affiliateLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] text-gold-400 hover:underline hover:text-gold-300 font-semibold uppercase flex items-center gap-1"
              >
                No Token? Create Account <ExternalLink className="h-2 w-2" />
              </a>
            </div>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
              <input
                type="text"
                value={derivToken}
                onChange={(e) => setDerivToken(e.target.value)}
                placeholder="Paste your Deriv API token here"
                disabled={isLoading}
                className="w-full pl-9 pr-4 py-2.5 bg-[#121217] border border-white/[0.06] rounded-xl text-xs font-medium text-white placeholder-neutral-600 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/10 transition-all font-mono"
                required
              />
            </div>
            <p className="text-[8px] text-neutral-500 lowercase leading-normal pt-1">
              * Generate your token from Deriv panel under <b>Settings &gt; API Token</b> (Scopes needed: <b>Read</b> + <b>Trade</b>).
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/15 flex items-start gap-2 text-rose-400 text-left animate-shake">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-[10px] font-semibold leading-tight">{errorMsg}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-gradient-to-r from-gold-500 to-amber-500 hover:brightness-110 active:scale-[0.98] text-black font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-gold-500/15 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? (
              <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="h-4 w-4 text-black" /> SECURE LOGIN
              </>
            )}
          </button>
        </form>
      ) : (
        /* Sign Up Mode: Leads users directly to Sign Up using affiliate link */
        <div className="space-y-5 animate-fade-in">
          <div className="text-left bg-gold-500/[0.02] border border-gold-500/10 p-4 rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-gold-400 tracking-wide uppercase flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-gold-500 animate-pulse" /> Affiliate Sponsor Benefits
            </h3>
            <p className="text-[10px] text-neutral-300 leading-relaxed uppercase tracking-wider font-semibold">
              Register a free trading account through our official partner code to unlock premium parameters & priority signal execution:
            </p>
            <ul className="space-y-2 text-[10px] text-neutral-400 font-medium">
              <li className="flex items-start gap-2">
                <span className="text-gold-500 font-bold">•</span>
                <span>Complete instant account setup under sponsor support ID <b>CU334564</b></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold-500 font-bold">•</span>
                <span>Access all 5 intelligent risk paradigms (Martingale, Split, etc.) without limits</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold-500 font-bold">•</span>
                <span>Optimized websocket routing for near-zero trade slippage</span>
              </li>
            </ul>
          </div>

          <a
            href={affiliateLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 bg-gradient-to-r from-gold-500 to-amber-500 hover:brightness-110 active:scale-[0.98] text-black font-extrabold rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-gold-500/15 transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
          >
            REGISTER ON DERIV <ExternalLink className="h-3.5 w-3.5 text-black" strokeWidth={2.5} />
          </a>

          <p className="text-[8px] text-neutral-500 uppercase tracking-wider text-center leading-normal">
            After registering, simply construct an API token on Deriv, toggle back to the <b>Sign In</b> tab, and paste it to activate.
          </p>
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="h-[1px] bg-white/[0.06] flex-1" />
        <span className="text-[9px] uppercase tracking-widest font-black text-neutral-500">OR</span>
        <div className="h-[1px] bg-white/[0.06] flex-1" />
      </div>

      {/* Bypass Trial Button */}
      <button
        type="button"
        onClick={onBypass}
        disabled={isLoading}
        className="w-full py-2.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] text-neutral-300 hover:text-white rounded-xl text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <Sparkles className="h-3.5 w-3.5 text-gold-500 animate-pulse" /> Try Demo Sandbox Mode
      </button>

      {/* Footer Security Info */}
      <p className="text-[8px] text-neutral-500 font-medium text-center uppercase tracking-widest mt-5 leading-relaxed">
        Secure API operations. Token data and analytics parameters are saved directly in your sandbox profile. No raw credentials are saved.
      </p>
    </div>
  );
}
