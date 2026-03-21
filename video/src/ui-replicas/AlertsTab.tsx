import React from "react";
import { GOLD, CYAN, FG, MUTED_FG, CARD, BORDER, POSITIVE, WARNING, NEGATIVE, MONO_FONT, DISPLAY_FONT, INPUT, SECONDARY } from "../design-tokens";

interface AlertsTabProps {
  showNewAlert?: boolean;
  newAlertTicker?: string;
  newAlertThreshold?: string;
}

export const AlertsTab: React.FC<AlertsTabProps> = ({
  showNewAlert = false,
  newAlertTicker = "SPY",
  newAlertThreshold = "-3",
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderTop: `2px solid ${GOLD}4d`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontFamily: DISPLAY_FONT, fontSize: 16, color: FG, fontWeight: 400, marginBottom: 16 }}>
          Active Alerts
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {showNewAlert && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: 8,
                border: `1px solid ${CYAN}55`,
                background: `${CYAN}0e`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: MONO_FONT, fontSize: 12, color: FG, fontWeight: 500 }}>{newAlertTicker}</span>
                <span style={{ fontFamily: MONO_FONT, fontSize: 9, padding: "2px 6px", borderRadius: 4, background: `${NEGATIVE}22`, color: NEGATIVE, border: `1px solid ${NEGATIVE}44` }}>
                  price below
                </span>
                <span style={{ fontFamily: MONO_FONT, fontSize: 11, color: MUTED_FG }}>{newAlertThreshold}%</span>
              </div>
              <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: POSITIVE, display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: POSITIVE }} />
                Active
              </span>
            </div>
          )}
          {[
            { ticker: "QQQ", type: "pct_change", threshold: "-5%", status: true },
            { ticker: "GLD", type: "price_above", threshold: "$198.50", status: true },
          ].map((a) => (
            <div
              key={a.ticker}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: MONO_FONT, fontSize: 12, color: FG, fontWeight: 500 }}>{a.ticker}</span>
                <span style={{ fontFamily: MONO_FONT, fontSize: 9, padding: "2px 6px", borderRadius: 4, background: `${MUTED_FG}22`, color: MUTED_FG, border: `1px solid ${BORDER}` }}>
                  {a.type.replace("_", " ")}
                </span>
                <span style={{ fontFamily: MONO_FONT, fontSize: 11, color: MUTED_FG }}>{a.threshold}</span>
              </div>
              <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: POSITIVE }}>Active</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderTop: `2px solid ${GOLD}4d`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontFamily: DISPLAY_FONT, fontSize: 16, color: FG, fontWeight: 400, marginBottom: 16 }}>
          Create Alert
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontFamily: MONO_FONT, fontSize: 9, color: MUTED_FG, marginBottom: 4 }}>ETF</div>
            <div style={{ background: INPUT, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 10px", fontFamily: MONO_FONT, fontSize: 11, color: FG }}>
              {newAlertTicker || "Select..."}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: MONO_FONT, fontSize: 9, color: MUTED_FG, marginBottom: 4 }}>Type</div>
            <div style={{ background: INPUT, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 10px", fontFamily: MONO_FONT, fontSize: 11, color: FG }}>
              price_below
            </div>
          </div>
          <div>
            <div style={{ fontFamily: MONO_FONT, fontSize: 9, color: MUTED_FG, marginBottom: 4 }}>Threshold</div>
            <div style={{ background: INPUT, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 10px", fontFamily: MONO_FONT, fontSize: 11, color: FG }}>
              {newAlertThreshold}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16, fontFamily: MONO_FONT, fontSize: 11, padding: "8px 20px", borderRadius: 6, background: GOLD, color: "#0A0A0F", textAlign: "center", fontWeight: 500 }}>
          Create Alert
        </div>
      </div>
    </div>
  );
};
