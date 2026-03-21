import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { GrainOverlay } from "../../components";
import { BG, GOLD, DISPLAY_FONT } from "../../design-tokens";

export const LogoScene: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shimmer = Math.sin(frame * 0.08) * 0.15 + 0.85;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <GrainOverlay opacity={0.03} />
      <h1
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: 200,
          fontWeight: 300,
          color: GOLD,
          letterSpacing: "-0.02em",
          margin: 0,
          opacity: opacity * shimmer,
          textShadow: `0 0 80px rgba(201,168,76,${shimmer * 0.3})`,
        }}
      >
        ETF IQ
      </h1>
    </div>
  );
};
