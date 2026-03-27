import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { useUserContext } from "@/contexts/UserContext";
import { GlobeCanvas } from "@/components/globe/globe-canvas";

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, refresh } = useUserContext();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isAuthenticated && user) navigate(`/${user.id}/dashboard`, { replace: true });
  }, [isAuthenticated, user, navigate]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/auth/login/passwordless/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Failed to send code");
      }
      setStep("code");
      setTimeout(() => codeRefs.current[0]?.focus(), 50);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

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
      const res = await fetch("/auth/login/passwordless/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), code: fullCode }),
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

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#060608]">
      {/* Full-screen globe background */}
      <GlobeCanvas className="absolute inset-0 w-full h-full" />

      {/* Subtle grid + grain overlays */}
      <div className="absolute inset-0 app-grid opacity-20 pointer-events-none" />
      <div className="absolute inset-0 app-grain pointer-events-none" />

      {/* Bottom-left label */}
      <div className="absolute bottom-10 left-10 z-10">
        <p className="text-xs tracking-[0.3em] text-zinc-500 uppercase">
          Portfolio Intelligence
        </p>
      </div>

      {/* Floating sign-in card */}
      <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-sm">
          <div className="rounded-2xl border border-white/[0.06] bg-black/60 backdrop-blur-xl p-10 shadow-2xl shadow-black/50">
            <div className="mb-8">
              <h1 className="text-4xl font-semibold text-primary">ETF IQ</h1>
              <p className="text-xs tracking-widest text-zinc-500 uppercase mt-1.5">
                {step === "email" ? "Enter your email to continue" : "Enter verification code"}
              </p>
            </div>

            {step === "email" ? (
              <form onSubmit={handleSendCode} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-colors"
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button
                  type="submit"
                  className="w-full tracking-[0.15em]"
                  disabled={loading || !email.trim()}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "ACCESS TERMINAL"}
                </Button>
                <p className="text-center text-xs text-zinc-500 mt-2">
                  Don&apos;t have an account?{" "}
                  <Link to="/signup" className="text-primary hover:underline">
                    Sign up
                  </Link>
                </p>
              </form>
            ) : (
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
                    setStep("email");
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
