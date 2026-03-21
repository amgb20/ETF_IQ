import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

interface CursorKeyframe {
  frame: number;
  x: number;
  y: number;
  click?: boolean;
}

interface SimulatedCursorProps {
  keyframes: CursorKeyframe[];
  show?: boolean;
}

export const SimulatedCursor: React.FC<SimulatedCursorProps> = ({ keyframes, show = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!show || keyframes.length === 0) return null;

  const frames = keyframes.map((k) => k.frame);
  const xs = keyframes.map((k) => k.x);
  const ys = keyframes.map((k) => k.y);

  const x = interpolate(frame, frames, xs, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, frames, ys, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const activeClick = keyframes.find(
    (k) => k.click && frame >= k.frame && frame <= k.frame + 12
  );

  const clickScale = activeClick
    ? spring({ frame: frame - activeClick.frame, fps, config: { damping: 8 }, from: 1.3, to: 1 })
    : 1;

  const clickRingOpacity = activeClick
    ? interpolate(frame - activeClick.frame, [0, 12], [0.6, 0], { extrapolateRight: "clamp" })
    : 0;

  const clickRingScale = activeClick
    ? interpolate(frame - activeClick.frame, [0, 12], [0, 30], { extrapolateRight: "clamp" })
    : 0;

  const opacity = interpolate(frame, [keyframes[0].frame - 5, keyframes[0].frame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        zIndex: 100,
        pointerEvents: "none",
        opacity,
        transform: `scale(${clickScale})`,
      }}
    >
      {clickRingOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            width: clickRingScale,
            height: clickRingScale,
            borderRadius: "50%",
            border: "2px solid rgba(201,168,76,0.5)",
            transform: "translate(-50%, -50%)",
            opacity: clickRingOpacity,
          }}
        />
      )}
      <svg width="20" height="24" viewBox="0 0 20 24" fill="none" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>
        <path
          d="M1 1L1 17.5L5.5 13.5L9 21L12 19.5L8.5 12L14 12L1 1Z"
          fill="white"
          stroke="black"
          strokeWidth="1.2"
        />
      </svg>
    </div>
  );
};
