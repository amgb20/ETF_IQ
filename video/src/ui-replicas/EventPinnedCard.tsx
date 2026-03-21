import React from "react";
import { CARD, BORDER, FG, MUTED_FG, POSITIVE, NEGATIVE, MONO_FONT } from "../design-tokens";
import type { ChartEvent } from "../data/portfolio";

interface EventPinnedCardProps {
  event: ChartEvent;
  x: number;
  y: number;
}

export const EventPinnedCard: React.FC<EventPinnedCardProps> = ({ event, x, y }) => {
  const sentColor = event.sentiment === "positive" ? POSITIVE : event.sentiment === "negative" ? NEGATIVE : "#a1a1aa";

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 260,
        background: `${CARD}f2`,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: 14,
        backdropFilter: "blur(8px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        zIndex: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={MUTED_FG} strokeWidth="2">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
          </svg>
          <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED_FG }}>Mar 12, 2026</span>
        </div>
        <span
          style={{
            fontFamily: MONO_FONT,
            fontSize: 9,
            padding: "2px 6px",
            borderRadius: 4,
            background: `${sentColor}22`,
            color: sentColor,
            border: `1px solid ${sentColor}44`,
            textTransform: "capitalize",
          }}
        >
          {event.sentiment}
        </span>
      </div>
      <div style={{ fontFamily: MONO_FONT, fontSize: 11, color: FG, fontWeight: 500, marginBottom: 6, lineHeight: 1.4 }}>
        {event.headline}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 4,
          border: `1px solid ${BORDER}`,
        }}
      >
        <img
          src={`https://www.google.com/s2/favicons?domain=${event.domain}&sz=16`}
          width={14}
          height={14}
          style={{ borderRadius: 2 }}
        />
        <span style={{ fontFamily: MONO_FONT, fontSize: 10, color: MUTED_FG }}>{event.source}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={MUTED_FG} strokeWidth="2" style={{ marginLeft: "auto" }}>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15,3 21,3 21,9" />
          <line x1="10" x2="21" y1="14" y2="3" />
        </svg>
      </div>
    </div>
  );
};
