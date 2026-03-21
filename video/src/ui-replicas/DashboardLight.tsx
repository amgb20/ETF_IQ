import React from "react";
import { LIGHT, GOLD, POSITIVE, NEGATIVE, CHART_COLORS, MONO_FONT, DISPLAY_FONT } from "../design-tokens";
import { PORTFOLIO, THEMES, ALLOCATIONS } from "../data/portfolio";

export const DashboardLight: React.FC = () => {
  const pnlColor = PORTFOLIO.pnlPct >= 0 ? POSITIVE : NEGATIVE;
  const scoreColor = PORTFOLIO.confidence >= 7 ? POSITIVE : "#f59e0b";

  return (
    <div style={{ width: "100%", height: "100%", background: LIGHT.BG, color: LIGHT.FG, padding: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: 28, fontWeight: 600, color: LIGHT.FG, margin: 0, opacity: 0.9 }}>
          Dashboard
        </h1>
        <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: LIGHT.MUTED_FG, letterSpacing: "0.1em" }}>
          Portfolio overview
        </span>
      </div>

      <div
        style={{
          background: LIGHT.CARD,
          border: `1px solid ${LIGHT.BORDER}`,
          borderTop: `2px solid ${GOLD}66`,
          borderRadius: 12,
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 40,
          marginBottom: 20,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <div>
          <div style={{ fontFamily: MONO_FONT, fontSize: 11, color: LIGHT.MUTED_FG }}>Portfolio Value</div>
          <div style={{ fontFamily: MONO_FONT, fontSize: 24, fontWeight: 700, color: LIGHT.FG }}>
            {PORTFOLIO.currency}{PORTFOLIO.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        </div>
        <span style={{ fontFamily: MONO_FONT, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: `${pnlColor}22`, color: pnlColor }}>
          +{PORTFOLIO.pnlPct}%
        </span>
        <div>
          <div style={{ fontFamily: MONO_FONT, fontSize: 11, color: LIGHT.MUTED_FG }}>Confidence</div>
          <div style={{ fontFamily: MONO_FONT, fontSize: 16, fontWeight: 700, color: scoreColor }}>
            {PORTFOLIO.confidence}/10
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
        {THEMES.map((t) => {
          const pc = t.pnlPct >= 0 ? POSITIVE : NEGATIVE;
          return (
            <div
              key={t.name}
              style={{
                background: LIGHT.CARD,
                border: `1px solid ${LIGHT.BORDER}`,
                borderTop: `2px solid ${t.color}88`,
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.color }} />
                <span style={{ fontFamily: DISPLAY_FONT, fontSize: 15, color: LIGHT.FG }}>{t.name}</span>
                <span style={{ fontFamily: MONO_FONT, fontSize: 10, padding: "2px 6px", borderRadius: 4, background: `${pc}22`, color: pc, marginLeft: "auto" }}>
                  +{t.pnlPct}%
                </span>
              </div>
              <div style={{ fontFamily: MONO_FONT, fontSize: 16, color: LIGHT.FG, fontWeight: 500 }}>
                €{t.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontFamily: MONO_FONT, fontSize: 9, color: LIGHT.MUTED_FG, marginTop: 4 }}>
                {t.tickers.join(", ")}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <div
          style={{
            background: LIGHT.CARD,
            border: `1px solid ${LIGHT.BORDER}`,
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: 15, color: LIGHT.FG, marginBottom: 8 }}>Portfolio Value</div>
          <svg width="100%" height="140" viewBox="0 0 500 140">
            <defs>
              <linearGradient id="lightGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity="0.2" />
                <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,120 Q50,100 100,95 T200,80 T300,60 T400,45 T500,25" fill="none" stroke={CHART_COLORS[0]} strokeWidth="2" />
            <path d="M0,120 Q50,100 100,95 T200,80 T300,60 T400,45 T500,25 L500,140 L0,140 Z" fill="url(#lightGrad)" />
          </svg>
        </div>
        <div
          style={{
            background: LIGHT.CARD,
            border: `1px solid ${LIGHT.BORDER}`,
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: 15, color: LIGHT.FG, marginBottom: 8 }}>Allocation</div>
          <svg width="120" height="120" viewBox="0 0 120 120" style={{ display: "block", margin: "0 auto" }}>
            {(() => {
              let cum = 0;
              const total = ALLOCATIONS.reduce((s, a) => s + a.actual, 0);
              return ALLOCATIONS.map((a) => {
                const start = (cum / total) * 360 - 90;
                const sweep = (a.actual / total) * 360;
                cum += a.actual;
                const r1 = (start * Math.PI) / 180;
                const r2 = ((start + sweep) * Math.PI) / 180;
                const oR = 54, iR = 32, cx = 60, cy = 60;
                const la = sweep > 180 ? 1 : 0;
                return (
                  <path
                    key={a.ticker}
                    d={`M${cx + oR * Math.cos(r1)} ${cy + oR * Math.sin(r1)} A${oR} ${oR} 0 ${la} 1 ${cx + oR * Math.cos(r2)} ${cy + oR * Math.sin(r2)} L${cx + iR * Math.cos(r2)} ${cy + iR * Math.sin(r2)} A${iR} ${iR} 0 ${la} 0 ${cx + iR * Math.cos(r1)} ${cy + iR * Math.sin(r1)} Z`}
                    fill={a.color}
                    opacity={0.8}
                  />
                );
              });
            })()}
          </svg>
        </div>
      </div>
    </div>
  );
};
