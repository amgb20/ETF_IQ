import React from "react";
import { GOLD, FG, MUTED_FG, CARD, BORDER, MONO_FONT, DISPLAY_FONT } from "../design-tokens";
import type { ThemeData } from "../data/portfolio";
import { ALLOCATIONS } from "../data/portfolio";

interface StepReviewProps {
  portfolioName: string;
  themes: ThemeData[];
}

export const StepReview: React.FC<StepReviewProps> = ({ portfolioName, themes }) => {
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 26, color: FG, fontWeight: 400, margin: 0 }}>
          Review Your Portfolio
        </h2>
        <p style={{ fontFamily: MONO_FONT, fontSize: 11, color: MUTED_FG, marginTop: 6 }}>
          {portfolioName} — {ALLOCATIONS.length} ETF{ALLOCATIONS.length !== 1 ? "s" : ""} across {themes.length} theme{themes.length !== 1 ? "s" : ""}
        </p>
      </div>

      {themes.map((theme) => {
        const themeAllocations = ALLOCATIONS.filter((a) =>
          theme.tickers.includes(a.ticker)
        );
        return (
          <div
            key={theme.name}
            style={{
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 12,
            }}
          >
            <div style={{ height: 2, background: theme.color }} />
            <div style={{ padding: 20 }}>
              <div style={{ fontFamily: DISPLAY_FONT, fontSize: 18, color: FG, fontWeight: 400, marginBottom: 12 }}>
                {theme.name}
              </div>
              {themeAllocations.map((a) => (
                <div
                  key={a.ticker}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: `1px solid ${BORDER}`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: MONO_FONT,
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: `${theme.color}1a`,
                      color: theme.color,
                      border: `1px solid ${theme.color}40`,
                    }}
                  >
                    {a.ticker}
                  </span>
                  <span style={{ fontFamily: MONO_FONT, fontSize: 12, color: GOLD }}>{a.target}%</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
        <div
          style={{
            background: GOLD,
            color: "#0A0A0F",
            fontFamily: MONO_FONT,
            fontSize: 12,
            fontWeight: 500,
            padding: "12px 32px",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="7" height="9" x="3" y="3" rx="1" />
            <rect width="7" height="5" x="14" y="3" rx="1" />
            <rect width="7" height="9" x="14" y="12" rx="1" />
            <rect width="7" height="5" x="3" y="16" rx="1" />
          </svg>
          Go to Dashboard
        </div>
      </div>
    </div>
  );
};
