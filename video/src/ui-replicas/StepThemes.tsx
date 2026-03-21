import React from "react";
import { GOLD, FG, MUTED_FG, CARD, BORDER, MONO_FONT, DISPLAY_FONT } from "../design-tokens";
import type { ThemeData } from "../data/portfolio";

interface StepThemesProps {
  themes: ThemeData[];
  etfCount: number;
}

export const StepThemes: React.FC<StepThemesProps> = ({ themes, etfCount }) => {
  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 26, color: FG, fontWeight: 400, margin: 0 }}>
          Themes Detected
        </h2>
        <p style={{ fontFamily: MONO_FONT, fontSize: 11, color: MUTED_FG, marginTop: 6 }}>
          {themes.length} theme{themes.length !== 1 ? "s" : ""} identified from your {etfCount} ETFs.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {themes.map((theme) => (
          <div
            key={theme.name}
            style={{
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div style={{ height: 3, background: theme.color }} />
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: theme.color }} />
                <span style={{ fontFamily: DISPLAY_FONT, fontSize: 18, color: FG, fontWeight: 400 }}>
                  {theme.name}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {theme.tickers.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontFamily: MONO_FONT,
                      fontSize: 10,
                      padding: "3px 8px",
                      borderRadius: 4,
                      background: `${theme.color}1a`,
                      color: theme.color,
                      border: `1px solid ${theme.color}40`,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED_FG, textAlign: "center", marginTop: 20 }}>
        Themes detected by AI — you can adjust later from your dashboard.
      </p>
    </div>
  );
};
