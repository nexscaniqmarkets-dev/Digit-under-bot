import React, { useState } from "react";

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

  const affiliateLink =
    "https://deriv.partners/rx?sidc=C6D4FA86-827B-4AAF-844B-344F9FE57A0F&utm_campaign=dynamicworks&utm_medium=affiliate&utm_source=CU334564";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!derivToken.trim()) { setErrorMsg("Please enter your Deriv API Token to continue."); return; }
    setErrorMsg(""); setIsLoading(true);
    try {
      const res = await onLogin(derivToken.trim());
      if (!res.success) setErrorMsg(res.error || "Token authorization failed. Please check your token or connection.");
    } catch { setErrorMsg("A connection error occurred. Please retry."); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#fff8f3] px-4 py-8">
      <div className="w-full max-w-sm flex flex-col gap-6 animate-fade-in">

        {/* Brand block */}
        <div className="text-center flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl gold-gradient flex items-center justify-center shadow-lg shadow-[#775a19]/20">
            <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>token</span>
          </div>
          <div>
            <h1 className="text-[22px] font-black text-[#1e1b16] uppercase tracking-[0.06em]">DIGIT UNDER BOT</h1>
            <p className="text-[10px] text-[#4e4639] uppercase tracking-[0.15em] mt-0.5">Synthetic Index Automation Engine</p>
          </div>
        </div>

        {/* Telegram greeting */}
        {telegramUser && (
          <div className="bg-[#e8f0fe] border border-[#b8ccf8] rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#485e8b] pulsing-dot" />
              <span className="text-[9px] font-bold text-[#485e8b] uppercase tracking-widest">Telegram Connected</span>
            </div>
            <p className="text-[13px] font-bold text-[#1e1b16]">Hi, {telegramUser.first_name || "Trader"}!</p>
            <p className="text-[9px] text-[#4e4639] uppercase tracking-wider mt-0.5">Ready to scan synthetic index trends</p>
          </div>
        )}

        {/* Tab switcher */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex p-1 bg-[#f5ede4] border-b border-[#d1c5b4]">
            <button
              type="button"
              onClick={() => { setIsLoginMode(true); setErrorMsg(""); }}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                isLoginMode ? "bg-white text-[#775a19] shadow-sm border border-[#d1c5b4]" : "text-[#4e4639] opacity-60 hover:opacity-100"
              }`}
            >
              <span className="material-symbols-outlined text-sm">login</span>
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsLoginMode(false); setErrorMsg(""); }}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                !isLoginMode ? "bg-white text-[#775a19] shadow-sm border border-[#d1c5b4]" : "text-[#4e4639] opacity-60 hover:opacity-100"
              }`}
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              Register Free
            </button>
          </div>

          <div className="p-5">
            {isLoginMode ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-[#4e4639] uppercase tracking-[0.12em]">Deriv API Token</label>
                    <a href={affiliateLink} target="_blank" rel="noopener noreferrer"
                      className="text-[9px] text-[#775a19] underline font-bold uppercase flex items-center gap-0.5">
                      No Token? <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                    </a>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#7f7667] text-[18px]">shield</span>
                    <input
                      type="text"
                      value={derivToken}
                      onChange={(e) => setDerivToken(e.target.value)}
                      placeholder="Paste your Deriv API token here"
                      disabled={isLoading}
                      className="w-full pl-9 pr-4 h-11 bg-white border border-[#d1c5b4] rounded-lg text-[12px] text-[#1e1b16] placeholder-[#7f7667]/60 focus:outline-none focus:border-[#775a19] transition-colors disabled:opacity-50"
                      style={{ fontFamily: "IBM Plex Mono, monospace" }}
                      required
                    />
                  </div>
                  <p className="text-[9px] text-[#7f7667] leading-relaxed">
                    Generate your token from Deriv → <strong>Settings › API Token</strong> (Scopes: Read + Trade)
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-lg bg-[#ffdad6]/50 border border-error/20 flex items-start gap-2">
                    <span className="material-symbols-outlined text-error text-[18px] shrink-0">error</span>
                    <p className="text-[11px] text-error font-medium leading-snug">{errorMsg}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 gold-gradient rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(119,90,25,0.2)] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-white text-[18px]">lock</span>
                      <span className="text-[11px] font-black text-white uppercase tracking-[0.1em]">CONNECT DERIV ACCOUNT</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="bg-[#fbf2e9] rounded-xl p-4 border border-[#d1c5b4]/50 flex flex-col gap-3">
                  <h3 className="text-[11px] font-bold text-[#775a19] uppercase tracking-[0.1em] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                    Affiliate Sponsor Benefits
                  </h3>
                  <p className="text-[11px] text-[#4e4639] leading-relaxed">
                    Register a free trading account through our official partner code to unlock all premium parameters:
                  </p>
                  <ul className="flex flex-col gap-2">
                    {[
                      "Complete instant setup under sponsor ID CU334564",
                      "Access all 5 intelligent risk paradigms without limits",
                      "Optimised WebSocket routing for near-zero trade slippage",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-[#4e4639]">
                        <span className="text-[#c5a059] font-bold mt-0.5">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <a
                  href={affiliateLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-12 gold-gradient rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(119,90,25,0.2)] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <span className="text-[11px] font-black text-white uppercase tracking-[0.1em]">REGISTER ON DERIV</span>
                  <span className="material-symbols-outlined text-white text-[18px]">open_in_new</span>
                </a>
                <p className="text-[9px] text-[#7f7667] text-center leading-relaxed">
                  After registering, get your API token from Deriv, switch back to <strong>Sign In</strong>, and paste it to activate.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px bg-[#d1c5b4] flex-1" />
          <span className="text-[9px] uppercase tracking-widest font-bold text-[#7f7667]">OR</span>
          <div className="h-px bg-[#d1c5b4] flex-1" />
        </div>

        {/* Guest bypass */}
        <button
          type="button"
          onClick={onBypass}
          disabled={isLoading}
          className="w-full h-12 bg-white border border-[#d1c5b4] rounded-xl flex items-center justify-center gap-2 text-[#4e4639] hover:border-[#775a19] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[#775a19] text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>science</span>
          <span className="text-[11px] font-bold uppercase tracking-[0.1em]">Continue as Guest (Trial Mode)</span>
        </button>

        <p className="text-center text-[9px] text-[#7f7667] uppercase tracking-wider leading-relaxed">
          Secure API operations. Token data is stored in your sandbox profile only. No raw credentials saved.
        </p>
      </div>
    </div>
  );
}
