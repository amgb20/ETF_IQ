import "./landing.css";
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp, Bot, Cpu, BarChart3, Bell, FileText, ArrowRight, ChevronDown,
} from "lucide-react";

/* ─── Design tokens ─────────────────────────────────────────── */
const GOLD = "#C9A84C";
const CYAN = "#00D4FF";
const BG   = "#0A0A0F";

/* ─── Sparkline ─────────────────────────────────────────────── */
function Sparkline({ values, color = GOLD }: { values: number[]; color?: string }) {
  const W = 110, H = 36;
  const lo = Math.min(...values), hi = Math.max(...values);
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - lo) / (hi - lo || 1)) * (H - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline points={pts} fill="none" stroke={color}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Animated counter ──────────────────────────────────────── */
function AnimatedCounter({ to, prefix = "", suffix = "" }: {
  to: number; prefix?: string; suffix?: string;
}) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const dur = 1600, t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - t0) / dur, 1);
        setVal(Math.floor((1 - Math.pow(1 - p, 3)) * to));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to]);
  return <span ref={ref}>{prefix}{val}{suffix}</span>;
}

/* ─── Feature cards ─────────────────────────────────────────── */
const FEATURES = [
  { Icon: TrendingUp, title: "Portfolio Tracking",    desc: "Multi-ETF portfolios with investment themes, real-time P&L, and multi-currency position management." },
  { Icon: Bot,        title: "Charles AI Advisor",    desc: "Ask anything. Charles answers with full portfolio context, live web search, and inline chart generation." },
  { Icon: Cpu,        title: "7 Specialized Agents",  desc: "Weekly AI analysis across macro, sector, risk, and recommendation domains — each agent scored for accuracy." },
  { Icon: BarChart3,  title: "Risk Analytics",        desc: "Sharpe ratio, volatility, max drawdown, and correlation matrix across every position in your portfolio." },
  { Icon: Bell,       title: "Smart Price Alerts",    desc: "Threshold monitoring for prices and volatility with instant push and email notifications." },
  { Icon: FileText,   title: "AI-Generated Reports",  desc: "Research-grade PDF reports synthesized from live portfolio data and agent findings in under 2 minutes." },
];

/* ─── Demo scenarios ────────────────────────────────────────── */
type DemoMode = "idle" | "performance" | "risk" | "alert";

const SCENARIOS = [
  {
    id: "performance" as DemoMode,
    chip: "How is my AI Stack performing?",
    response:
      "Your AI Stack theme is outperforming the benchmark this quarter. Current return: +14.2% YTD vs +10.4% benchmark. Top contributors: NVDA ETF (+22.1%), QQQ (+11.4%). Allocation is well-positioned for continued momentum.",
    badge: { text: "+14.2% YTD", color: "#22c55e" },
    sparkline: [7, 9, 8, 11, 10, 14, 13, 16, 18, 17, 20, 23] as number[],
  },
  {
    id: "risk" as DemoMode,
    chip: "What's my biggest risk exposure?",
    response:
      "Your portfolio carries 18.4% annualized volatility — moderate for your profile. Key concern: 42% concentration in tech-adjacent ETFs. Sharpe ratio is healthy at 1.24. I'd recommend adding 10–15% to the Gold theme as a hedge.",
    badge: { text: "Sharpe: 1.24", color: GOLD },
    sparkline: null as number[] | null,
  },
  {
    id: "alert" as DemoMode,
    chip: "Set an alert if SPY drops 3%",
    response:
      "Alert configured. I'll notify you when SPY drops ≥3% from its current level of $594.20. Trigger price: $576.37. You'll receive both a push notification and email when triggered.",
    badge: { text: "✓ Alert Active", color: CYAN },
    sparkline: null as number[] | null,
  },
] as const;

/* ─── Correlation heatmap (fixed values) ────────────────────── */
const HEATMAP: number[][] = [
  [1.00, 0.74, 0.17, 0.22],
  [0.74, 1.00, 0.20, 0.18],
  [0.17, 0.20, 1.00, 0.44],
  [0.22, 0.18, 0.44, 1.00],
];
const HM_TICKERS = ["QQQ", "VOO", "GLD", "XAR"];

