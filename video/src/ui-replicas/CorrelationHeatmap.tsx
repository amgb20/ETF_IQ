import React from "react";
import { CARD, BORDER, FG, MUTED_FG, GOLD, MONO_FONT, DISPLAY_FONT } from "../design-tokens";
import { CORRELATION_MATRIX } from "../data/portfolio";

function cellColor(v: number, isDiag: boolean): string {
  if (isDiag) return "rgba(63,63,70,0.6)";
  if (v >= 0.8) return "rgba(34,197,94,0.8)";
  if (v >= 0.5) return "rgba(34,197,94,0.5)";
  if (v >= 0.2) return "rgba(34,197,94,0.25)";
  if (v >= -0.2) return "rgba(63,63,70,0.5)";
  if (v >= -0.5) return "rgba(239,68,68,0.25)";
  if (v >= -0.8) return "rgba(239,68,68,0.5)";
  return "rgba(239,68,68,0.8)";
}

export const CorrelationHeatmap: React.FC = () => {
  const { tickers, values } = CORRELATION_MATRIX;
  const cellSize = 56;

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
      <div style={{ fontFamily: DISPLAY_FONT, fontSize: 16, color: FG, fontWeight: 400, marginBottom: 16 }}>
        Correlation Matrix
      </div>
      <div style={{ display: "inline-block" }}>
        <div style={{ display: "flex", paddingLeft: cellSize }}>
          {tickers.map((t) => (
            <div
              key={t}
              style={{
                width: cellSize,
                textAlign: "center",
                fontFamily: MONO_FONT,
                fontSize: 10,
                color: MUTED_FG,
                paddingBottom: 6,
              }}
            >
              {t}
            </div>
          ))}
        </div>
        {values.map((row, ri) => (
          <div key={ri} style={{ display: "flex" }}>
            <div
              style={{
                width: cellSize,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: 8,
                fontFamily: MONO_FONT,
                fontSize: 10,
                color: MUTED_FG,
              }}
            >
              {tickers[ri]}
            </div>
            {row.map((v, ci) => (
              <div
                key={ci}
                style={{
                  width: cellSize,
                  height: cellSize,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: cellColor(v, ri === ci),
                  borderRadius: 4,
                  margin: 1,
                  fontFamily: MONO_FONT,
                  fontSize: 10,
                  color: ri === ci ? "rgba(161,161,170,0.7)" : "rgba(255,255,255,0.7)",
                }}
              >
                {v.toFixed(2)}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
        {[
          { label: "-1.0", color: "rgba(239,68,68,0.8)" },
          { label: "-0.5", color: "rgba(239,68,68,0.4)" },
          { label: "0.0", color: "rgba(63,63,70,0.5)" },
          { label: "+0.5", color: "rgba(34,197,94,0.4)" },
          { label: "+1.0", color: "rgba(34,197,94,0.8)" },
        ].map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: s.color }} />
            <span style={{ fontFamily: MONO_FONT, fontSize: 8, color: MUTED_FG }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
