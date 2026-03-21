import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { GrainOverlay, GridOverlay } from "../../components";
import { BG, GOLD, CYAN, DISPLAY_FONT, MONO_FONT } from "../../design-tokens";

const CHART_PATH =
  "M 0,290 C 60,285 120,275 180,265 S 280,250 340,258 " +
  "S 440,230 500,215 S 600,200 660,192 " +
  "S 760,168 820,152 S 920,128 980,112 " +
  "S 1080,88 1140,72 L 1200,58";

export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const chartDraw = interpolate(frame, [5, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = spring({ frame: Math.max(0, frame - 20), fps, from: 50, to: 0, config: { damping: 12 } });
  const tagOpacity = interpolate(frame, [50, 65], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exitScale = interpolate(frame, [100, 120], [1, 1.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exitOpacity = interpolate(frame, [100, 120], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ width: "100%", height: "100%", background: BG, position: "relative", overflow: "hidden" }}>
      <GridOverlay />
      <GrainOverlay />

      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.2 }}
        viewBox="0 0 1200 400"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="tf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.22" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={CHART_PATH}
          fill="none"
          stroke={GOLD}
          strokeWidth="2"
          strokeDasharray="2000"
          strokeDashoffset={2000 * (1 - chartDraw)}
        />
        <path d={`${CHART_PATH} L 1200,400 L 0,400 Z`} fill="url(#tf)" opacity={chartDraw} />
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          opacity: exitOpacity,
          transform: `scale(${exitScale})`,
        }}
      >
        <h1
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: 180,
            fontWeight: 300,
            color: GOLD,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            margin: 0,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          ETF IQ
        </h1>
        <div
          style={{
            fontFamily: MONO_FONT,
            fontSize: 14,
            color: CYAN,
            letterSpacing: "0.32em",
            marginTop: 20,
            opacity: tagOpacity,
          }}
        >
          PORTFOLIO INTELLIGENCE
        </div>
      </div>
    </div>
  );
};
