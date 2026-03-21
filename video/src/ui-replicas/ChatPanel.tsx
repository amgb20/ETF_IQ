import React from "react";
import { GOLD, CYAN, FG, MUTED_FG, CARD, BORDER, BG, MONO_FONT, DISPLAY_FONT, INPUT } from "../design-tokens";

interface ChatPanelProps {
  children: React.ReactNode;
  floating?: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ children, floating = true }) => {
  const panel = (
    <div
      style={{
        width: floating ? 400 : "100%",
        height: floating ? 520 : "100%",
        background: BG,
        border: `1px solid ${GOLD}4d`,
        borderRadius: floating ? 16 : 0,
        boxShadow: floating ? `0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(201,168,76,0.08)` : "none",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${GOLD}1a`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: `${GOLD}22`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2">
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2" /><path d="M20 14h2" />
            <path d="M15 13v2" /><path d="M9 13v2" />
          </svg>
        </div>
        <div>
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: 14, color: GOLD }}>Charles</div>
          <div style={{ fontFamily: MONO_FONT, fontSize: 9, color: MUTED_FG }}>Portfolio assistant</div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflowY: "hidden",
        }}
      >
        {children}
      </div>

      <div style={{ padding: "12px 16px", borderTop: `1px solid ${GOLD}1a` }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: INPUT,
            border: `1px solid ${BORDER}`,
            borderRadius: 24,
            padding: "8px 12px",
            gap: 8,
          }}
        >
          <span style={{ fontFamily: MONO_FONT, fontSize: 11, color: MUTED_FG, flex: 1 }}>
            Ask Charles...
          </span>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: GOLD,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BG} strokeWidth="2">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );

  if (floating) {
    return (
      <div style={{ position: "absolute", bottom: 24, right: 24, zIndex: 30 }}>
        {panel}
      </div>
    );
  }
  return panel;
};
