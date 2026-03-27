import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, TrendingUp, Wallet, Shield, Landmark, Scale, ChevronDown, Search } from "lucide-react";
import { useUserContext } from "@/contexts/UserContext";
import { GlobeCanvas } from "@/components/globe/globe-canvas";

const INVESTMENT_GOALS = [
  { value: "growth", label: "Growth", icon: TrendingUp, desc: "Maximize capital appreciation" },
  { value: "income", label: "Income", icon: Wallet, desc: "Generate steady dividends" },
  { value: "preservation", label: "Preservation", icon: Shield, desc: "Protect existing capital" },
  { value: "retirement", label: "Retirement", icon: Landmark, desc: "Build long-term wealth" },
  { value: "balanced", label: "Balanced", icon: Scale, desc: "Mix of growth & income" },
] as const;

const RISK_LEVELS = [
  { value: "conservative", label: "Conservative", desc: "Lower risk, steadier returns" },
  { value: "moderate", label: "Moderate", desc: "Balanced risk and reward" },
  { value: "aggressive", label: "Aggressive", desc: "Higher risk, higher potential" },
] as const;

const CURRENCIES = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "DKK", name: "Danish Krone" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "KRW", name: "South Korean Won" },
  { code: "INR", name: "Indian Rupee" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "ZAR", name: "South African Rand" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "PLN", name: "Polish Zloty" },
] as const;

