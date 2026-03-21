import React from "react";
import { GOLD, CYAN, FG, MUTED_FG, CARD, BORDER, MONO_FONT, BG } from "../design-tokens";

interface ChatMessageProps {
  role: "user" | "assistant";
  text: string;
  toolBadge?: { label: string; icon: "Globe" | "BookOpen" | "Bell" };
  sources?: { domain: string }[];
  typing?: boolean;
}

const ToolIcon: React.FC<{ icon: string }> = ({ icon }) => {
  if (icon === "Globe") {
    return (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    );
  }
  if (icon === "BookOpen") {
    return (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    </svg>
  );
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ role, text, toolBadge, sources, typing }) => {
  const isUser = role === "user";

  return (
    <div style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: 8, alignItems: "flex-start" }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: isUser ? GOLD : CARD,
          border: isUser ? "none" : `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {isUser ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BG} strokeWidth="2">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2">
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2" />
            <path d="M20 14h2" />
            <path d="M15 13v2" />
            <path d="M9 13v2" />
          </svg>
        )}
      </div>
      <div
        style={{
          maxWidth: "80%",
          padding: "10px 14px",
          borderRadius: 8,
          fontFamily: MONO_FONT,
          fontSize: 11,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          ...(isUser
            ? { background: GOLD, color: BG }
            : { background: CARD, color: FG, borderLeft: `2px solid ${CYAN}99`, border: `1px solid ${BORDER}`, borderLeftWidth: 2, borderLeftColor: `${CYAN}99` }),
        }}
      >
        {typing && !text ? (
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: GOLD,
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
        ) : (
          text
        )}
        {toolBadge && !typing && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontFamily: MONO_FONT,
                fontSize: 9,
                padding: "2px 8px",
                borderRadius: 4,
                background: `${MUTED_FG}22`,
                color: MUTED_FG,
                border: `1px solid ${BORDER}`,
              }}
            >
              <ToolIcon icon={toolBadge.icon} />
              {toolBadge.label}
            </span>
          </div>
        )}
        {sources && sources.length > 0 && !typing && (
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {sources.map((s) => (
              <div
                key={s.domain}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  borderRadius: 20,
                  background: `${MUTED_FG}15`,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div style={{ width: 12, height: 12, borderRadius: 2, background: `${MUTED_FG}33` }} />
                <span style={{ fontFamily: MONO_FONT, fontSize: 9, color: MUTED_FG }}>{s.domain}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
