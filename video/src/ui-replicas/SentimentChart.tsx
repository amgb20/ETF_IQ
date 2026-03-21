import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { CARD, BORDER, FG, MUTED_FG, GOLD, POSITIVE, NEGATIVE, CHART_COLORS, MONO_FONT, DISPLAY_FONT } from "../design-tokens";
import { SENTIMENT_DATA, AGENTS } from "../data/portfolio";

interface SentimentChartProps {
  drawDuration?: number;
}

export const SentimentChart: React.FC<SentimentChartProps> = ({ drawDuration = 30 }) => {
  const frame = useCurrentFrame();
  const W = 500, H = 240;
  const pad = { top: 20, right: 15, bottom: 30, left: 35 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const progress = interpolate(frame, [0, drawDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const keys: (keyof typeof SENTIMENT_DATA[0])[] = ["macro", "sector", "risk", "recommender"];

  function toY(v: number) {
    return pad.top + chartH - ((v - 0) / 10) * chartH;
  }

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
        Sentiment / Accuracy
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {[0, 2, 4, 6, 8, 10].map((v) => (
          <React.Fragment key={v}>
            <line x1={pad.left} y1={toY(v)} x2={W - pad.right} y2={toY(v)} stroke={`${GOLD}14`} strokeWidth="0.5" />
            <text x={pad.left - 6} y={toY(v) + 3} textAnchor="end" fill={MUTED_FG} fontSize="8" fontFamily="monospace">
              {v}
            </text>
          </React.Fragment>
        ))}

        <line x1={pad.left} y1={toY(7)} x2={W - pad.right} y2={toY(7)} stroke={POSITIVE} strokeWidth="0.5" strokeDasharray="4 3" />
        <line x1={pad.left} y1={toY(4)} x2={W - pad.right} y2={toY(4)} stroke={NEGATIVE} strokeWidth="0.5" strokeDasharray="4 3" />

        {SENTIMENT_DATA.map((d, i) => (
          <text
            key={d.week}
            x={pad.left + (i / (SENTIMENT_DATA.length - 1)) * chartW}
            y={H - 8}
            textAnchor="middle"
            fill={MUTED_FG}
            fontSize="8"
            fontFamily="monospace"
          >
            {d.week}
          </text>
        ))}

        <defs>
          <clipPath id="sentClip">
            <rect x={pad.left} y={pad.top} width={chartW * progress} height={chartH} />
          </clipPath>
        </defs>

        <g clipPath="url(#sentClip)">
          {keys.map((key, ki) => {
            const path = SENTIMENT_DATA.map((d, i) => {
              const x = pad.left + (i / (SENTIMENT_DATA.length - 1)) * chartW;
              const y = toY(d[key] as number);
              return `${i === 0 ? "M" : "L"} ${x} ${y}`;
            }).join(" ");
            return <path key={key} d={path} fill="none" stroke={CHART_COLORS[ki]} strokeWidth="2" />;
          })}
        </g>
      </svg>

      <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
        {AGENTS.map((a, i) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: CHART_COLORS[i] }} />
            <span style={{ fontFamily: MONO_FONT, fontSize: 9, color: MUTED_FG }}>{a.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