export default function SignupPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, refresh } = useUserContext();
  const [step, setStep] = useState<"details" | "profile" | "code">("details");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [investmentGoal, setInvestmentGoal] = useState<string | null>(null);
  const [riskTolerance, setRiskTolerance] = useState<string | null>(null);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [currencySearch, setCurrencySearch] = useState("");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const currencyRef = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isAuthenticated && user) navigate(`/${user.id}/dashboard`, { replace: true });
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) {
        setCurrencyOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCurrencies = CURRENCIES.filter(
    (c) =>
      c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
      c.name.toLowerCase().includes(currencySearch.toLowerCase()),
  );

  const selectedCurrencyName = CURRENCIES.find((c) => c.code === baseCurrency)?.name ?? "";

  const handleDetailsNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setStep("profile");
  };

  const callSignup = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          display_name: displayName.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Failed to create account");
      }
      setStep("code");
      setTimeout(() => codeRefs.current[0]?.focus(), 50);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileContinue = () => callSignup();
  const handleProfileSkip = () => callSignup();

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...code];
    next[index] = value.slice(-1);
    setCode(next);
    if (value && index < 5) codeRefs.current[index + 1]?.focus();
    const fullCode = next.join("");
    if (fullCode.length === 6) submitCode(fullCode);
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...code];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setCode(next);
    if (pasted.length === 6) submitCode(pasted);
    else codeRefs.current[pasted.length]?.focus();
  };

  const submitCode = async (fullCode: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/auth/signup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          code: fullCode,
          display_name: displayName.trim() || null,
          base_currency: baseCurrency,
          investment_goal: investmentGoal,
          risk_tolerance: riskTolerance,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Verification failed");
      }
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setCode(["", "", "", "", "", ""]);
      codeRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-colors";

  const stepLabel =
    step === "details"
      ? "Create your account"
      : step === "profile"
        ? "Your investor profile"
        : "Enter verification code";

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#060608]">
      <GlobeCanvas className="absolute inset-0 w-full h-full" />

      <div className="absolute inset-0 app-grid opacity-20 pointer-events-none" />
      <div className="absolute inset-0 app-grain pointer-events-none" />

      <div className="absolute bottom-10 left-10 z-10">
        <p className="text-xs tracking-[0.3em] text-zinc-500 uppercase">
          Portfolio Intelligence
        </p>
      </div>

      <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
        <div className={`pointer-events-auto w-full ${step === "profile" ? "max-w-md" : "max-w-sm"}`}>
          <div className="rounded-2xl border border-white/[0.06] bg-black/60 backdrop-blur-xl p-10 shadow-2xl shadow-black/50">
            <div className="mb-8">
              <h1 className="text-4xl font-semibold text-primary">ETF IQ</h1>
              <p className="text-xs tracking-widest text-zinc-500 uppercase mt-1.5">
                {stepLabel}
              </p>
            </div>

            {step === "details" && (
              <form onSubmit={handleDetailsNext} className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5 tracking-wide uppercase">
                    Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name (optional)"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5 tracking-wide uppercase">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoFocus
                    required
                    className={inputClass}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button
                  type="submit"
                  className="w-full tracking-[0.15em]"
                  disabled={!email.trim()}
                >
                  CONTINUE
                </Button>
                <p className="text-center text-xs text-zinc-500 mt-2">
                  Already have an account?{" "}
                  <Link to="/login" className="text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </form>
            )}

            {step === "profile" && (
              <div className="space-y-6">
                {/* Investment Goal */}
                <div>
                  <label className="block text-xs text-zinc-500 mb-2.5 tracking-wide uppercase">
                    Investment Goal
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {INVESTMENT_GOALS.map(({ value, label, icon: Icon, desc }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setInvestmentGoal(investmentGoal === value ? null : value)}
                        className={`group relative flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all ${
                          investmentGoal === value
                            ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                            : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`h-3.5 w-3.5 ${investmentGoal === value ? "text-primary" : "text-zinc-500"}`} />
                          <span className={`text-sm font-medium ${investmentGoal === value ? "text-white" : "text-zinc-300"}`}>
                            {label}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-600 leading-tight">{desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Risk Tolerance */}
                <div>
                  <label className="block text-xs text-zinc-500 mb-2.5 tracking-wide uppercase">
                    Risk Tolerance
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {RISK_LEVELS.map(({ value, label, desc }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRiskTolerance(riskTolerance === value ? null : value)}
                        className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all ${
                          riskTolerance === value
                            ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30"
                            : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                        }`}
                      >
                        <span className={`text-sm font-medium ${riskTolerance === value ? "text-white" : "text-zinc-300"}`}>
                          {label}
                        </span>
                        <span className="text-[11px] text-zinc-600 leading-tight">{desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Base Currency */}
                <div ref={currencyRef} className="relative">
                  <label className="block text-xs text-zinc-500 mb-1.5 tracking-wide uppercase">
                    Base Currency
                  </label>
                  <button
                    type="button"
                    onClick={() => { setCurrencyOpen(!currencyOpen); setCurrencySearch(""); }}
                    className={`${inputClass} flex items-center justify-between pr-3 cursor-pointer text-left`}
                  >
                    <span>
                      <span className="font-medium">{baseCurrency}</span>
                      <span className="text-zinc-500 ml-2">{selectedCurrencyName}</span>
                    </span>
                    <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${currencyOpen ? "rotate-180" : ""}`} />
                  </button>

                  {currencyOpen && (
                    <div className="absolute z-50 bottom-full mb-1.5 w-full rounded-lg border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden">
                      <div className="max-h-48 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.08)_transparent]">
                        {filteredCurrencies.length === 0 ? (
                          <p className="px-3 py-3 text-xs text-zinc-600 text-center">No currencies found</p>
                        ) : (
                          filteredCurrencies.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => { setBaseCurrency(c.code); setCurrencyOpen(false); setCurrencySearch(""); }}
                              className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                                baseCurrency === c.code
                                  ? "bg-primary/10 text-white"
                                  : "text-zinc-300 hover:bg-white/[0.06]"
                              }`}
                            >
                              <span className="font-medium w-10">{c.code}</span>
                              <span className="text-zinc-500">{c.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
                        <Search className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                        <input
                          type="text"
                          value={currencySearch}
                          onChange={(e) => setCurrencySearch(e.target.value)}
                          placeholder="Search currency..."
                          autoFocus
                          className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  type="button"
                  className="w-full tracking-[0.15em]"
                  disabled={loading}
                  onClick={handleProfileContinue}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "CREATE ACCOUNT"}
                </Button>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors"
                    onClick={() => { setStep("details"); setError(""); }}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <button
                    type="button"
                    className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                    onClick={handleProfileSkip}
                    disabled={loading}
                  >
                    Skip for now
                  </button>
                </div>
              </div>
            )}

            {step === "code" && (
              <div className="space-y-6">
                <p className="text-sm text-zinc-400">
                  A 6-digit code was sent to{" "}
                  <span className="font-medium text-white">{email}</span>
                </p>

                <div className="flex justify-center gap-2" onPaste={handleCodePaste}>
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { codeRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(i, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(i, e)}
                      className="h-14 w-12 rounded-lg border border-white/10 bg-white/[0.04] text-center text-xl font-semibold text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-colors"
                      style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    />
                  ))}
                </div>

                {error && <p className="text-sm text-destructive text-center">{error}</p>}

                {loading && (
                  <div className="flex justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full tracking-[0.15em]"
                  onClick={() => {
                    const fullCode = code.join("");
                    if (fullCode.length === 6) submitCode(fullCode);
                  }}
                  disabled={loading || code.join("").length < 6}
                >
                  VERIFY CODE
                </Button>

                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors"
                  onClick={() => {
                    setStep("details");
                    setCode(["", "", "", "", "", ""]);
                    setError("");
                  }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Use a different email
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
