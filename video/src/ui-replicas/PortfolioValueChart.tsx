import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { CARD, BORDER, FG, MUTED_FG, GOLD, CHART_COLORS, MONO_FONT, DISPLAY_FONT } from "../design-tokens";
import { PORTFOLIO_VALUE_SERIES } from "../data/portfolio";

interface PortfolioValueChartProps {
  drawDuration?: number;
}

export const PortfolioValueChart: React.FC<PortfolioValueChartProps> = ({ drawDuration = 40 }) => {
  const frame = useCurrentFrame();
  const data = PORTFOLIO_VALUE_SERIES;
  const W = 580, H = 200;
  const padding = { top: 10, right: 10, bottom: 10, left: 10 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + chartH - ((v - min) / range) * chartH;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`;

  const progress = interpolate(frame, [0, drawDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
      <div style={{ fontFamily: DISPLAY_FONT, fontSize: 16, color: FG, fontWeight: 400, marginBottom: 12 }}>
        Portfolio Value
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity="0.4" />
            <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity="0" />
          </linearGradient>
          <clipPath id="pvClip">
            <rect x="0" y="0" width={W * progress} height={H} />
          </clipPath>
        </defs>
        <g clipPath="url(#pvClip)">
          <path d={areaPath} fill="url(#pvGrad)" />
          <path d={linePath} fill="none" stroke={CHART_COLORS[0]} strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
};
