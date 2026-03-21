import React from "react";
import { CARD, BORDER, FG, MUTED_FG, GOLD, MONO_FONT, DISPLAY_FONT } from "../design-tokens";

const ACTIONS = [
  {
    label: "Generate Report",
    sub: "New AI analysis",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      </svg>
    ),
  },
  {
    label: "Full Analysis",
    sub: "Charts & metrics",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2">
        <line x1="18" x2="18" y1="20" y2="10" />
        <line x1="12" x2="12" y1="20" y2="4" />
        <line x1="6" x2="6" y1="20" y2="14" />
      </svg>
    ),
  },
  {
    label: "Set Alerts",
    sub: "Price monitoring",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
  },
];

export const QuickActions: React.FC = () => {
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
        Quick Actions
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {ACTIONS.map((a) => (
          <div
            key={a.label}
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: 16,
              background: "rgba(255,255,255,0.02)",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: `${GOLD}15`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {a.icon}
            </div>
            <span style={{ fontFamily: MONO_FONT, fontSize: 11, color: FG, fontWeight: 500 }}>{a.label}</span>
            <span style={{ fontFamily: MONO_FONT, fontSize: 9, color: MUTED_FG }}>{a.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