/* ─── Message type ──────────────────────────────────────────── */
type Msg = {
  id: string;
  role: "user" | "charles";
  text: string;
  typing?: boolean;
  badge?: { text: string; color: string };
  sparkline?: number[] | null;
};

/* ─── Hero chart path ───────────────────────────────────────── */
const CHART_PATH =
  "M 0,290 C 60,285 120,275 180,265 S 280,250 340,258 " +
  "S 440,230 500,215 S 600,200 660,192 " +
  "S 760,168 820,152 S 920,128 980,112 " +
  "S 1080,88 1140,72 L 1200,58";

/* ─── Landing page ──────────────────────────────────────────── */
export default function LandingPage() {
  const [demoMode, setDemoMode]   = useState<DemoMode>("idle");
  const [messages, setMessages]   = useState<Msg[]>([]);
  const [busy, setBusy]           = useState(false);
  const bottomRef                 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleScenario(s: (typeof SCENARIOS)[number]) {
    if (busy) return;
    setBusy(true);
    setDemoMode(s.id);

    const uid = "u-" + Date.now();
    const cid = "c-" + Date.now();

    setMessages((prev) => [...prev, { id: uid, role: "user", text: s.chip }]);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: cid, role: "charles", text: "", typing: true,
          badge: s.badge, sparkline: s.sparkline },
      ]);
      const full = s.response;
      let i = 0;
      const iv = setInterval(() => {
        i++;
        setMessages((prev) =>
          prev.map((m) => m.id === cid ? { ...m, text: full.slice(0, i) } : m)
        );
        if (i >= full.length) {
          clearInterval(iv);
          setMessages((prev) =>
            prev.map((m) => m.id === cid ? { ...m, typing: false } : m)
          );
          setBusy(false);
        }
      }, 13);
    }, 700);
  }

  return (
    <div className="lp-mono" style={{ background: BG, color: "#f0ede6", overflowX: "hidden" }}>

      {/* ── NAVBAR ─────────────────────────────────────────────── */}
      <nav className="lp-nav fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="lp-display text-xl font-semibold" style={{ color: GOLD }}>
            ETF IQ
          </span>
          <div className="hidden md:flex items-center gap-8 text-xs"
            style={{ color: "rgba(240,237,230,0.5)", letterSpacing: "0.16em" }}>
            <a href="#features" className="hover:text-white transition-colors">FEATURES</a>
            <a href="#demo"     className="hover:text-white transition-colors">DEMO</a>
            <a href="#how"      className="hover:text-white transition-colors">HOW IT WORKS</a>
          </div>
          <Link to="/login" className="lp-btn-cyan lp-mono text-xs px-4 py-2">
            SIGN IN →
          </Link>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen pt-14 overflow-hidden">
        <div className="lp-grid absolute inset-0" />
        <div className="lp-grain absolute inset-0" />

        {/* animated chart */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 400"
          preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ opacity: 0.18 }}>
          <defs>
            <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={GOLD} stopOpacity="0.22" />
              <stop offset="100%" stopColor={GOLD} stopOpacity="0"    />
            </linearGradient>
          </defs>
          <path d={CHART_PATH} fill="none" stroke={GOLD} strokeWidth="1.8"
            className="lp-chart-line" />
          <path d={`${CHART_PATH} L 1200,400 L 0,400 Z`}
            fill="url(#heroFill)" />
        </svg>

        {/* text block */}
        <div className="lp-hero-content relative z-10 text-center max-w-5xl mx-auto px-6 flex flex-col items-center gap-7">
          <span className="lp-mono text-xs" style={{ color: CYAN, letterSpacing: "0.32em" }}>
            PORTFOLIO INTELLIGENCE
          </span>
          <h1 className="lp-display leading-none" style={{
            fontSize: "clamp(3.8rem, 10vw, 8.5rem)",
            fontWeight: 300,
            color: GOLD,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
          }}>
            Your Portfolio,<br />
            <em style={{ fontStyle: "italic", fontWeight: 400 }}>Intelligently</em><br />
            Managed.
          </h1>
          <p className="lp-mono text-sm md:text-base max-w-lg leading-8"
            style={{ color: "rgba(240,237,230,0.55)" }}>
            7 AI agents. Real-time analytics.<br />One conversational advisor.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-3">
            <Link to="/login"
              className="lp-btn-gold lp-mono text-xs px-8 py-3 inline-flex items-center gap-2">
              GET STARTED <ArrowRight size={13} />
            </Link>
            <a href="#demo"
              className="lp-btn-cyan lp-mono text-xs px-8 py-3 inline-flex items-center gap-2">
              SEE THE DEMO <ChevronDown size={13} />
            </a>
          </div>
        </div>

        {/* ticker */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden py-3"
          style={{ borderTop: `1px solid ${GOLD}1a` }}>
          <div className="lp-ticker flex whitespace-nowrap">
            {[0, 1].map((k) => (
              <span key={k} className="lp-mono text-xs flex gap-14 px-10"
                style={{ color: `${GOLD}60` }}>
                {["500+ ETFs", "7 AI AGENTS", "REAL-TIME ALERTS", "PDF REPORTS IN MINUTES",
                  "CORRELATION ANALYSIS", "SHARPE RATIO TRACKING", "CHARLES AI ADVISOR",
                  "LIVE MARKET DATA"].map((t, j) => (
                  <span key={j}>·&nbsp;{t}</span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEMO ───────────────────────────────────────────────── */}
      <section id="demo" className="py-24 px-6" style={{ borderTop: `1px solid ${GOLD}18` }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="lp-mono text-xs" style={{ color: CYAN, letterSpacing: "0.3em" }}>
              INTERACTIVE DEMO
            </span>
            <h2 className="lp-display mt-3"
              style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 400, color: GOLD }}>
              Meet Charles, Your AI Portfolio Advisor
            </h2>
            <p className="lp-mono text-xs mt-4" style={{ color: "rgba(240,237,230,0.4)" }}>
              Click a question to see a live simulation
            </p>
          </div>

          {/* chips */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {SCENARIOS.map((s) => (
              <button key={s.id} onClick={() => handleScenario(s)}
                className="lp-mono text-xs px-4 py-2 transition-[border-color,color,background-color]"
                style={{
                  border: `1px solid ${demoMode === s.id ? CYAN : `${GOLD}38`}`,
                  color:  demoMode === s.id ? CYAN : `${GOLD}99`,
                  background: demoMode === s.id ? `${CYAN}12` : "transparent",
                  borderRadius: 4,
                  cursor: busy ? "wait" : "pointer",
                }}>
                {s.chip}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* LEFT — chat */}
            <div className="lp-glass flex flex-col" style={{ minHeight: 440 }}>
              <div className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: `1px solid ${GOLD}1a` }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#22c55e" }} />
                  <span className="lp-mono text-xs" style={{ color: GOLD }}>CHARLES</span>
                </div>
                <span className="lp-mono text-xs" style={{ color: "rgba(240,237,230,0.28)" }}>
                  Powered by Gemini
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 lp-scrollbar"
                style={{ maxHeight: 360 }}>
                {messages.length === 0 && (
                  <div className="flex-1 flex items-center justify-center" style={{ minHeight: 280 }}>
                    <p className="lp-mono text-xs text-center" style={{ color: "rgba(240,237,230,0.22)" }}>
                      Select a question above to start
                    </p>
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className="lp-mono text-xs px-3 py-2 max-w-xs leading-relaxed"
                      style={{
                        background: m.role === "user" ? `${GOLD}1e` : "rgba(255,255,255,0.04)",
                        borderLeft: m.role === "charles" ? `2px solid ${CYAN}` : "none",
                        borderRadius: 6,
                        color: m.role === "user" ? GOLD : "rgba(240,237,230,0.82)",
                      }}>
                      {m.typing && m.text.length === 0
                        ? <span style={{ color: "rgba(240,237,230,0.35)" }}>· · ·</span>
                        : <span className={m.typing ? "lp-blink" : ""}>{m.text}</span>
                      }
                      {!m.typing && m.badge && (
                        <div className="mt-2 flex items-center gap-3 flex-wrap">
                          <span className="lp-mono text-xs px-2 py-0.5"
                            style={{
                              background: `${m.badge.color}1e`,
                              color: m.badge.color,
                              border: `1px solid ${m.badge.color}44`,
                              borderRadius: 4,
                            }}>
                            {m.badge.text}
                          </span>
                          {m.sparkline && <Sparkline values={m.sparkline} color={GOLD} />}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* RIGHT — dashboard mockup */}
            <div className="lp-glass flex flex-col relative" style={{ minHeight: 440 }}>
              <span className="absolute top-3 right-3 lp-mono text-xs px-2 py-0.5"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(240,237,230,0.18)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 4,
                }}>
                DEMO
              </span>

              <div className="flex items-center px-4 py-3"
                style={{ borderBottom: `1px solid ${GOLD}1a` }}>
                <span className="lp-mono text-xs" style={{ color: GOLD }}>PORTFOLIO DASHBOARD</span>
              </div>

              <div className="flex-1 p-5 overflow-y-auto lp-scrollbar">

                {demoMode === "idle" && (
                  <div className="h-full flex items-center justify-center" style={{ minHeight: 300 }}>
                    <p className="lp-mono text-xs text-center" style={{ color: "rgba(240,237,230,0.22)" }}>
                      Dashboard reacts to Charles in real time
                    </p>
                  </div>
                )}

                {demoMode === "performance" && (
                  <div className="flex flex-col gap-4">
                    <div className="px-4 py-3 rounded"
                      style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${GOLD}2e` }}>
                      <p className="lp-mono text-xs" style={{ color: "rgba(240,237,230,0.45)" }}>TOTAL VALUE</p>
                      <p className="lp-display text-4xl mt-1 font-light" style={{ color: GOLD }}>€47,284.20</p>
                      <p className="lp-mono text-xs mt-1" style={{ color: "#22c55e" }}>↑ +14.2% YTD · +€5,832.40</p>
                    </div>
                    {[
                      { name: "AI STACK", pct: "+14.2%", c: "#6366f1", hi: true  },
                      { name: "GOLD",     pct: "+6.8%",  c: GOLD,      hi: false },
                      { name: "DEFENCE",  pct: "+9.1%",  c: "#ef4444", hi: false },
                    ].map((t) => (
                      <div key={t.name}
                        className="flex items-center justify-between px-4 py-3 rounded"
                        style={{
                          background:  t.hi ? `${t.c}12` : "rgba(255,255,255,0.03)",
                          border:     `1px solid ${t.hi ? t.c : `${t.c}40`}`,
                          boxShadow:   t.hi ? `0 0 24px ${t.c}28` : "none",
                          transition:  "all 0.4s ease",
                        }}>
                        <span className="lp-mono text-xs" style={{ color: t.c }}>{t.name}</span>
                        <span className="lp-mono text-xs font-medium" style={{ color: "#22c55e" }}>{t.pct}</span>
                      </div>
                    ))}
                  </div>
                )}

                {demoMode === "risk" && (
                  <div className="flex flex-col gap-4">
                    <p className="lp-mono text-xs" style={{ color: "rgba(240,237,230,0.45)" }}>RISK METRICS</p>
                    {[
                      { label: "VOLATILITY",   value: "18.4%",  c: GOLD,      w: "65%" },
                      { label: "SHARPE RATIO", value: "1.24",   c: CYAN,      w: "80%" },
                      { label: "MAX DRAWDOWN", value: "-11.2%", c: "#ef4444", w: "45%" },
                      { label: "BETA",         value: "0.92",   c: "#8b5cf6", w: "72%" },
                    ].map((r) => (
                      <div key={r.label}>
                        <div className="flex justify-between mb-1">
                          <span className="lp-mono text-xs" style={{ color: "rgba(240,237,230,0.45)" }}>{r.label}</span>
                          <span className="lp-mono text-xs font-medium" style={{ color: r.c }}>{r.value}</span>
                        </div>
                        <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                          <div className="h-1 rounded-full"
                            style={{ width: r.w, background: r.c, transition: "width 1.1s ease 0.2s" }} />
                        </div>
                      </div>
                    ))}
                    <div className="mt-2">
                      <p className="lp-mono text-xs mb-2" style={{ color: "rgba(240,237,230,0.45)" }}>
                        CORRELATION — {HM_TICKERS.join(" · ")}
                      </p>
                      <div className="grid grid-cols-4 gap-1">
                        {HEATMAP.map((row, ri) =>
                          row.map((v, ci) => (
                            <div key={`${ri}-${ci}`}
                              title={`${HM_TICKERS[ri]} / ${HM_TICKERS[ci]}: ${v.toFixed(2)}`}
                              className="aspect-square rounded flex items-center justify-center lp-mono"
                              style={{
                                fontSize: 9,
                                background: ri === ci ? `${GOLD}80` : `rgba(99,102,241,${v * 0.75})`,
                                color: "rgba(255,255,255,0.7)",
                              }}>
                              {v.toFixed(2)}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {demoMode === "alert" && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <p className="lp-mono text-xs" style={{ color: "rgba(240,237,230,0.45)" }}>ACTIVE ALERTS</p>
                      <span className="lp-mono text-xs px-2 py-0.5 rounded"
                        style={{ background: `${CYAN}20`, color: CYAN }}>
                        1 NEW
                      </span>
                    </div>
                    <div className="px-4 py-3 rounded lp-glow-cyan"
                      style={{ background: `${CYAN}0e`, border: `1px solid ${CYAN}50` }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Bell size={12} style={{ color: CYAN }} className="lp-bell" />
                          <span className="lp-mono text-xs font-medium" style={{ color: CYAN }}>SPY PRICE ALERT</span>
                        </div>
                        <span className="lp-mono text-xs px-1.5 py-0.5 rounded"
                          style={{ background: "#22c55e20", color: "#22c55e" }}>
                          ACTIVE
                        </span>
                      </div>
                      <p className="lp-mono text-xs" style={{ color: "rgba(240,237,230,0.6)" }}>
                        Trigger: -3% from $594.20
                      </p>
                      <p className="lp-mono text-xs mt-0.5" style={{ color: "rgba(240,237,230,0.35)" }}>
                        Notify via: Email + Push
                      </p>
                    </div>
                    {[
                      { ticker: "QQQ", cond: "-5% from $520.10" },
                      { ticker: "GLD", cond: "+2% from $195.40" },
                    ].map((a) => (
                      <div key={a.ticker} className="px-4 py-3 rounded"
                        style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${GOLD}22` }}>
                        <div className="flex justify-between mb-0.5">
                          <span className="lp-mono text-xs font-medium" style={{ color: GOLD }}>
                            {a.ticker} PRICE ALERT
                          </span>
                          <span className="lp-mono text-xs" style={{ color: "rgba(240,237,230,0.35)" }}>WATCHING</span>
                        </div>
                        <p className="lp-mono text-xs" style={{ color: "rgba(240,237,230,0.48)" }}>{a.cond}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6" style={{ borderTop: `1px solid ${GOLD}18` }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="lp-mono text-xs" style={{ color: CYAN, letterSpacing: "0.3em" }}>
              CAPABILITIES
            </span>
            <h2 className="lp-display mt-3"
              style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 400, color: GOLD }}>
              Everything your portfolio needs
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ Icon, title, desc }, i) => (
              <div key={i} className="lp-feature-card p-6 rounded-lg"
                style={{
                  background: "rgba(255,255,255,0.025)",
                  border: `1px solid ${GOLD}28`,
                  borderTop: `2px solid ${GOLD}`,
                }}>
                <Icon size={22} style={{ color: CYAN, marginBottom: 16 }} />
                <h3 className="lp-mono text-sm font-medium mb-3" style={{ color: GOLD }}>{title}</h3>
                <p className="lp-mono text-xs leading-relaxed" style={{ color: "rgba(240,237,230,0.52)" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────── */}
      <section id="how" className="py-24 px-6" style={{ borderTop: `1px solid ${GOLD}18` }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="lp-mono text-xs" style={{ color: CYAN, letterSpacing: "0.3em" }}>PROCESS</span>
            <h2 className="lp-display mt-3"
              style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 400, color: GOLD }}>
              How it works
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { num: "01", tag: "BUILD",   title: "Build your portfolio",      body: "Add your ETF positions and organize them by investment themes — AI Stack, Gold, Defence, and more." },
              { num: "02", tag: "ANALYZE", title: "AI does the heavy lifting", body: "7 specialized agents run weekly: macro trends, sector performance, risk metrics, and scored recommendations." },
              { num: "03", tag: "ACT",     title: "Act with confidence",       body: "Chat with Charles, download research reports, set price alerts, and receive weekly AI digest summaries." },
            ].map((s, i) => (
              <div key={i} className="relative">
                <p className="lp-display absolute -top-4 -left-3 select-none pointer-events-none"
                  style={{ fontSize: "7.5rem", fontWeight: 300, color: `${GOLD}0d`, lineHeight: 1 }}>
                  {s.num}
                </p>
                <div className="relative pt-12 pl-1">
                  <span className="lp-mono text-xs" style={{ color: CYAN, letterSpacing: "0.22em" }}>
                    {s.num} / {s.tag}
                  </span>
                  <h3 className="lp-display text-2xl mt-2 mb-3 font-normal" style={{ color: GOLD }}>{s.title}</h3>
                  <p className="lp-mono text-xs leading-relaxed" style={{ color: "rgba(240,237,230,0.52)" }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────────────── */}
      <section className="py-16 px-6"
        style={{ background: `${GOLD}08`, borderTop: `1px solid ${GOLD}22`, borderBottom: `1px solid ${GOLD}22` }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
          {[
            { to: 500, prefix: "",  suffix: "+",    label: "ETFs available" },
            { to: 7,   prefix: "",  suffix: "",     label: "Specialized AI agents" },
            { to: 2,   prefix: "<", suffix: " min", label: "Report generation" },
            { to: 100, prefix: "",  suffix: "%",    label: "Portfolio coverage" },
          ].map((s, i) => (
            <div key={i}>
              <p className="lp-display font-light"
                style={{ fontSize: "clamp(2.8rem, 7vw, 4.5rem)", color: GOLD, lineHeight: 1 }}>
                <AnimatedCounter to={s.to} prefix={s.prefix} suffix={s.suffix} />
              </p>
              <p className="lp-mono text-xs mt-3" style={{ color: "rgba(240,237,230,0.42)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="relative py-32 px-6 text-center overflow-hidden">
        <div className="lp-grid absolute inset-0" style={{ opacity: 0.6 }} />
        <div className="relative z-10 max-w-3xl mx-auto">
          <span className="lp-mono text-xs" style={{ color: CYAN, letterSpacing: "0.3em" }}>GET STARTED</span>
          <h2 className="lp-display mt-4 mb-6 font-light"
            style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)", color: GOLD, lineHeight: 1.1 }}>
            Ready to see your portfolio differently?
          </h2>
          <p className="lp-mono text-sm mb-10" style={{ color: "rgba(240,237,230,0.45)" }}>
            Join investors using ETF IQ for smarter, AI-driven portfolio decisions.
          </p>
          <Link to="/login"
            className="lp-btn-gold lp-glow-gold lp-mono inline-flex items-center gap-3 text-sm px-12 py-4">
            START FREE <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer className="py-8 px-6" style={{ borderTop: `1px solid ${GOLD}18` }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="lp-display text-lg" style={{ color: `${GOLD}77` }}>ETF IQ</span>
          <div className="flex items-center gap-6 lp-mono text-xs" style={{ color: "rgba(240,237,230,0.32)" }}>
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link to="/terms"   className="hover:text-white transition-colors">Terms</Link>
            <span>© 2025 ETF IQ</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
