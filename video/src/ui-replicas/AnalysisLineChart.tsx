import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { CHART_COLORS, MUTED_FG } from "../design-tokens";
import { ETF_GROWTH_SERIES, CHART_EVENTS } from "../data/portfolio";

interface AnalysisLineChartProps {
  drawDuration?: number;
  showEvents?: boolean;
  onEventIndex?: number | null;
}

export const AnalysisLineChart: React.FC<AnalysisLineChartProps> = ({
  drawDuration = 40,
  showEvents = false,
  onEventIndex = null,
}) => {
  const frame = useCurrentFrame();
  const W = 560, H = 280;
  const pad = { top: 20, right: 15, bottom: 25, left: 40 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const tickers = Object.keys(ETF_GROWTH_SERIES);
  const allValues = tickers.flatMap((t) => ETF_GROWTH_SERIES[t]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const progress = interpolate(frame, [0, drawDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = pad.top + chartH * (1 - f);
        return (
          <line key={f} x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="#27272a" strokeWidth="0.5" />
        );
      })}
      <text x={pad.left - 4} y={pad.top + 4} textAnchor="end" fill={MUTED_FG} fontSize="8" fontFamily="monospace">
        Growth (%)
      </text>

      <defs>
        <clipPath id="lineClip">
          <rect x={pad.left} y={pad.top} width={chartW * progress} height={chartH} />
        </clipPath>
      </defs>

      <g clipPath="url(#lineClip)">
        {tickers.map((ticker, ti) => {
          const series = ETF_GROWTH_SERIES[ticker];
          const path = series
            .map((v, i) => {
              const x = pad.left + (i / (series.length - 1)) * chartW;
              const y = pad.top + chartH - ((v - min) / range) * chartH;
              return `${i === 0 ? "M" : "L"} ${x} ${y}`;
            })
            .join(" ");
          return <path key={ticker} d={path} fill="none" stroke={CHART_COLORS[ti]} strokeWidth="2" />;
        })}
      </g>

      {showEvents &&
        CHART_EVENTS.map((e) => {
          const x = pad.left + (e.index / 59) * chartW;
          const y = pad.top + chartH - 10;
          const isPositive = e.sentiment === "positive";
          const color = isPositive ? "#22c55e" : e.sentiment === "negative" ? "#ef4444" : "#a1a1aa";
          const isActive = onEventIndex === e.index;
          return (
            <g key={e.index}>
              <circle cx={x} cy={y} r={isActive ? 8 : 5} fill={`${color}33`} stroke={color} strokeWidth={isActive ? 2 : 1} />
              <text x={x} y={y + 3} textAnchor="middle" fill={color} fontSize="8" fontFamily="monospace">
                {isPositive ? "▲" : "▼"}
              </text>
            </g>
          );
        })}
    </svg>
  );
};
