import React from "react";
import { GOLD, FG, MUTED_FG, CARD, BORDER, POSITIVE, NEGATIVE, MONO_FONT } from "../design-tokens";
import { PORTFOLIO } from "../data/portfolio";

export const HealthSummary: React.FC = () => {
  const pnlColor = PORTFOLIO.pnlPct >= 0 ? POSITIVE : NEGATIVE;
  const pnlSign = PORTFOLIO.pnlPct >= 0 ? "+" : "";
  const scoreColor = PORTFOLIO.confidence >= 7 ? POSITIVE : PORTFOLIO.confidence >= 5 ? "#f59e0b" : NEGATIVE;

  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderTop: `2px solid ${GOLD}4d`,
        borderRadius: 12,
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        gap: 40,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontFamily: MONO_FONT, fontSize: 11, color: MUTED_FG }}>Portfolio Value</div>
        <div style={{ fontFamily: MONO_FONT, fontSize: 24, fontWeight: 700, color: FG }}>
          {PORTFOLIO.currency}{PORTFOLIO.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </div>
      </div>
      <div
        style={{
          fontFamily: MONO_FONT,
          fontSize: 11,
          fontWeight: 600,
          padding: "4px 10px",
          borderRadius: 6,
          background: `${pnlColor}33`,
          color: pnlColor,
        }}
      >
        {pnlSign}{PORTFOLIO.pnlPct}%
      </div>
      <div>
        <div style={{ fontFamily: MONO_FONT, fontSize: 11, color: MUTED_FG }}>System Confidence</div>
        <div style={{ fontFamily: MONO_FONT, fontSize: 16, fontWeight: 700, color: scoreColor }}>
          {PORTFOLIO.confidence}/10
        </div>
      </div>
      <div>
        <div style={{ fontFamily: MONO_FONT, fontSize: 11, color: MUTED_FG }}>Next Agent Run</div>
        <div style={{ fontFamily: MONO_FONT, fontSize: 13, color: FG }}>{PORTFOLIO.nextAgentRun}</div>
      </div>
    </div>
  );
};
