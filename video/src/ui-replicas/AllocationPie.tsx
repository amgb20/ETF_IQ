import React from "react";
import { CARD, BORDER, FG, MUTED_FG, GOLD, WARNING, MONO_FONT, DISPLAY_FONT } from "../design-tokens";
import { ALLOCATIONS } from "../data/portfolio";

export const AllocationPie: React.FC = () => {
  const total = ALLOCATIONS.reduce((s, a) => s + a.actual, 0);
  let cumulative = 0;

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
        Allocation
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        <svg width="160" height="160" viewBox="0 0 160 160">
          {ALLOCATIONS.map((a) => {
            const startAngle = (cumulative / total) * 360;
            const sweepAngle = (a.actual / total) * 360;
            cumulative += a.actual;
            const startRad = ((startAngle - 90) * Math.PI) / 180;
            const endRad = (((startAngle + sweepAngle) - 90) * Math.PI) / 180;
            const outerR = 72;
            const innerR = 42;
            const cx = 80, cy = 80;
            const largeArc = sweepAngle > 180 ? 1 : 0;
            const x1o = cx + outerR * Math.cos(startRad);
            const y1o = cy + outerR * Math.sin(startRad);
            const x2o = cx + outerR * Math.cos(endRad);
            const y2o = cy + outerR * Math.sin(endRad);
            const x1i = cx + innerR * Math.cos(endRad);
            const y1i = cy + innerR * Math.sin(endRad);
            const x2i = cx + innerR * Math.cos(startRad);
            const y2i = cy + innerR * Math.sin(startRad);
            const d = `M ${x1o} ${y1o} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i} Z`;
            return <path key={a.ticker} d={d} fill={a.color} style={{ opacity: 0.85 }} />;
          })}
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ALLOCATIONS.map((a) => {
            const drift = Math.abs(a.actual - a.target);
            return (
              <div key={a.ticker} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: a.color }} />
                <span style={{ fontFamily: MONO_FONT, fontSize: 11, color: FG, width: 40 }}>{a.ticker}</span>
                <span style={{ fontFamily: MONO_FONT, fontSize: 11, color: MUTED_FG }}>{a.actual}%</span>
                {drift > 2 && (
                  <span style={{ fontFamily: MONO_FONT, fontSize: 9, color: WARNING, padding: "1px 5px", borderRadius: 3, background: `${WARNING}22` }}>
                    drift
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
