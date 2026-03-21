import React from "react";
import { FG, MUTED_FG, CARD, BORDER, POSITIVE, NEGATIVE, MONO_FONT, DISPLAY_FONT } from "../design-tokens";
import type { ThemeData } from "../data/portfolio";

interface ThemeCardProps {
  theme: ThemeData;
}

export const ThemeCard: React.FC<ThemeCardProps> = ({ theme }) => {
  const pnlColor = theme.pnlPct >= 0 ? POSITIVE : NEGATIVE;
  const pnlSign = theme.pnlPct >= 0 ? "+" : "";

  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderTop: `2px solid ${theme.color}4d`,
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: theme.color }} />
          <span style={{ fontFamily: DISPLAY_FONT, fontSize: 16, color: FG, fontWeight: 400 }}>
            {theme.name}
          </span>
        </div>
        <span
          style={{
            fontFamily: MONO_FONT,
            fontSize: 10,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 4,
            background: `${pnlColor}33`,
            color: pnlColor,
          }}
        >
          {pnlSign}{theme.pnlPct}%
        </span>
      </div>
      <div style={{ fontFamily: MONO_FONT, fontSize: 18, color: FG, fontWeight: 500, marginBottom: 8 }}>
        €{theme.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </div>
      <div style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED_FG }}>
        {theme.tickers.join(", ")}
      </div>
    </div>
  );
};
