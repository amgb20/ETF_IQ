import React from "react";
import { CARD, BORDER, FG, MUTED_FG, GOLD, WARNING, NEGATIVE, MONO_FONT, DISPLAY_FONT } from "../design-tokens";

const ALERTS = [
  { type: "price_below", message: "SPY dropped below $576.37 threshold", time: "2h ago", color: NEGATIVE },
  { type: "volatility", message: "QQQ volatility exceeded 25% annualized", time: "1d ago", color: WARNING },
  { type: "price_above", message: "GLD reached $198.50 target", time: "3d ago", color: WARNING },
];

export const LatestAlerts: React.FC = () => {
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderTop: `2px solid ${GOLD}4d`,
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        <span style={{ fontFamily: DISPLAY_FONT, fontSize: 16, color: FG, fontWeight: 400 }}>Latest Alerts</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ALERTS.map((a, i) => (
          <div
            key={i}
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                fontFamily: MONO_FONT,
                fontSize: 9,
                padding: "2px 6px",
                borderRadius: 4,
                background: `${a.color}22`,
                color: a.color,
                border: `1px solid ${a.color}44`,
                whiteSpace: "nowrap",
              }}
            >
              {a.type.replace("_", " ")}
            </span>
            <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: FG, flex: 1 }}>{a.message}</span>
            <span style={{ fontFamily: MONO_FONT, fontSize: 9, color: MUTED_FG }}>{a.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
