import React from "react";
import { GOLD, CYAN, FG, MUTED_FG, CARD, BORDER, MONO_FONT, DISPLAY_FONT, CHART_COLORS } from "../design-tokens";

interface ChartWorkspaceProps {
  activeTab?: string;
  activeRange?: string;
  eventsOn?: boolean;
  selectedEtfs?: string[];
  children?: React.ReactNode;
}

const TABS = ["Line", "Bar", "Drawdown", "Risk-Return", "Correlation", "Heatmap"];
const RANGES = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y", "MAX"];

export const ChartWorkspace: React.FC<ChartWorkspaceProps> = ({
  activeTab = "Line",
  activeRange = "1Y",
  eventsOn = false,
  selectedEtfs = ["QQQ", "NVDA", "GLD", "XAR"],
  children,
}) => {
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderTop: `2px solid ${GOLD}4d`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 0 }}>
            {TABS.map((t) => (
              <div
                key={t}
                style={{
                  fontFamily: MONO_FONT,
                  fontSize: 11,
                  padding: "8px 14px",
                  color: t === activeTab ? GOLD : MUTED_FG,
                  borderBottom: t === activeTab ? `2px solid ${GOLD}` : "2px solid transparent",
                  cursor: "default",
                }}
              >
                {t}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED_FG }}>Events:</span>
            <div
              style={{
                fontFamily: MONO_FONT,
                fontSize: 10,
                padding: "3px 10px",
                borderRadius: 4,
                background: eventsOn ? `${GOLD}22` : "transparent",
                color: eventsOn ? GOLD : MUTED_FG,
                border: `1px solid ${eventsOn ? GOLD : BORDER}`,
              }}
            >
              {eventsOn ? "ON" : "OFF"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          {RANGES.map((r) => (
            <div
              key={r}
              style={{
                fontFamily: MONO_FONT,
                fontSize: 10,
                padding: "4px 10px",
                borderRadius: 4,
                background: r === activeRange ? GOLD : "transparent",
                color: r === activeRange ? "#0A0A0F" : MUTED_FG,
              }}
            >
              {r}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {selectedEtfs.map((etf, i) => (
            <div
              key={etf}
              style={{
                fontFamily: MONO_FONT,
                fontSize: 10,
                padding: "4px 10px",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: `${CHART_COLORS[i]}22`,
                color: CHART_COLORS[i],
                border: `1px solid ${CHART_COLORS[i]}44`,
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: CHART_COLORS[i] }} />
              {etf}
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 20px 20px", minHeight: 300 }}>
        {children}
      </div>
    </div>
  );
};
