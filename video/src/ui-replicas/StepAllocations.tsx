import React from "react";
import { GOLD, FG, MUTED_FG, CARD, BORDER, POSITIVE, MONO_FONT, DISPLAY_FONT, INPUT } from "../design-tokens";

interface AllocationItem {
  ticker: string;
  theme: string;
  themeColor: string;
  percentage: number;
}

interface StepAllocationsProps {
  items: AllocationItem[];
  totalPct: number;
  portfolioName: string;
}

export const StepAllocations: React.FC<StepAllocationsProps> = ({ items, totalPct, portfolioName }) => {
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 26, color: FG, fontWeight: 400, margin: 0 }}>
          Set Allocations
        </h2>
        <p style={{ fontFamily: MONO_FONT, fontSize: 11, color: MUTED_FG, marginTop: 6 }}>
          Set a target weight or enter your existing positions.
        </p>
      </div>

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 16, borderTop: `2px solid ${GOLD}4d` }}>
        <div style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED_FG, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
          Portfolio Name
        </div>
        <div style={{ background: INPUT, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
          <span style={{ fontFamily: MONO_FONT, fontSize: 12, color: FG }}>{portfolioName}</span>
        </div>
      </div>

      {items.map((item) => (
        <div
          key={item.ticker}
          style={{
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: 20,
            marginBottom: 12,
            borderTop: `2px solid ${GOLD}4d`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontFamily: MONO_FONT, fontSize: 13, color: FG, fontWeight: 500 }}>{item.ticker}</span>
            <span
              style={{
                fontFamily: MONO_FONT,
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 4,
                background: `${item.themeColor}1a`,
                color: item.themeColor,
                border: `1px solid ${item.themeColor}40`,
              }}
            >
              {item.theme}
            </span>
          </div>
          <div style={{ position: "relative", height: 6, borderRadius: 3, background: `${GOLD}15`, marginBottom: 8 }}>
            <div style={{ height: "100%", borderRadius: 3, background: GOLD, width: `${item.percentage}%` }} />
          </div>
          <div style={{ fontFamily: MONO_FONT, fontSize: 12, color: GOLD, textAlign: "right" }}>
            {item.percentage}%
          </div>
        </div>
      ))}

      <div
        style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 20,
        }}
      >
        <span style={{ fontFamily: MONO_FONT, fontSize: 12, color: FG }}>
          Target Weight Total: {totalPct.toFixed(1)}%
        </span>
        {totalPct === 100 && (
          <span style={{ fontFamily: MONO_FONT, fontSize: 11, color: POSITIVE }}>✓ Balanced</span>
        )}
      </div>
    </div>
  );
};
