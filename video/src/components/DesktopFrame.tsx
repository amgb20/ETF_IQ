import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { GOLD, BG } from "../design-tokens";

interface DesktopFrameProps {
  children: React.ReactNode;
  rotateYStart?: number;
  rotateYEnd?: number;
  rotateX?: number;
  scale?: number;
  enterFrom?: "below" | "none";
  enterDuration?: number;
}

export const DesktopFrame: React.FC<DesktopFrameProps> = ({
  children,
  rotateYStart = -8,
  rotateYEnd = -5,
  rotateX = 5,
  scale = 0.85,
  enterFrom = "none",
  enterDuration = 20,
}) => {
  const frame = useCurrentFrame();

  const driftY = interpolate(frame, [0, 900], [rotateYStart, rotateYEnd], {
    extrapolateRight: "clamp",
  });

  const entryY = enterFrom === "below"
    ? interpolate(frame, [0, enterDuration], [120, 0], { extrapolateRight: "clamp" })
    : 0;

  const entryOpacity = enterFrom === "below"
    ? interpolate(frame, [0, enterDuration * 0.6], [0, 1], { extrapolateRight: "clamp" })
    : 1;

  return (
    <div
      style={{
        perspective: 1800,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        position: "absolute",
        inset: 0,
      }}
    >
      <div
        style={{
          transform: `translateY(${entryY}px) rotateY(${driftY}deg) rotateX(${rotateX}deg) scale(${scale})`,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: `0 40px 120px rgba(201,168,76,0.15), 0 0 1px rgba(201,168,76,0.3)`,
          border: `1px solid rgba(201,168,76,0.12)`,
          opacity: entryOpacity,
        }}
      >
        <div
          style={{
            height: 36,
            background: "#111",
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            gap: 6,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
          <div
            style={{
              marginLeft: "auto",
              fontSize: 10,
              color: "rgba(240,237,230,0.3)",
              fontFamily: "system-ui",
              letterSpacing: "0.05em",
            }}
          >
            etfiq.app
          </div>
        </div>
        <div
          style={{
            width: 1440,
            height: 900,
            background: BG,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
